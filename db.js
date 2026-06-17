// ── SQLite persistence layer ───────────────────────────────────
// One file-backed database holding users, login tokens, sessions, scan history
// and alert watches. In Docker the file lives under a mounted volume (see
// Dockerfile + DB_PATH) so data survives container restarts.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'hetops.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT UNIQUE NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS login_tokens (
    token      TEXT PRIMARY KEY,
    email      TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS history (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id  INTEGER NOT NULL,
    domain   TEXT NOT NULL,
    ts       INTEGER NOT NULL,
    snapshot TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id, ts DESC);

  CREATE TABLE IF NOT EXISTS alerts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    domain        TEXT NOT NULL,
    email_enabled INTEGER NOT NULL DEFAULT 1,
    last_state    TEXT,
    last_checked  INTEGER,
    created_at    INTEGER NOT NULL,
    UNIQUE(user_id, domain),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const now = () => Date.now();
const newId = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

// ── Users ──
const _userByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const _insUserIgnore = db.prepare('INSERT INTO users (email, created_at) VALUES (?, ?) ON CONFLICT(email) DO NOTHING');
// Race-safe: INSERT-OR-IGNORE then SELECT, so concurrent first-logins can't crash
// on the UNIQUE(email) constraint and always return the canonical stored row.
function upsertUser(email) {
  _insUserIgnore.run(email, now());
  return _userByEmail.get(email);
}

// ── Login tokens (magic link) ──
const _insToken = db.prepare('INSERT INTO login_tokens (token, email, expires_at, used) VALUES (?, ?, ?, 0)');
const _expirePriorTokens = db.prepare('UPDATE login_tokens SET used = 1 WHERE email = ? AND used = 0');
// Atomic single-use consumption: only the first caller flips used 0→1 (changes===1).
const _consumeToken = db.prepare('UPDATE login_tokens SET used = 1 WHERE token = ? AND used = 0 AND expires_at >= ?');
const _getTokenEmail = db.prepare('SELECT email FROM login_tokens WHERE token = ?');
function createLoginToken(email, ttlMs = 15 * 60 * 1000) {
  _expirePriorTokens.run(email);            // invalidate any outstanding links for this email
  const token = newId(24);
  _insToken.run(token, email, now() + ttlMs);
  return token;
}
function consumeLoginToken(token) {
  const info = _consumeToken.run(token, now());
  if (info.changes !== 1) return null;      // already used / expired / unknown — atomic guard
  const row = _getTokenEmail.get(token);
  return row ? row.email : null;
}

// ── Sessions ──
const _insSession = db.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)');
const _getSession = db.prepare('SELECT s.id, s.user_id, s.expires_at, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?');
const _delSession = db.prepare('DELETE FROM sessions WHERE id = ?');
function createSession(userId, ttlMs = 30 * 24 * 60 * 60 * 1000) {
  const id = newId(32);
  _insSession.run(id, userId, now(), now() + ttlMs);
  return id;
}
function getSession(id) {
  if (!id) return null;
  const row = _getSession.get(id);
  if (!row || row.expires_at < now()) return null;
  return row; // { id, user_id, expires_at, email }
}
function destroySession(id) { if (id) _delSession.run(id); }

// ── History ──
const _insHistory = db.prepare('INSERT INTO history (user_id, domain, ts, snapshot) VALUES (?, ?, ?, ?)');
const _listHistory = db.prepare('SELECT domain, ts, snapshot FROM history WHERE user_id = ? ORDER BY ts DESC LIMIT ?');
const _clearHistory = db.prepare('DELETE FROM history WHERE user_id = ?');
const _trimHistory = db.prepare('DELETE FROM history WHERE user_id = ? AND id NOT IN (SELECT id FROM history WHERE user_id = ? ORDER BY ts DESC LIMIT ?)');
function addHistory(userId, domain, ts, snapshotObj) {
  _insHistory.run(userId, domain, ts, JSON.stringify(snapshotObj || {}));
  _trimHistory.run(userId, userId, 100);
}
function listHistory(userId, limit = 60) {
  // Spread snapshot FIRST so the authoritative domain/ts columns can't be
  // overridden by client-supplied fields inside the stored snapshot JSON.
  return _listHistory.all(userId, limit).map(r => ({ ...safeParse(r.snapshot), domain: r.domain, ts: r.ts }));
}
function clearHistory(userId) { _clearHistory.run(userId); }

// ── Alerts ──
const _insAlert = db.prepare(`INSERT INTO alerts (user_id, domain, email_enabled, created_at)
  VALUES (?, ?, ?, ?) ON CONFLICT(user_id, domain) DO UPDATE SET email_enabled = excluded.email_enabled`);
const _listAlertsForUser = db.prepare('SELECT id, domain, email_enabled, last_state, last_checked FROM alerts WHERE user_id = ? ORDER BY created_at DESC');
const _delAlert = db.prepare('DELETE FROM alerts WHERE user_id = ? AND domain = ?');
const _allAlerts = db.prepare('SELECT a.id, a.user_id, a.domain, a.email_enabled, a.last_state, u.email FROM alerts a JOIN users u ON u.id = a.user_id');
const _updAlertState = db.prepare('UPDATE alerts SET last_state = ?, last_checked = ? WHERE id = ?');
function addAlert(userId, domain, emailEnabled = 1) {
  _insAlert.run(userId, domain, emailEnabled ? 1 : 0, now());
}
function listAlerts(userId) {
  return _listAlertsForUser.all(userId).map(a => ({
    domain: a.domain, emailEnabled: !!a.email_enabled,
    lastChecked: a.last_checked, last: safeParse(a.last_state),
  }));
}
function removeAlert(userId, domain) { _delAlert.run(userId, domain); }
function allAlerts() {
  return _allAlerts.all().map(a => ({
    id: a.id, userId: a.user_id, domain: a.domain,
    emailEnabled: !!a.email_enabled, email: a.email, last: safeParse(a.last_state),
  }));
}
function updateAlertState(id, stateObj) { _updAlertState.run(JSON.stringify(stateObj || {}), now(), id); }

// Periodic cleanup of expired tokens/sessions.
const _gcTokens = db.prepare('DELETE FROM login_tokens WHERE expires_at < ?');
const _gcSessions = db.prepare('DELETE FROM sessions WHERE expires_at < ?');
function gc() { _gcTokens.run(now()); _gcSessions.run(now()); }
setInterval(gc, 60 * 60 * 1000).unref();

function safeParse(s) { try { return s ? JSON.parse(s) : {}; } catch { return {}; } }

module.exports = {
  db, DB_PATH,
  upsertUser,
  createLoginToken, consumeLoginToken,
  createSession, getSession, destroySession,
  addHistory, listHistory, clearHistory,
  addAlert, listAlerts, removeAlert, allAlerts, updateAlertState,
};

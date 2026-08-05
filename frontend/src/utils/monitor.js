/**
 * Domain monitoring — watchlist state, status probing and change detection.
 *
 * Ports currentStatusFromS / monCheck / diffStatus / monStatusLevel and the watch
 * mutations. `diffStatus` mirrors the server's own implementation (server.js has a
 * unit test named "diffStatus emits threshold and change alerts"), so the thresholds
 * here — 7/30/90 days for certificates, 7/30 for registration — must stay in step
 * with it. Changing one side alone would make in-tab alerts disagree with the emails
 * the server sends.
 */
import { fetchJSON, syncApi } from './api.js';
import { getWatch, setWatch } from './storage.js';
import { whoisExpiryDays } from './format.js';

/** Snapshot the monitored signals from an in-memory report (legacy currentStatusFromS). */
export function currentStatusFromReport(S) {
  const ok = (v) => v && !v.error;
  return {
    ts: Date.now(),
    sslDays: ok(S.ssl) ? S.ssl.certificate?.daysRemaining ?? null : null,
    grade: ok(S.ssl) ? S.ssl.grade?.letter || null : null,
    blacklisted: S.bl?.results ? S.bl.results.some((r) => r.listed) : null,
    whoisDays: ok(S.whois) ? whoisExpiryDays(S.whois.rawData) : null,
    aRecords: ok(S.dns) ? ((S.dns.results?.A || []).map((r) => r.value).sort()) : [],
  };
}

/** Re-probe a domain's monitored signals (legacy monCheck) — same four endpoints. */
export async function monCheck(domain, signal) {
  const [ssl, bl, dns, whois] = await Promise.all([
    fetchJSON('/api/ssl', { domain }, signal).catch(() => ({ error: 1 })),
    fetchJSON('/api/blacklist-check', { domain }, signal).catch(() => ({ error: 1 })),
    fetchJSON('/api/dns-lookup', { domain, resolver: 'balanced' }, signal).catch(() => ({ error: 1 })),
    fetchJSON('/api/whois', { domain }, signal).catch(() => ({ error: 1 })),
  ]);
  return {
    ts: Date.now(),
    sslDays: ssl && !ssl.error ? ssl.certificate?.daysRemaining ?? null : null,
    grade: ssl && !ssl.error ? ssl.grade?.letter || null : null,
    blacklisted: bl && !bl.error && bl.results ? bl.results.some((r) => r.listed) : null,
    whoisDays: whois && !whois.error ? whoisExpiryDays(whois.rawData) : null,
    aRecords: dns && !dns.error ? ((dns.results?.A || []).map((r) => r.value).sort()) : [],
  };
}

/**
 * Human-readable changes between two status snapshots (legacy diffStatus).
 * Thresholds and message wording are verbatim — see the note at the top of this file.
 */
export function diffStatus(prev, cur) {
  const ch = [];
  if (!prev) return ch;

  if (prev.sslDays != null && cur.sslDays != null) {
    for (const t of [7, 30, 90]) {
      if (prev.sslDays > t && cur.sslDays <= t) {
        ch.push(`Certificate now within ${t} days of expiry (${cur.sslDays}d left)`);
      }
    }
    if (prev.sslDays > 0 && cur.sslDays <= 0) ch.push('Certificate has expired');
  }

  if (prev.whoisDays != null && cur.whoisDays != null) {
    for (const t of [7, 30]) {
      if (prev.whoisDays > t && cur.whoisDays <= t) {
        ch.push(`Domain registration expires in ${cur.whoisDays} days`);
      }
    }
    if (prev.whoisDays > 0 && cur.whoisDays <= 0) ch.push('Domain registration has EXPIRED');
  }

  if (prev.blacklisted === false && cur.blacklisted === true) ch.push('Domain is now blacklisted');
  if (prev.blacklisted === true && cur.blacklisted === false) ch.push('Domain removed from blacklists');

  if (prev.aRecords && cur.aRecords) {
    const a = prev.aRecords.join(', ');
    const b = cur.aRecords.join(', ');
    if (a !== b && (a || b)) ch.push(`A record changed: ${a || '∅'} → ${b || '∅'}`);
  }

  if (prev.grade && cur.grade && prev.grade !== cur.grade) {
    ch.push(`TLS grade changed ${prev.grade} → ${cur.grade}`);
  }

  return ch;
}

/** Worst-signal level for the status dot (legacy monStatusLevel). */
export function monStatusLevel(s) {
  if (!s) return 'idle';
  if (s.blacklisted === true || (s.sslDays != null && s.sslDays <= 7) || (s.whoisDays != null && s.whoisDays <= 7)) {
    return 'err';
  }
  if ((s.sslDays != null && s.sslDays <= 30) || (s.whoisDays != null && s.whoisDays <= 30)) return 'warn';
  return 'ok';
}

/* ── Watchlist mutations ─────────────────────────────────────────────────────── */

/** Add a domain to the watchlist, capped at 30 (legacy toggleWatch, add branch). */
export function addWatch(domain, S, { authenticated } = {}) {
  const base = currentStatusFromReport(S);
  const next = [
    { domain, addedAt: Date.now(), baseline: base, last: base, lastChanges: [], emailEnabled: true },
    ...getWatch().filter((w) => w.domain !== domain),
  ].slice(0, 30);
  setWatch(next);
  if (authenticated) syncApi.putAlert(domain, true);
  return next;
}

/** Remove a domain from the watchlist (legacy unwatch). */
export function removeWatch(domain, { authenticated } = {}) {
  const next = getWatch().filter((w) => w.domain !== domain);
  setWatch(next);
  if (authenticated) syncApi.deleteAlert(domain);
  return next;
}

/** Toggle per-domain email alerts (legacy setAlertEmail). */
export function setAlertEmail(domain, enabled, { authenticated } = {}) {
  const w = getWatch();
  const item = w.find((x) => x.domain === domain);
  if (item) {
    item.emailEnabled = enabled;
    setWatch(w);
  }
  if (authenticated) syncApi.putAlert(domain, enabled);
  return w;
}

/**
 * Re-check every monitored domain sequentially, recording changes.
 * Sequential by design (as in the legacy version): each domain costs four requests, so
 * running them in parallel across a 30-domain watchlist would spike the rate limiter.
 * Returns { watch, totalChanges, notices } so the caller owns the toasts.
 */
export async function refreshAll(signal) {
  const watch = getWatch();
  if (!watch.length) return { watch, totalChanges: 0, notices: [] };

  let totalChanges = 0;
  const notices = [];

  for (const w of watch) {
    try {
      const cur = await monCheck(w.domain, signal);
      const prev = w.last || w.baseline;
      const changes = diffStatus(prev, cur);
      w.last = cur;
      w.lastChanges = changes;
      if (changes.length) {
        totalChanges += changes.length;
        notices.push(
          `${w.domain}: ${changes[0]}${changes.length > 1 ? ` (+${changes.length - 1} more)` : ''}`
        );
      }
    } catch {
      /* leave the previous status in place */
    }
  }

  setWatch(watch);
  return { watch, totalChanges, notices };
}

/**
 * Report snapshots — the data behind Compare & History.
 *
 * Ports buildSnapshot / saveSnapshot / latestPerDomain / notifyGradeChange and the
 * CMP_METRICS table. Field names are unchanged because snapshots are persisted in
 * localStorage under the legacy `hetops_dns_snaps` key AND synced to /api/history —
 * renaming a field would orphan existing history and break the server payload shape.
 */
import { getSnaps, setSnaps, KEYS } from './storage.js';
import { collectFindings } from './findings.js';
import { computeHealth } from './health.js';
import { syncApi } from './api.js';

/** Build a snapshot of the current report (legacy buildSnapshot). */
export function buildSnapshot(domain, S) {
  const h = computeHealth(S);
  const sev = { crit: 0, high: 0, med: 0, low: 0 };
  collectFindings(S).forEach((x) => {
    if (sev[x.sev] != null) sev[x.sev]++;
  });
  const ok = (v) => v && !v.error;
  return {
    domain,
    ts: Date.now(),
    pct: h ? h.pct : null,
    grade: h ? h.grade : null,
    sslGrade: ok(S.ssl) ? S.ssl.grade?.letter || null : null,
    sslDays: ok(S.ssl) ? S.ssl.certificate?.daysRemaining ?? null : null,
    emailScore: ok(S.emailsec) ? S.emailsec.overallScore ?? null : null,
    dmarc: ok(S.emailsec) ? S.emailsec.dmarc?.policy || (S.emailsec.dmarc?.present ? 'set' : 'none') : null,
    dnssec: ok(S.dnssec) ? S.dnssec.rating || null : null,
    blacklisted: S.bl?.results ? S.bl.results.some((r) => r.listed) : null,
    dnsRecords: S.dns?.summary?.totalRecords ?? S.dns?.totals?.records ?? null,
    ip: S.geoip?.target || null,
    country: S.geoip?.geo?.country_name || null,
    crit: sev.crit,
    high: sev.high,
    med: sev.med,
    low: sev.low,
  };
}

/**
 * Persist a snapshot, capped at 40 entries, and return the PREVIOUS snapshot for the
 * same domain so the caller can report grade changes (legacy saveSnapshot).
 * Snapshots with no real data are dropped rather than polluting history.
 */
export function saveSnapshot(domain, S, { authenticated } = {}) {
  const snap = buildSnapshot(domain, S);
  if (snap.pct == null && snap.sslGrade == null && snap.dnsRecords == null) return null;

  const snaps = getSnaps();
  const prev = snaps.find((s) => s.domain === domain) || null;
  setSnaps([snap, ...snaps].slice(0, 40));
  if (authenticated) syncApi.putHistory(domain, snap);
  return prev;
}

/** Newest snapshot per domain, preserving recency order (legacy latestPerDomain). */
export function latestPerDomain() {
  const seen = new Set();
  const out = [];
  for (const s of getSnaps()) {
    if (!seen.has(s.domain)) {
      seen.add(s.domain);
      out.push(s);
    }
  }
  return out;
}

/**
 * Compare the previous snapshot against the current report and return a toast to show,
 * or null (legacy notifyGradeChange). Returns the message rather than firing it so the
 * caller owns presentation.
 */
export function gradeChangeNotice(prev, domain, S) {
  if (!prev) return null;
  const h = computeHealth(S);
  if (!h) return null;

  if (prev.grade && prev.grade !== h.grade) {
    const better = (prev.pct ?? 0) < h.pct;
    return {
      message: `${domain}: grade ${better ? 'improved' : 'dropped'} ${prev.grade} → ${h.grade} since last scan`,
      type: better ? 'ok' : 'warn',
      ms: 4500,
    };
  }

  // Certificate crossing the 30-day threshold is worth surfacing on its own.
  if (prev.sslDays != null && S.ssl && !S.ssl.error) {
    const now = S.ssl.certificate?.daysRemaining;
    if (now != null && prev.sslDays > 30 && now <= 30) {
      return { message: `${domain}: certificate now expires in ${now} days`, type: 'warn', ms: 4500 };
    }
  }
  return null;
}

/** Grade → tone for the history list (legacy gradeColor). */
export function gradeTone(g) {
  if (!g) return 'muted';
  if (g === 'A+' || g === 'A' || g === 'B') return 'ok';
  if (g === 'C') return 'warn';
  return 'err';
}

/**
 * Metrics compared side by side, with the formatter and "which direction wins" flag
 * from the legacy CMP_METRICS table — order and wording preserved.
 */
export const CMP_METRICS = [
  ['Health score', 'pct', (v) => (v == null ? '—' : v + '/100'), 'higher'],
  ['Grade', 'grade', (v) => v || '—', 'none'],
  ['Critical issues', 'crit', (v) => (v == null ? '—' : String(v)), 'lower'],
  ['High issues', 'high', (v) => (v == null ? '—' : String(v)), 'lower'],
  ['TLS grade', 'sslGrade', (v) => v || '—', 'none'],
  ['Cert days left', 'sslDays', (v) => (v == null ? '—' : v + 'd'), 'higher'],
  ['Email score', 'emailScore', (v) => (v == null ? '—' : v + '/100'), 'higher'],
  ['DMARC policy', 'dmarc', (v) => v || '—', 'none'],
  [
    'DNSSEC',
    'dnssec',
    (v) => (v ? { good: 'enabled', incomplete: 'partial', not_configured: 'off' }[v] || v : '—'),
    'none',
  ],
  ['Blacklisted', 'blacklisted', (v) => (v == null ? '—' : v ? 'yes' : 'no'), 'none'],
  ['DNS records', 'dnsRecords', (v) => (v == null ? '—' : String(v)), 'higher'],
  ['Location', 'country', (v) => v || '—', 'none'],
];

export { KEYS };

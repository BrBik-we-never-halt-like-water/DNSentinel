/**
 * Health score access.
 *
 * The scoring maths deliberately lives OUTSIDE this app, in
 * public/shared/health-score.js, which server.js also `require`s. That single
 * module backs three surfaces at once: this UI's ring, the /api/scan summary and
 * the README status badge. Re-implementing the weighting here — even "identically"
 * — would create a second source of truth that could silently drift, so we call
 * the shared module (exposed as window.HetOpsScore by the script tag in index.html).
 *
 * Weighting, for reference only: DNS hygiene 50 · email 20 · TLS 30 · blacklist 10.
 */
import { gradeTone } from './format.js';

/**
 * @returns {{pct:number, grade:string, pts:number, tot:number, breakdown:Array, tone:string}|null}
 *          null when no section has reported yet (a scan that hasn't produced any
 *          scoreable data), matching the legacy `computeHealth()` contract.
 */
export function computeHealth(S) {
  const mod = typeof window !== 'undefined' ? window.HetOpsScore : null;
  if (!mod?.computeHealthScore) return null;

  const h = mod.computeHealthScore({
    dns: S.dns,
    ssl: S.ssl,
    emailsec: S.emailsec,
    blacklist: S.bl,
  });
  if (!h) return null;

  return { ...h, tone: gradeTone(h.pct) };
}

/** Letter grade for an arbitrary percentage, via the same shared module. */
export function gradeOf(pct) {
  const mod = typeof window !== 'undefined' ? window.HetOpsScore : null;
  return mod?.gradeOf ? mod.gradeOf(pct) : '—';
}

/**
 * Per-category health status for the tab strip (legacy updateTabHealth).
 *
 * Returns { core, security, email, network, web, intelligence } with values
 * 'ok' | 'warn' | 'err' | undefined (undefined = not yet known, so no dot shows).
 * Every threshold below is carried over unchanged.
 */
export function tabHealth(S) {
  const out = {};

  // Core: any DNS records resolved at all.
  if (S.dns) {
    const hasRec = Object.values(S.dns.results || {}).some((r) => r && r.length > 0);
    out.core = hasRec ? 'ok' : 'warn';
  }

  // Security: SSL grade combined with the header score when both are in.
  if (S.ssl && !S.ssl.error && S.headers) {
    const sslScore = S.ssl.grade?.score || 0;
    const hScore = S.headers.analysis?.score || 0;
    out.security = sslScore >= 70 && hScore >= 60 ? 'ok' : sslScore >= 50 || hScore >= 40 ? 'warn' : 'err';
  } else if (S.ssl && !S.ssl.error) {
    const s = S.ssl.grade?.score || 0;
    out.security = s >= 70 ? 'ok' : s >= 50 ? 'warn' : 'err';
  }

  // Email: overall score, falling back to DNS insight checks.
  if (S.emailsec && !S.emailsec.error) {
    const s = S.emailsec.overallScore || 0;
    out.email = s >= 80 ? 'ok' : s >= 50 ? 'warn' : 'err';
  } else if (S.dns?.insights?.checks) {
    const c = S.dns.insights.checks;
    const n = (c.spf ? 1 : 0) + (c.dmarc ? 1 : 0) + (c.mx ? 1 : 0);
    out.email = n === 3 ? 'ok' : n >= 2 ? 'warn' : 'err';
  }

  // Network: IPv6 availability.
  if (S.ipv6) out.network = S.ipv6.ipv6Enabled ? 'ok' : 'warn';

  // Web: HTTP feature score.
  if (S.http && !S.http.error) {
    const s = S.http.score || 0;
    out.web = s >= 80 ? 'ok' : s >= 50 ? 'warn' : 'err';
  }

  // Intelligence: registered typosquat count.
  if (S.typosquat && !S.typosquat.error) {
    const hits = (S.typosquat.results || []).filter((r) => r.registered).length;
    out.intelligence = hits === 0 ? 'ok' : hits <= 3 ? 'warn' : 'err';
  }

  return out;
}

/** Screen-reader text for a health dot — status must never be colour-only. */
export const HEALTH_TEXT = {
  ok: 'Healthy',
  warn: 'Needs attention',
  err: 'Problem detected',
};

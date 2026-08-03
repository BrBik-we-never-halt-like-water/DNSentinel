/**
 * DNSentinel — single source of truth for the domain health score.
 *
 * Loaded by BOTH the server (require) and the browser (script tag → window.HetOpsScore),
 * so the grade on the badge, the /api/scan summary and the UI ring can never drift.
 *
 * Weighting: DNS hygiene 50 · email authentication 20 · TLS certificate 30 · blacklist 10.
 * Sections whose check failed (or never ran) drop out of the total instead of counting
 * against the domain, so a partial scan still yields an honest percentage.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HetOpsScore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function gradeOf(pct) {
    return pct >= 95 ? 'A+' : pct >= 85 ? 'A' : pct >= 70 ? 'B' : pct >= 50 ? 'C' : 'D';
  }

  /**
   * @param {object} inputs
   * @param {object|null} inputs.dns        payload of /api/dns-lookup (single domain)
   * @param {object|null} inputs.ssl        payload of /api/ssl
   * @param {object|null} inputs.emailsec   payload of /api/email-security
   * @param {object|null} inputs.blacklist  payload of /api/blacklist-check
   * @returns {{pct:number, grade:string, pts:number, tot:number, breakdown:Array}|null}
   *          null when no section produced usable data.
   */
  function computeHealthScore(inputs) {
    const { dns, ssl, emailsec, blacklist } = inputs || {};
    let pts = 0, tot = 0;
    const breakdown = [];

    if (dns && !dns.error && dns.insights && dns.insights.checks) {
      const c = dns.insights.checks;
      const rows = [
        { label: 'SPF record published', pts: c.spf ? 15 : 0, max: 15, ok: !!c.spf, tab: 'emailsec' },
        { label: 'DMARC policy published', pts: c.dmarc ? 15 : 0, max: 15, ok: !!c.dmarc, tab: 'emailsec' },
        { label: 'CAA record restricts certificate issuers', pts: c.caa ? 10 : 0, max: 10, ok: !!c.caa, tab: 'dns' },
        { label: 'MX records present', pts: c.mx ? 10 : 0, max: 10, ok: !!c.mx, tab: 'dns' },
      ];
      const earned = rows.reduce(function (s, r) { return s + r.pts; }, 0);
      pts += earned; tot += 50;
      breakdown.push({ key: 'dns', label: 'DNS hygiene', earned: earned, max: 50, rows: rows });
    }

    if (emailsec && !emailsec.error && typeof emailsec.overallScore === 'number') {
      const earned = Math.round(emailsec.overallScore * 0.2);
      pts += earned; tot += 20;
      breakdown.push({
        key: 'email', label: 'Email authentication', earned: earned, max: 20,
        rows: [{ label: 'SPF/DKIM/DMARC combined score ' + emailsec.overallScore + '/100', pts: earned, max: 20, ok: emailsec.overallScore >= 65, tab: 'emailsec' }],
      });
    }

    if (ssl && !ssl.error) {
      const d = ssl.certificate ? ssl.certificate.daysRemaining : null;
      const earned = d > 90 ? 30 : d > 30 ? 20 : d > 0 ? 10 : 0;
      pts += earned; tot += 30;
      breakdown.push({
        key: 'ssl', label: 'TLS certificate', earned: earned, max: 30,
        rows: [{
          label: d == null ? 'No certificate detected' : d <= 0 ? 'Certificate has expired' : 'Certificate valid for ' + d + ' more days',
          pts: earned, max: 30, ok: d > 30, tab: 'ssl',
        }],
      });
    }

    if (blacklist && !blacklist.error && blacklist.results) {
      const listed = blacklist.results.some(function (r) { return r.listed; });
      const earned = listed ? 0 : 10;
      pts += earned; tot += 10;
      breakdown.push({
        key: 'blacklist', label: 'Blacklist reputation', earned: earned, max: 10,
        rows: [{ label: listed ? 'Listed on a spam blacklist' : 'Not listed on any checked blacklist', pts: earned, max: 10, ok: !listed, tab: 'security' }],
      });
    }

    if (!tot) return null;
    const pct = Math.round((pts / tot) * 100);
    return { pct: pct, grade: gradeOf(pct), pts: pts, tot: tot, breakdown: breakdown };
  }

  return { computeHealthScore: computeHealthScore, gradeOf: gradeOf };
});

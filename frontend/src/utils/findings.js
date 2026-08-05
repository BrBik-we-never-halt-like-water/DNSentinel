/**
 * Findings engine — a verbatim port of the legacy `collectFindings()`.
 *
 * Every threshold, severity, title and detail string is unchanged. The ONLY
 * difference is that the state object arrives as a parameter instead of being read
 * from the module-level `S` global, so it is now a pure function and testable.
 *
 * Treat this as security-critical logic: changing a threshold here changes what the
 * product tells people about their domain. Any edit should come from a deliberate
 * product decision, not a refactor.
 */
import { FINDING_META, SEV_RANK, TAB_CAT, CAT_LABEL } from '../constants/legacy.js';
import { whoisExpiryDays } from './format.js';

export function collectFindings(S) {
  const f = [];
  const add = (id, sev, title, detail) => {
    const meta = FINDING_META[id] || FINDING_META[id.replace(/:.*$/, '')] || {};
    f.push({ id, sev, title, detail, tab: meta.tab, fix: meta.fix, snippet: meta.snippet });
  };

  // ── SSL / TLS ──
  if (S.ssl && !S.ssl.error) {
    const cert = S.ssl.certificate || {};
    const days = cert.daysRemaining;
    if (cert.expired || days < 0) add('ssl-expired', 'crit', 'SSL certificate has expired', 'Browsers will block the site until the certificate is renewed.');
    else if (days != null && days < 15) add('ssl-expiring', 'crit', `Certificate expires in ${days} day${days !== 1 ? 's' : ''}`, 'Renew immediately to avoid an outage.');
    else if (days != null && days < 30) add('ssl-expiring', 'high', `Certificate expires in ${days} days`, 'Schedule renewal soon.');
    if (cert.sha1Signed) add('ssl-sha1', 'high', 'Certificate signed with SHA-1', 'SHA-1 is deprecated and considered insecure — reissue with SHA-256.');
    const prot = S.ssl.protocols || {};
    if (prot.sslv3) add('ssl-sslv3', 'crit', 'SSL 3.0 is enabled', 'Obsolete and vulnerable (POODLE) — disable it.');
    if (prot.tls10 || prot.tls11) add('ssl-legacy-tls', 'med', `Legacy TLS ${prot.tls10 ? '1.0' : '1.1'} enabled`, 'Disable TLS 1.0/1.1; require TLS 1.2 or higher.');
    if (!prot.tls13 && prot.tls12 != null) add('ssl-no-tls13', 'low', 'TLS 1.3 not supported', 'Enable TLS 1.3 for better performance and security.');
    const vuln = S.ssl.vulnerabilities || {};
    Object.entries(vuln)
      .filter(([, v]) => v && v.vulnerable)
      .forEach(([k, v]) => add(`ssl-vuln:${k}`, 'high', `TLS vulnerable to ${k}`, v.details || 'Known TLS weakness detected.'));
    const letter = S.ssl.grade?.letter;
    if ((letter === 'A+' || letter === 'A') && days > 30 && !cert.sha1Signed)
      add('ssl-good', 'good', `Strong TLS configuration (grade ${letter})`, `Valid certificate, ${days} days remaining.`);
  }

  // ── Email authentication ──
  if (S.emailsec && !S.emailsec.error) {
    const spf = S.emailsec.spf || {}, dmarc = S.emailsec.dmarc || {}, dkim = S.emailsec.dkim || {};
    if (!spf.present) add('spf-missing', 'high', 'No SPF record', 'Without SPF, attackers can more easily spoof your domain in email.');
    if (!dmarc.present) add('dmarc-missing', 'high', 'No DMARC record', 'DMARC tells receivers how to handle spoofed mail — publish a policy.');
    else if (dmarc.policy === 'none') add('dmarc-none', 'med', 'DMARC policy is "none"', 'Move to quarantine or reject to actually block spoofed mail.');
    else if (dmarc.pct != null && dmarc.pct < 100) add('dmarc-pct', 'low', `DMARC applies to only ${dmarc.pct}% of mail`, 'Raise pct to 100 once confident.');
    if (!dkim.present) add('dkim-missing', 'med', 'No DKIM signature detected', 'DKIM lets receivers verify message integrity.');
    if (spf.present && dmarc.present && (dmarc.policy === 'reject' || dmarc.policy === 'quarantine') && dkim.present)
      add('email-good', 'good', 'Email authentication fully configured', 'SPF, DKIM and an enforcing DMARC policy are all in place.');
  } else if (S.dns?.insights?.checks) {
    const c = S.dns.insights.checks;
    if (!c.spf) add('spf-missing', 'high', 'No SPF record', 'Publish an SPF record to reduce email spoofing.');
    if (!c.dmarc) add('dmarc-missing', 'high', 'No DMARC record', 'Publish a DMARC policy to control spoofed mail.');
  }

  // ── Blacklist ──
  if (S.bl?.results) {
    const listed = S.bl.results.filter((r) => r.listed);
    if (listed.length) add('bl-listed', 'crit', `Listed on ${listed.length} blacklist${listed.length !== 1 ? 's' : ''}`, 'Being blacklisted harms email deliverability and reputation — request delisting.');
    else add('bl-clean', 'good', 'Not on any monitored blacklist', 'Clean reputation across checked DNSBLs.');
  }

  // ── DNS hygiene ──
  if (S.dns?.insights?.checks) {
    const c = S.dns.insights.checks;
    if (!c.caa) add('caa-missing', 'low', 'No CAA record', 'Any certificate authority can currently issue certificates for this domain.');
    if (!c.mx) add('mx-none', 'low', 'No MX records', 'This domain cannot receive email — fine if that is intentional.');
    const recs = S.dns.summary?.totalRecords ?? S.dns.totals?.records;
    if (recs > 0 && c.caa) add('dns-good', 'good', 'DNS hygiene looks solid', `${recs} records resolved; CAA restricts certificate issuance.`);
  }

  // ── WHOIS / registration expiry ──
  if (S.whois && !S.whois.error && S.whois.rawData) {
    const days = S.whois.expiresAt
      ? Math.floor((Date.parse(S.whois.expiresAt) - Date.now()) / 864e5)
      : whoisExpiryDays(S.whois.rawData);
    if (days != null) {
      if (days <= 0) add('whois-expiring', 'crit', 'Domain registration has EXPIRED', 'The domain can be deleted or claimed by someone else — renew immediately.');
      else if (days < 30) add('whois-expiring', 'crit', `Domain registration expires in ${days} day${days !== 1 ? 's' : ''}`, 'Losing the registration means losing the domain — renew now.');
      else if (days < 90) add('whois-expiring', 'high', `Domain registration expires in ${days} days`, 'Renew soon or enable auto-renew at your registrar.');
      else add('whois-good', 'good', 'Domain registration healthy', `${days} days until registration expiry.`);
    }
  }

  // ── DNSSEC ──
  if (S.dnssec && !S.dnssec.error) {
    if (S.dnssec.rating === 'not_configured') add('dnssec-off', 'med', 'DNSSEC not enabled', 'DNSSEC protects against DNS spoofing and cache poisoning.');
    else if (S.dnssec.rating === 'incomplete') add('dnssec-incomplete', 'low', 'DNSSEC signed but chain incomplete', 'DNSKEY present but no DS record at the parent — complete the chain of trust.');
    else if (S.dnssec.rating === 'good') add('dnssec-good', 'good', 'DNSSEC properly configured', 'Full chain of trust validated.');
  }
  if (S.dnssecChain && !S.dnssecChain.error && S.dnssecChain.status === 'partial')
    add('dnssecchain-broken', 'high', 'DNSSEC chain has validation issues', (S.dnssecChain.issues || []).slice(0, 2).join(' · ') || 'Signed, but the chain of trust does not fully validate.');

  // ── Subdomain takeover ──
  if (S.takeover && !S.takeover.error) {
    const v = S.takeover.vulnerabilities || [];
    if (v.length) add('takeover-found', 'crit', `${v.length} possible subdomain takeover${v.length !== 1 ? 's' : ''}`, 'Dangling CNAMEs point to unclaimed services — remove or reclaim them.');
    else
      add('takeover-clean', 'good', 'No subdomain takeover risks found',
        (S.takeover.results || []).length ? `All ${S.takeover.results.length} third-party CNAMEs appear safe.` : 'No CNAMEs pointing at third-party services.');
  }

  // ── Open ports ──
  if (S.ports?.ports) {
    const RISKY = { 21: 'FTP', 23: 'Telnet', 3306: 'MySQL', 5432: 'PostgreSQL', 3389: 'RDP' };
    const exposed = S.ports.ports.filter((p) => p.open && RISKY[p.port]).map((p) => `${RISKY[p.port]} (${p.port})`);
    if (exposed.length) add('ports-risky', 'med', `Sensitive service${exposed.length !== 1 ? 's' : ''} exposed`, `Publicly reachable: ${exposed.join(', ')}. Restrict with a firewall.`);
    else add('ports-good', 'good', 'No sensitive ports exposed', 'No database, FTP, Telnet or RDP ports reachable from the internet.');
  }

  // ── Security headers ──
  if (S.headers && !S.headers.error && S.headers.analysis?.checks) {
    const checks = S.headers.analysis.checks;
    Object.entries(checks).forEach(([name, c]) => {
      if (name === 'Content-Security-Policy') return; // covered in depth by the CSP tab
      if (c.deprecated && !c.passed) add('headers-missing', 'low', `Deprecated header: ${name}`, 'Remove it — it can introduce vulnerabilities in older browsers.');
      else if (!c.passed) {
        if (name === 'Strict-Transport-Security') add('headers-hsts', 'med', 'Missing HSTS header', 'Browsers can still be tricked into plain-HTTP connections (SSL stripping).');
        else add(`headers-missing:${name}`, 'low', `Missing header: ${name}`, c.detail && c.detail !== 'missing' ? c.detail : 'A one-line, free protection worth adding.');
      }
    });
    if ((S.headers.analysis.score || 0) >= 80) add('headers-good', 'good', `Strong security headers (${S.headers.analysis.score}/100)`, 'The important browser protections are in place.');
  }
  if (S.hsts && !S.hsts.error && S.hsts.preloaded === false && S.hsts.eligible)
    add('hsts-preload', 'low', 'Not on the HSTS preload list', 'Eligible for preload — submit to harden against SSL-stripping.');

  // ── Propagation ──
  if (S.prop && !S.prop.error && Array.isArray(S.prop.results)) {
    const vals = S.prop.results.filter((r) => r.status === 'ok' && (r.records || []).length > 0).map((r) => (r.records || []).map((x) => x.value).sort().join(','));
    if (vals.length >= 2 && new Set(vals).size > 1) add('prop-inconsistent', 'med', 'DNS answers differ between resolvers', 'Some visitors may reach a different server — recent change still propagating, or a misconfiguration.');
    else if (vals.length >= 2) add('prop-good', 'good', 'DNS consistent worldwide', `${vals.length} global resolvers agree.`);
  }

  // ── MX / SMTP ──
  if (S.mx && !S.mx.error && Array.isArray(S.mx.mxServers) && S.mx.mxServers.length) {
    const servers = S.mx.mxServers;
    const noTls = servers.filter((s) => s.smtp && s.smtp.starttls === false);
    if (noTls.length) add('mx-nostarttls', 'med', `${noTls.length} mail server${noTls.length !== 1 ? 's' : ''} without STARTTLS`, 'Inbound mail to these servers can be read in transit.');
    if (servers.length === 1) add('mx-single', 'low', 'Single mail server', 'One MX record — mail bounces if that server goes down.');
    if (servers.length >= 2 && !noTls.length) add('mx-good', 'good', 'Mail infrastructure redundant and encrypted', `${servers.length} MX servers, all supporting STARTTLS.`);
  }

  // ── MTA-STS / DANE ──
  if (S.mtasts && !S.mtasts.error && S.dns?.insights?.checks?.mx) {
    const m = S.mtasts.mtaSts || {};
    if (!m.present) add('mtasts-missing', 'low', 'No MTA-STS policy', 'Encryption of mail delivered to you can be silently stripped by an attacker in the middle.');
    else if (m.policy && m.policy.mode !== 'enforce') add('mtasts-testing', 'low', `MTA-STS in "${m.policy.mode}" mode`, 'The policy exists but is not enforced yet.');
    else if (m.present) add('mtasts-good', 'good', 'MTA-STS enforced', 'Mail servers must deliver to you over verified TLS.');
  }

  // ── OCSP ──
  if (S.ocsp && !S.ocsp.error) {
    if (S.ocsp.stapling && S.ocsp.stapling.supported === false && S.ocsp.ocsp?.supported)
      add('ocsp-nostapling', 'low', 'OCSP stapling not enabled', 'Revocation checks are slower and leak visitor info to the CA.');
    else if (S.ocsp.stapling?.supported) add('ocsp-good', 'good', 'OCSP stapling enabled', 'Fast, private certificate revocation checking.');
  }

  // ── Redirect chain ──
  if (S.redirect && !S.redirect.error && Array.isArray(S.redirect.chain) && S.redirect.chain.length) {
    const chain = S.redirect.chain;
    const last = chain[chain.length - 1];
    const finalUrl = last.redirectTo || last.url || '';
    if (finalUrl.startsWith('http://')) add('redirect-nohttps', 'high', 'Site not redirecting to HTTPS', 'Visitors typing the bare domain stay on unencrypted HTTP.');
    else if (chain.length > 4) add('redirect-long', 'low', `Redirect chain has ${chain.length} hops`, 'Each hop adds latency to every first visit.');
    else if (finalUrl.startsWith('https://')) add('redirect-good', 'good', 'Redirects cleanly to HTTPS', `${chain.length} hop${chain.length !== 1 ? 's' : ''} to the final secure URL.`);
  }

  // ── CSP ──
  if (S.csp && !S.csp.error) {
    if (!S.csp.present) add('csp-missing', 'med', 'No Content-Security-Policy', 'The primary browser defence against XSS is absent.');
    else {
      const unsafe = (S.csp.issues || []).filter((i) => /unsafe-(inline|eval)/i.test(i));
      if (unsafe.length) add('csp-unsafe', 'med', 'CSP allows unsafe-inline / unsafe-eval', 'These directives largely defeat the purpose of CSP.');
      else if ((S.csp.score || 0) >= 80) add('csp-good', 'good', `Strong CSP (grade ${S.csp.grade || 'A'})`, 'Well-restricted content sources.');
    }
  }

  // ── CORS ──
  if (S.cors && !S.cors.error && S.cors.cors?.enabled) {
    const c = S.cors.cors;
    if (c.origin === '*' && c.credentials) add('cors-wide', 'high', 'CORS wildcard with credentials', 'Any website can read authenticated responses from this origin.');
  }

  // ── IPv6 ──
  if (S.ipv6 && !S.ipv6.error) {
    if (!(S.ipv6.ipv6 || []).length) add('ipv6-missing', 'low', 'No IPv6 (AAAA) address', 'IPv6-first networks reach this site via slower translation layers.');
    else if (S.ipv6.dualStack) add('ipv6-good', 'good', 'Dual-stack IPv4 + IPv6', 'Reachable natively on both address families.');
  }

  // ── Reachability ──
  if (S.trace && !S.trace.error && S.trace.hasIPv4 === false && S.trace.hasIPv6 === false)
    add('trace-unreachable', 'high', 'Host does not resolve to any address', 'No A or AAAA records answered — the site is unreachable.');

  // ── HTTP features ──
  if (S.http && !S.http.error && (S.http.score || 0) >= 80)
    add('http-good', 'good', `Modern HTTP setup (${S.http.score}/100)`, 'HTTP/2+, compression and key headers in place.');

  // ── Typosquatting ──
  if (S.typosquat?.results) {
    const reg = S.typosquat.results.filter((r) => r.registered).length;
    if (reg > 0) add('typosquat-found', 'low', `${reg} look-alike domain${reg !== 1 ? 's' : ''} registered`, 'Potential typosquats are registered — monitor for phishing/brand abuse.');
    else add('typosquat-clean', 'good', 'No typosquats registered', `${S.typosquat.total || S.typosquat.results.length} look-alike variants checked — none registered.`);
  }

  f.sort((a, b) => SEV_RANK[a.sev] - SEV_RANK[b.sev]);
  return f;
}

/** Per-category severity tallies for the tab strip (legacy `catIssueCounts`). */
export function catIssueCounts(S) {
  const counts = {};
  Object.keys(CAT_LABEL).forEach((c) => {
    counts[c] = { crit: 0, high: 0, med: 0, low: 0, good: 0 };
  });
  collectFindings(S).forEach((x) => {
    const cat = TAB_CAT[x.tab];
    if (cat && counts[cat]) counts[cat][x.sev]++;
  });
  return counts;
}

/** Total non-passing issues in a category (drives the tab badge). */
export const issueTotal = (c) => c.crit + c.high + c.med + c.low;

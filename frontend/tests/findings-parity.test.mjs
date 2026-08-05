/**
 * Full-coverage parity: legacy vs ported collectFindings over fixtures that
 * deliberately exercise every branch (worst-case, best-case, live, and empty).
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPW = path.join(HERE, 'fixtures');
const FRONTEND = path.join(HERE, '..');
const legacySrc = fs.readFileSync(path.join(SPW, 'legacy-app.js'), 'utf8');

function extractBlock(src, header) {
  const i = src.indexOf(header);
  if (i < 0) throw new Error('not found: ' + header);
  const open = src.indexOf('{', i);
  let depth = 0, quote = null;
  for (let j = open; j < src.length; j++) {
    const c = src[j], prev = src[j - 1];
    if (quote) { if (c === quote && prev !== '\\') quote = null; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error('unbalanced: ' + header);
}

const legacyCode = [
  extractBlock(legacySrc, 'const SEV_RANK'),
  extractBlock(legacySrc, 'const FINDING_META'),
  extractBlock(legacySrc, 'function parseWhois'),
  extractBlock(legacySrc, 'function whoisExpiryDays'),
  extractBlock(legacySrc, 'function collectFindings'),
].join('\n');

const { collectFindings: ported } = await import(
  'file://' + FRONTEND.replace(/\\/g, '/') + '/src/utils/findings.js'
);

const EMPTY = {
  dns: null, ssl: null, emailsec: null, bl: null, whois: null, headers: null,
  dnssec: null, prop: null, mx: null, trace: null, tech: null, http: null,
  redirect: null, cors: null, robots: null, ct: null, takeover: null, hsts: null,
  csp: null, typosquat: null, ipv6: null, dnssecChain: null, ocsp: null,
  mtasts: null, ports: null, geoip: null,
};

const read = (f) => JSON.parse(fs.readFileSync(path.join(SPW, f), 'utf8'));

// ── Fixture A: everything broken (drives crit/high/med/low branches) ──
const WORST = {
  ...EMPTY,
  ssl: {
    certificate: { expired: true, daysRemaining: -5, sha1Signed: true },
    protocols: { sslv3: true, tls10: true, tls11: true, tls12: true, tls13: false },
    vulnerabilities: { heartbleed: { vulnerable: true, details: 'CVE-2014-0160' }, robot: { vulnerable: true } },
    grade: { letter: 'F' },
  },
  emailsec: { spf: { present: false }, dmarc: { present: false }, dkim: { present: false } },
  bl: { results: [{ listed: true, ip: '1.2.3.4', blacklist: 'spamhaus' }, { listed: true, ip: '1.2.3.4', blacklist: 'barracuda' }] },
  dns: { insights: { checks: { spf: false, dmarc: false, caa: false, mx: false } }, summary: { totalRecords: 3 } },
  whois: { rawData: 'Registry Expiry Date: 2020-01-01T00:00:00Z' },
  dnssec: { rating: 'not_configured' },
  dnssecChain: { status: 'partial', issues: ['DS missing at parent', 'RRSIG expired'] },
  takeover: { vulnerabilities: [{ host: 'x.example.com' }], results: [{}] },
  ports: { ports: [{ port: 3306, open: true }, { port: 23, open: true }, { port: 443, open: true }] },
  headers: { analysis: { score: 10, checks: { 'Strict-Transport-Security': { passed: false }, 'X-Frame-Options': { passed: false, detail: 'missing' }, 'X-XSS-Protection': { passed: false, deprecated: true } } } },
  hsts: { preloaded: false, eligible: true },
  prop: { results: [{ status: 'ok', records: [{ value: '1.1.1.1' }] }, { status: 'ok', records: [{ value: '2.2.2.2' }] }] },
  mx: { mxServers: [{ smtp: { starttls: false } }] },
  mtasts: { mtaSts: { present: false } },
  ocsp: { stapling: { supported: false }, ocsp: { supported: true } },
  redirect: { chain: [{ url: 'http://a' }, { url: 'http://b', redirectTo: 'http://final' }] },
  csp: { present: false },
  cors: { cors: { enabled: true, origin: '*', credentials: true } },
  ipv6: { ipv6: [] },
  trace: { hasIPv4: false, hasIPv6: false },
  http: { score: 20 },
  typosquat: { results: [{ registered: true }, { registered: true }, { registered: false }], total: 3 },
};

// ── Fixture B: everything healthy (drives every 'good' branch) ──
const BEST = {
  ...EMPTY,
  ssl: { certificate: { expired: false, daysRemaining: 200, sha1Signed: false }, protocols: { sslv3: false, tls10: false, tls11: false, tls12: true, tls13: true }, vulnerabilities: {}, grade: { letter: 'A+' } },
  emailsec: { spf: { present: true }, dmarc: { present: true, policy: 'reject', pct: 100 }, dkim: { present: true } },
  bl: { results: [{ listed: false }, { listed: false }] },
  dns: { insights: { checks: { spf: true, dmarc: true, caa: true, mx: true } }, summary: { totalRecords: 42 } },
  whois: { rawData: 'x', expiresAt: new Date(Date.now() + 400 * 864e5).toISOString() },
  dnssec: { rating: 'good' },
  takeover: { vulnerabilities: [], results: [{}, {}] },
  ports: { ports: [{ port: 443, open: true }] },
  headers: { analysis: { score: 95, checks: { 'Strict-Transport-Security': { passed: true } } } },
  prop: { results: [{ status: 'ok', records: [{ value: '1.1.1.1' }] }, { status: 'ok', records: [{ value: '1.1.1.1' }] }] },
  mx: { mxServers: [{ smtp: { starttls: true } }, { smtp: { starttls: true } }] },
  mtasts: { mtaSts: { present: true, policy: { mode: 'enforce' } } },
  ocsp: { stapling: { supported: true } },
  redirect: { chain: [{ url: 'https://a', redirectTo: 'https://final' }] },
  csp: { present: true, score: 92, grade: 'A', issues: [] },
  ipv6: { ipv6: ['::1'], dualStack: true },
  http: { score: 92 },
  typosquat: { results: [{ registered: false }], total: 1 },
};

// ── Fixture C: partial / mid-range thresholds ──
const MID = {
  ...EMPTY,
  ssl: { certificate: { daysRemaining: 20, sha1Signed: false }, protocols: { tls12: true, tls13: false }, vulnerabilities: {}, grade: { letter: 'B' } },
  emailsec: { spf: { present: true }, dmarc: { present: true, policy: 'none' }, dkim: { present: true } },
  whois: { rawData: 'x', expiresAt: new Date(Date.now() + 60 * 864e5).toISOString() },
  dnssec: { rating: 'incomplete' },
  mtasts: { mtaSts: { present: true, policy: { mode: 'testing' } }, }, dns: { insights: { checks: { mx: true, caa: true, spf: true, dmarc: true } }, summary: { totalRecords: 9 } },
  csp: { present: true, issues: ["'unsafe-inline' allowed in script-src"], score: 40 },
  redirect: { chain: [{ url: 'https://1' }, { url: 'https://2' }, { url: 'https://3' }, { url: 'https://4' }, { url: 'https://5', redirectTo: 'https://final' }] },
};

const live = read('r_dns-lookup.json');
const LIVE = { ...EMPTY, dns: live.lookups[0], ssl: read('r_ssl.json'), emailsec: read('r_email-security.json'), bl: read('r_blacklist-check.json') };


// ── WHOIS parsing edge cases (regression guard for whoisExpiryDays) ──
const mkWhois = (raw) => ({ ...EMPTY, whois: { rawData: raw } });
const soon = new Date(Date.now() + 10 * 864e5).toISOString();
const far  = new Date(Date.now() + 500 * 864e5).toISOString();
const WHOIS_CASES = {
  W_registry:   mkWhois('Registry Expiry Date: ' + soon),
  W_registrar:  mkWhois('Registrar Registration Expiration Date: ' + far),
  W_expiration: mkWhois('Expiration Date: ' + soon),
  W_paidtill:   mkWhois('paid-till: ' + soon),          // legacy IGNORES this key
  W_redacted:   mkWhois('Registry Expiry Date: REDACTED FOR PRIVACY'),
  W_httpval:    mkWhois('Registry Expiry Date: https://example.com/whois'),
  W_garbage:    mkWhois('Registry Expiry Date: not-a-date'),
  W_multi:      mkWhois(['Registry Expiry Date: ' + soon, 'Registry Expiry Date: ' + far].join('\n')),
  W_none:       mkWhois('Registrar: Example Inc'),
};

const FIXTURES = { WORST, BEST, MID, LIVE, EMPTY, ...WHOIS_CASES };

const shape = (list) =>
  list.map((x) => ({
    id: x.id, sev: x.sev, title: x.title, detail: x.detail, tab: x.tab, fix: x.fix,
    snippet: typeof x.snippet === 'function' ? x.snippet('example.com') : null,
  }));

let failures = 0;
const seenIds = new Set();

for (const [name, S] of Object.entries(FIXTURES)) {
  const ctx = { S, console };
  vm.createContext(ctx);
  vm.runInContext(legacyCode + '\n;globalThis.__f = collectFindings;', ctx);
  const a = shape(ctx.__f());
  const b = shape(ported(S));
  a.forEach((x) => seenIds.add(x.id));

  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  const ok = ja === jb;
  if (!ok) failures++;
  console.log(
    (ok ? 'PASS' : 'FAIL') + '  ' + name.padEnd(6) +
    ' legacy=' + String(a.length).padStart(2) + ' ported=' + String(b.length).padStart(2) +
    '  sev[' + ['crit', 'high', 'med', 'low', 'good'].map((s) => s + ':' + a.filter((x) => x.sev === s).length).join(' ') + ']'
  );
  if (!ok) {
    const la = JSON.stringify(a, null, 1).split('\n'), lb = JSON.stringify(b, null, 1).split('\n');
    for (let i = 0; i < Math.max(la.length, lb.length); i++)
      if (la[i] !== lb[i]) console.log('   line ' + i + '\n     legacy: ' + la[i] + '\n     ported: ' + lb[i]);
  }
}

console.log('\ndistinct finding types exercised: ' + seenIds.size);
console.log(failures === 0 ? '\n*** ALL FIXTURES BYTE-IDENTICAL ***' : '\n*** ' + failures + ' FIXTURE(S) DIVERGED ***');
process.exit(failures === 0 ? 0 : 1);

/**
 * API layer — a direct port of the legacy fetchJSON/runPool pair.
 *
 * Endpoints, request bodies, retry behaviour and the concurrency limit are all
 * preserved exactly: same POST + JSON body shape, same one-retry-on-5xx/network
 * policy with the same backoff, and the same pool of 6 in-flight requests.
 * Nothing here changes what the server receives or how a response is interpreted.
 */

/** Endpoint per check id — mirrors the legacy `go()` task list one-for-one. */
export const ENDPOINTS = {
  dns: '/api/dns-lookup',
  ssl: '/api/ssl',
  bl: '/api/blacklist-check',
  emailsec: '/api/email-security',
  whois: '/api/whois',
  headers: '/api/security-headers',
  dnssec: '/api/dnssec',
  prop: '/api/propagation',
  mx: '/api/mx-smtp',
  trace: '/api/trace',
  tech: '/api/tech',
  http: '/api/http',
  redirect: '/api/redirect',
  cors: '/api/cors',
  robots: '/api/robots',
  ct: '/api/cert-transparency',
  geoip: '/api/geoip',
  ports: '/api/port-scan',
  ocsp: '/api/ocsp',
  mtasts: '/api/mta-sts',
  takeover: '/api/subdomain-takeover',
  hsts: '/api/hsts-preload',
  csp: '/api/csp-analyzer',
  typosquat: '/api/typosquat',
  ipv6: '/api/ipv6',
  dnssecChain: '/api/dnssec-chain',
};

/**
 * Request bodies, in the same declaration order the legacy app used. Order matters
 * for perceived speed: headline stats and the default-visible core panels resolve
 * first because they enter the pool first.
 */
export const CHECK_ORDER = [
  ['dns', { resolver: 'balanced' }],
  ['ssl', {}],
  ['bl', {}],
  ['emailsec', {}],
  ['whois', {}],
  ['headers', {}],
  ['dnssec', {}],
  ['prop', { type: 'A' }],
  ['mx', {}],
  ['trace', {}],
  ['tech', {}],
  ['http', {}],
  ['redirect', {}],
  ['cors', {}],
  ['robots', {}],
  ['ct', {}],
  ['geoip', {}],
  ['ports', {}],
  ['ocsp', {}],
  ['mtasts', {}],
  ['takeover', {}],
  ['hsts', {}],
  ['csp', {}],
  ['typosquat', {}],
  ['ipv6', {}],
  ['dnssecChain', {}],
];

/** Abort-aware sleep (legacy `sleep`). */
export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(t);
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        },
        { once: true }
      );
    }
  });
}

/**
 * POST JSON with one retry on 5xx / network failure (legacy `fetchJSON`).
 * 4xx responses are returned as-is so validation and rate-limit messages from the
 * server still reach the UI unchanged.
 */
export async function fetchJSON(url, body, signal, attempt = 0) {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!r.ok && r.status >= 500 && attempt < 1) {
      await sleep(600, signal);
      return fetchJSON(url, body, signal, attempt + 1);
    }
    return await r.json();
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    if (attempt < 1) {
      await sleep(600, signal);
      return fetchJSON(url, body, signal, attempt + 1);
    }
    throw e;
  }
}

/**
 * Run async thunks with a fixed number in flight (legacy `runPool`).
 * 6 concurrent requests keeps the UI responsive and stays under the server's
 * per-IP rate limit — do not raise without checking server.js limits.
 */
export async function runPool(tasks, concurrency, signal) {
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (i < tasks.length) {
      if (signal?.aborted) return;
      const idx = i++;
      await tasks[idx]();
    }
  });
  await Promise.all(workers);
}

/* ── Account / sync endpoints (unchanged paths, methods and payloads) ────────── */

export const authApi = {
  me: () => fetch('/api/auth/me').then((r) => r.json()),
  request: (email) =>
    fetch('/api/auth/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }),
  logout: () => fetch('/api/auth/logout', { method: 'POST' }),
};

export const syncApi = {
  getHistory: () => fetch('/api/history').then((r) => r.json()),
  putHistory: (domain, snapshot) =>
    fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, snapshot }),
    }).catch(() => {}),
  getAlerts: () => fetch('/api/alerts').then((r) => r.json()),
  putAlert: (domain, emailEnabled) =>
    fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, emailEnabled }),
    }).catch(() => {}),
  deleteAlert: (domain) =>
    fetch('/api/alerts/' + encodeURIComponent(domain), { method: 'DELETE' }).catch(() => {}),
  getSettings: () => fetch('/api/settings').then((r) => r.json()),
  putSettings: (payload) =>
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  getKeys: () => fetch('/api/keys').then((r) => r.json()),
  createKey: (label) =>
    fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    }),
  deleteKey: (key) => fetch('/api/keys/' + encodeURIComponent(key), { method: 'DELETE' }),
};

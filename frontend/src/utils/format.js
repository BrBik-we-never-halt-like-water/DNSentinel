/**
 * Formatting / clipboard / download helpers, ported from the legacy app.
 *
 * Note there is no `esc()` / `escAttr()` equivalent here: the legacy app built HTML
 * strings and had to escape values by hand to avoid XSS. React escapes interpolated
 * text automatically, so those helpers are intentionally dropped — the protection is
 * now structural rather than manual.
 */

/** Normalise user input to a bare hostname (legacy `norm`) — identical rules. */
export function normalizeDomain(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');
}

/** Relative time for history rows (legacy `relTime`). */
export function relTime(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 30) return days + 'd ago';
  return new Date(ts).toLocaleDateString();
}

/** Country name → flag emoji (legacy `cFlag`). */
export function countryFlag(name) {
  const MAP = {
    'United States': '🇺🇸', 'United Kingdom': '🇬🇧', Germany: '🇩🇪', France: '🇫🇷',
    Netherlands: '🇳🇱', Canada: '🇨🇦', Australia: '🇦🇺', Japan: '🇯🇵', China: '🇨🇳',
    India: '🇮🇳', Singapore: '🇸🇬', Ireland: '🇮🇪', Brazil: '🇧🇷', Sweden: '🇸🇪',
    Switzerland: '🇨🇭', Poland: '🇵🇱', Spain: '🇪🇸', Italy: '🇮🇹', Russia: '🇷🇺',
    'South Korea': '🇰🇷', Finland: '🇫🇮', Norway: '🇳🇴', Denmark: '🇩🇰', Belgium: '🇧🇪',
    Austria: '🇦🇹',
  };
  return MAP[name] || '🌍';
}

/** Grade → design-system colour class set, replacing the legacy inline colours. */
export function gradeTone(pct) {
  if (pct >= 85) return 'ok';
  if (pct >= 70) return 'okish';
  if (pct >= 50) return 'warn';
  return 'err';
}

export const TONE_TEXT = {
  ok: 'text-state-ok',
  okish: 'text-state-ok',
  warn: 'text-state-warn',
  err: 'text-state-err',
};

/**
 * Clipboard with the legacy textarea fallback, so copy still works on
 * non-secure origins and older browsers (legacy `safeCopy`).
 */
export function safeCopy(text) {
  const s = String(text ?? '');
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(s).catch(() => legacyCopy(s));
  }
  return Promise.resolve(legacyCopy(s));
}

function legacyCopy(s) {
  try {
    const ta = document.createElement('textarea');
    ta.value = s;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Trigger a client-side file download (legacy `downloadFile`). */
export function downloadFile(filename, content, mime = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Days until the domain's registration expires (legacy `whoisExpiryDays`).
 *
 * Deliberately routed through parseWhois() rather than a direct regex over the raw
 * text — parseWhois normalises registrar key aliases and drops REDACTED / URL
 * values, and only these four normalised keys are consulted. A looser regex would
 * pick up fields the legacy app ignored (e.g. `paid-till`) and change which domains
 * report a critical expiry finding.
 */
export function whoisExpiryDays(raw) {
  const p = parseWhois(raw || '');
  const v =
    p['registry expiry date'] ||
    p['registrar registration expiration date'] ||
    p['expiry date'] ||
    p['expiration date'];
  if (!v) return null;
  const t = Date.parse(Array.isArray(v) ? v[0] : v);
  return Number.isNaN(t) ? null : Math.floor((t - Date.now()) / 864e5);
}

/** Parse raw WHOIS text into a key→value(s) map (legacy `parseWhois`, unchanged rules). */
export function parseWhois(raw) {
  const o = {};
  for (const line of String(raw || '').split('\n')) {
    const m = line.match(/^\s*([^:%>\n]+):\s*(.*)$/);
    if (!m) continue;
    let k = m[1].trim().toLowerCase();
    const v = m[2].trim();
    if (!v || v.includes('REDACTED') || v.startsWith('http')) continue;

    // Normalize aliases for common registrars (e.g. GoDaddy)
    if (k.includes('expiration date') || k.includes('expiry date')) k = 'registry expiry date';
    if (k === 'registrar name') k = 'registrar';

    if (o[k]) {
      if (!Array.isArray(o[k])) o[k] = [o[k]];
      if (!o[k].includes(v)) o[k].push(v);
    } else {
      o[k] = v;
    }
  }
  return o;
}

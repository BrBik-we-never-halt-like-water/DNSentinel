/**
 * localStorage access.
 *
 * IMPORTANT: the key names keep their legacy `hetops_` prefix on purpose. They
 * predate the DNSentinel rename, and existing users have real data under them —
 * scan history, watchlists and comparison snapshots. Renaming these keys would
 * silently orphan that data on first load, so they must not be "tidied up".
 */
export const KEYS = {
  EXPLAIN: 'hetops_explain_open',
  SNAPS: 'hetops_dns_snaps',
  WATCH: 'hetops_dns_watch',
  HIST: 'hetops_dns_hist',
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or privacy mode — degrade silently, exactly as the legacy app did */
  }
}

/* ── Explainer open/closed state, per result tab ─────────────────────────────── */
export const getExplainPrefs = () => readJSON(KEYS.EXPLAIN, {});
export const setExplainPref = (tab, open) => {
  const p = getExplainPrefs();
  p[tab] = open;
  writeJSON(KEYS.EXPLAIN, p);
};

/* ── Recent search terms (search box dropdown) ───────────────────────────────── */
export const getSearchHistory = () => readJSON(KEYS.HIST, []);
export function pushSearchHistory(domain) {
  const list = getSearchHistory().filter((d) => d !== domain);
  list.unshift(domain);
  writeJSON(KEYS.HIST, list.slice(0, 8));
  return getSearchHistory();
}
export function clearSearchHistory() {
  writeJSON(KEYS.HIST, []);
  return [];
}

/* ── Report snapshots, used by Compare & History ─────────────────────────────── */
export const getSnaps = () => readJSON(KEYS.SNAPS, []);
export const setSnaps = (list) => writeJSON(KEYS.SNAPS, list);
export function clearSnaps() {
  writeJSON(KEYS.SNAPS, []);
}

/* ── Monitoring watchlist ────────────────────────────────────────────────────── */
export const getWatch = () => readJSON(KEYS.WATCH, []);
export const setWatch = (list) => writeJSON(KEYS.WATCH, list);
export const isWatched = (domain) => getWatch().some((w) => w.domain === domain);

/** Clear everything an account synced locally (called on sign-out, as before). */
export function clearAccountCaches() {
  try {
    localStorage.removeItem(KEYS.SNAPS);
    localStorage.removeItem(KEYS.WATCH);
    localStorage.removeItem(KEYS.HIST);
  } catch {
    /* ignore */
  }
}

# DNSentinel frontend — React + Vite + TailwindCSS migration

Migration of the single-file `public/index.html` app (4,951 lines; a 3,137-line inline
script) to a modular React codebase, without touching the backend.

**Status: live.** The React app is served at `/`; the original single-file app is kept
at `/legacy.html` for reference and instant rollback.

---

## Where each version lives

| URL | What it serves |
| --- | --- |
| `/` | this React app |
| `/legacy.html` | the original single-file app, kept for rollback |

The build outputs into `public/`, which the existing Express static middleware already
serves. The Dockerfile has no frontend build step — it copies the repo and runs
`server.js` — so `public/` is the deploy artifact and the built output is committed.
`server.js` was never modified.

---

## Commands

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173  — proxies /api and /shared to Express on :3000
npm run build    # → ../public/  (clears public/assets first)
npm test         # legacy-vs-ported findings equivalence
```

Start the API server separately (`npm start` in the repo root, port 3000).

> On Windows the Vite dev server may bind IPv6-only. Use `http://localhost:5173`
> rather than `http://127.0.0.1:5173` if the page does not load.

---

## Architecture

```
src/
├── constants/legacy.js     AUTO-EXTRACTED from the legacy app — do not hand-edit
├── utils/
│   ├── api.js              endpoints, fetchJSON, runPool, auth/sync calls
│   ├── findings.js         verbatim port of collectFindings() — security-critical
│   ├── format.js           normalizeDomain, parseWhois, whoisExpiryDays, clipboard
│   ├── health.js           wraps window.HetOpsScore (shared with the server)
│   ├── monitor.js          watchlist, status probing, diffStatus
│   ├── snapshots.js        report snapshots + the compare metric table
│   └── storage.js          localStorage — legacy hetops_* keys preserved
├── hooks/
│   ├── useScan.js          port of go(): 26 checks, pool of 6, abort tokens
│   └── useToasts.jsx       toast context + live region
└── components/
    ├── ui/                 Button, Card, Pill, Input, Skeleton, InfoRow, states
    ├── layout/AppShell     Navbar, Footer, decorative scene
    ├── sections/Landing    Hero, Search, TrustStrip, Features, Process, FAQ
    ├── results/ResultsView domain header, stat tiles, scorecard, tabs, overview
    ├── panes/              26 per-check panes + shared.jsx primitives
    └── overlays/           Modal shell, Login, Compare, Monitor, Bulk
```

### Rules this migration follows

1. **No backend, API, endpoint, payload or business-logic changes.** All 26 endpoints
   are called with identical paths and request bodies.
2. **Scoring is not reimplemented.** `public/shared/health-score.js` is `require`d by
   `server.js` and loaded here via a `<script>` tag, so the UI ring, the `/api/scan`
   summary and the README badge cannot drift apart. The bulk scanner uses it too.
3. **`hetops_*` localStorage keys are kept.** They predate the DNSentinel rename;
   renaming them would orphan existing users' history and watchlists.
4. **Security metadata is extracted, not retyped.** `scripts/extract-consts.cjs` lifts
   `FINDING_META`, `EXPLAIN`, `TC`, `TAB_CAT`, `SEV_*` and `CAT_LABEL` out of the
   legacy source verbatim.
5. **`diffStatus` thresholds mirror the server.** `server.js` has its own
   implementation and a unit test for it. The client copy in `utils/monitor.js` must
   stay in step, or in-tab alerts will disagree with the emails the server sends.

---

## Verification

`tests/findings-parity.test.mjs` runs the legacy `collectFindings()` in a VM sandbox
and the ported one over the same fixtures, then diffs the output.

14 fixtures — worst-case, best-case, mid-thresholds, live API payloads, empty, and 9
WHOIS parsing edge cases — exercise **all 56 finding types**. Current result: **output
is byte-identical**.

This test already caught one real regression: an early `whoisExpiryDays` rewrote the
parse as a regex, which matched `paid-till` (a key the legacy code ignores) and did not
skip `REDACTED` values — changing which domains report a *critical* expiry finding. It
is now routed through `parseWhois()` as the original was. **Keep this test green.**

Also verified against a live `github.com` scan: DNS 40 records, SSL grade B (57 days,
4-cert chain), email 80% with the real SPF `~all` softfail warning, blacklist clean,
score 87 (A); DNSSEC chain correctly reporting "not enabled". All 26 endpoints return
HTTP 200, and the 19 server-side tests still pass.

When adding a tab, check `PANE_COMPONENTS` in `ResultsView.jsx` against `TAB_CAT` —
and note pane keys can contain digits (`ipv6`) and hyphens (`dnssec-chain`), so match
on `[a-z0-9-]+` rather than `[a-z-]+`.

---

## Status of the migration

Everything the legacy app did is now in React:

- **26 of 26** result panes
- **4 of 4** overlays — Login, Compare & History, Monitoring + Account, Bulk scan
- score breakdown on the grade ring, explainer open/closed persistence, category
  health dots, branded PDF header, `?domain=` / `?tab=` deep links and URL sync,
  snapshots with grade-change alerts, watchlist with a 15-minute poll, CSV export

Nothing on the backend changed: no endpoint, payload, business rule, validation or
database interaction was touched, and the 19 server-side tests pass unchanged.

---

## Rollback

The previous single-file app is committed at `public/legacy.html` and reachable at
`/legacy.html`. To roll back completely:

```bash
cp public/legacy.html public/index.html
```

That is the whole procedure — `server.js` serves whatever `public/index.html` contains.
Bump the `CACHE` constant in `public/sw.js` afterwards so the service worker does not
keep serving the React shell to returning visitors offline.

---

## Build notes

`public/` is the deploy artifact: the Dockerfile copies the repo and runs `server.js`
with no build step, so `public/index.html` and `public/assets/` are committed.

The build uses `emptyOutDir: false`, because `public/` also holds files it must never
delete — `shared/health-score.js` (required by `server.js` at runtime), `docs.html`
(served at `GET /docs`), `legacy.html`, `sw.js`, `icon.svg`, `manifest.webmanifest`,
`robots.txt`, `sitemap.xml` and `logo.png`. Since that also means old hashed bundles
would pile up forever, `npm run build` first runs `scripts/clean-assets.cjs`, which
empties only `public/assets/`.

---

## Note on measuring the score ring

The header ring animates its arc (`stroke-dashoffset`) over ~0.9s once the score is
known, and the score only exists after the DNS, TLS, email and blacklist checks land.
Headless captures taken too early therefore show an empty ring with the neutral brand
colour — that is the pre-data state, not a defect. Give a capture enough settle time
(virtual-time budget well past the slowest check) before concluding anything about it.

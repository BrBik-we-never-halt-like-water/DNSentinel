/**
 * Report section navigation.
 *
 * Same category → tab hierarchy as before (driven by TAB_CAT), but presented as
 * navigation rather than two stacked strips: a sticky sidebar on large screens, and a
 * horizontal strip below `lg` where a sidebar would eat the width.
 *
 * Sub-sections are revealed only for the open category, so the report reads as a set
 * of destinations instead of one long page.
 */
import { CAT_LABEL, TAB_CAT } from '../../constants/legacy.js';
import { issueTotal } from '../../utils/findings.js';
import { HEALTH_TEXT } from '../../utils/health.js';

export const CATEGORIES = ['overview', ...Object.keys(CAT_LABEL)];

export const TABS_BY_CAT = Object.entries(TAB_CAT).reduce((acc, [tab, cat]) => {
  (acc[cat] ||= []).push(tab);
  return acc;
}, {});

export const TAB_LABEL = {
  dns: 'DNS records', whois: 'WHOIS', geoip: 'GeoIP', propagation: 'Propagation',
  ssl: 'SSL / TLS', security: 'Overview', headers: 'Headers', csp: 'CSP', dnssec: 'DNSSEC',
  'dnssec-chain': 'DNSSEC chain', ocsp: 'OCSP', hsts: 'HSTS', takeover: 'Takeover',
  emailsec: 'Authentication', mx: 'MX / SMTP', mtasts: 'MTA-STS',
  ipv6: 'IPv6', trace: 'Connectivity', ports: 'Ports',
  http: 'HTTP', redirect: 'Redirects', tech: 'Technology', cors: 'CORS', robots: 'Robots',
  ct: 'CT logs', typosquat: 'Typosquats',
};

/** Status dot — shape as well as colour, so it is never colour-only. */
function Dot({ status }) {
  const cls =
    status === 'ok'
      ? 'bg-state-ok'
      : status === 'warn'
        ? 'border-2 border-state-warn bg-transparent'
        : 'border-2 border-red-900/40 bg-state-err';
  return (
    <span
      role="img"
      aria-label={HEALTH_TEXT[status] || status}
      className={`h-[7px] w-[7px] shrink-0 rounded-full ${cls}`}
    />
  );
}

function CountBadge({ n }) {
  if (n == null) return null;
  return (
    <span
      className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
        n > 0 ? 'bg-state-warnSoft text-state-warn' : 'bg-state-okSoft text-state-ok'
      }`}
    >
      {n > 0 ? n : '✓'}
    </span>
  );
}

export function ReportNav({ cat, tab, counts, catHealth, onSelectCat, onSelectTab, variant = 'sidebar', className = '' }) {
  const catMeta = (c) => ({
    label: c === 'overview' ? 'Overview' : CAT_LABEL[c],
    count: c === 'overview' ? null : issueTotal(counts[c] || {}),
  });

  /* ── Horizontal strip (small screens) ─────────────────────────────────────── */
  if (variant === 'strip') {
    return (
      <div className={className}>
        <div
          className="mb-3 flex gap-1.5 overflow-x-auto rounded-2xl border border-line bg-surface p-1.5"
          role="tablist"
          aria-label="Report sections"
        >
          {CATEGORIES.map((c) => {
            const { label, count } = catMeta(c);
            const active = cat === c;
            return (
              <button
                key={c}
                role="tab"
                aria-selected={active}
                onClick={() => onSelectCat(c)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                  active ? 'bg-brand text-white' : 'text-slateGray hover:bg-surface-muted hover:text-ink'
                }`}
              >
                {label}
                {c !== 'overview' && catHealth[c] && <Dot status={catHealth[c]} />}
                {count != null && (
                  <span className={`text-[10px] font-bold ${active ? 'text-white/80' : 'text-slateGray'}`}>
                    {count > 0 ? count : '✓'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {cat !== 'overview' && (
          <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
            {TABS_BY_CAT[cat].map((t) => (
              <button
                key={t}
                onClick={() => onSelectTab(t)}
                aria-current={tab === t}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                  tab === t
                    ? 'border-brand/30 bg-brand-50 text-brand'
                    : 'border-line text-slateGray hover:bg-surface-muted hover:text-ink'
                }`}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── Sticky sidebar (lg and up) ───────────────────────────────────────────── */
  return (
    <nav aria-label="Report sections" className={`lg:sticky lg:top-24 lg:self-start ${className}`}>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {CATEGORIES.map((c) => {
          const { label, count } = catMeta(c);
          const open = cat === c;
          return (
            <div key={c} className="border-b border-line last:border-0">
              <button
                onClick={() => onSelectCat(c)}
                aria-expanded={c === 'overview' ? undefined : open}
                aria-current={open && (c === 'overview' || tab === c) ? 'true' : undefined}
                className={`flex w-full items-center gap-2 px-4 py-3 text-left text-[13.5px] font-semibold transition-colors ${
                  open ? 'bg-brand-50/70 text-brand' : 'text-ink-soft hover:bg-surface-muted'
                }`}
              >
                <span
                  className={`h-4 w-[3px] shrink-0 rounded-full ${open ? 'bg-brand' : 'bg-transparent'}`}
                  aria-hidden="true"
                />
                {label}
                {c !== 'overview' && catHealth[c] && <Dot status={catHealth[c]} />}
                <CountBadge n={count} />
              </button>

              {open && c !== 'overview' && (
                <ul className="pb-2">
                  {TABS_BY_CAT[c].map((t) => (
                    <li key={t}>
                      <button
                        onClick={() => onSelectTab(t)}
                        aria-current={tab === t ? 'page' : undefined}
                        className={`flex w-full items-center py-1.5 pl-9 pr-4 text-left text-[12.5px] transition-colors ${
                          tab === t
                            ? 'font-semibold text-brand'
                            : 'text-slateGray hover:text-ink'
                        }`}
                      >
                        <span
                          className={`mr-2 h-1 w-1 shrink-0 rounded-full ${tab === t ? 'bg-brand' : 'bg-slateGray/40'}`}
                          aria-hidden="true"
                        />
                        {TAB_LABEL[t]}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

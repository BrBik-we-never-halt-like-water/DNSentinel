/**
 * Result panes — migrated one-for-one from the legacy render* functions.
 *
 * Field selection, ordering, thresholds and wording are preserved; only the visual
 * treatment changes. Where the legacy code coloured a value by threshold (e.g. WHOIS
 * expiry) the same breakpoints are used, mapped onto design-system tones.
 */
import { Copy } from 'lucide-react';
import { Card, CardHeader, ErrorBlock, InfoRow, Pill, EmptyState, SectionLabel } from '../ui/index.jsx';
import { TC } from '../../constants/legacy.js';
import { countryFlag, parseWhois, safeCopy } from '../../utils/format.js';
import { useToasts } from '../../hooks/useToasts.jsx';

export { SslPane } from './SslPane.jsx';
export { HttpPane, Ipv6Pane, MtastsPane, TyposquatPane, DnssecChainPane } from './RemainingPanes.jsx';
export { TracePane, TechPane, CtPane, CorsPane, RobotsPane, RedirectPane } from './WebNetworkPanes.jsx';
export { CspPane, TakeoverPane, MxPane } from './CspTakeoverMxPanes.jsx';
export { HeadersPane, HstsPane, OcspPane } from './SecurityPanes.jsx';
export { DnssecPane } from './DnssecPane.jsx';
export { EmailSecPane } from './EmailSecPane.jsx';

/* ── DNS ─────────────────────────────────────────────────────────────────────── */

// Same order and wide-card set as the legacy renderDns().
const DNS_ORDER = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA', 'CAA', 'SRV', 'PTR'];
const DNS_WIDE = new Set(['TXT', 'SOA', 'CAA', 'SRV']);

function RecordTypeBadge({ type }) {
  const c = TC[type] || { bg: 'rgba(148,163,184,.12)', bd: 'rgba(148,163,184,.3)', fg: '#64748B' };
  return (
    <span
      className="shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide"
      style={{ background: c.bg, borderColor: c.bd, color: c.fg }}
    >
      {type}
    </span>
  );
}

function CopyButton({ value }) {
  const { toast } = useToasts();
  return (
    <button
      type="button"
      onClick={async () => {
        await safeCopy(value);
        toast('Copied to clipboard', 'ok', 1600);
      }}
      aria-label="Copy value"
      className="shrink-0 rounded-md border border-line bg-surface p-1.5 text-slateGray opacity-0 transition-all hover:border-brand/40 hover:text-brand focus-visible:opacity-100 group-hover:opacity-100"
    >
      <Copy className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}

/** Per-record secondary line — identical fields to the legacy meta strings. */
function recordMeta(type, r) {
  if (type === 'MX') return `Priority ${r.priority}`;
  if (type === 'SOA') {
    const d = r.details || {};
    return `serial ${d.serial} · refresh ${d.refresh}s · retry ${d.retry}s · expire ${d.expire}s`;
  }
  if (type === 'SRV') return `priority ${r.priority} · weight ${r.weight}`;
  if (type === 'CAA') return `tag: ${r.issue || ''}${r.critical ? ' · critical' : ''}`;
  return null;
}

function DnsCard({ type, records }) {
  // TXT annotation: flag SPF / DMARC presence, as the legacy pane did.
  let annot = null;
  if (type === 'TXT') {
    const spf = records.find((r) => String(r.value || '').toLowerCase().startsWith('v=spf1'));
    const dmarc = records.find((r) => String(r.value || '').toLowerCase().startsWith('v=dmarc1'));
    if (spf || dmarc) {
      annot = [spf ? '✓ SPF present' : null, dmarc ? '✓ DMARC present' : null].filter(Boolean).join(' · ');
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-soft/60 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <RecordTypeBadge type={type} />
          <h3 className="text-[13px] font-semibold text-ink">{type} Records</h3>
        </div>
        <span className="shrink-0 text-xs text-slateGray">
          {records.length} record{records.length !== 1 ? 's' : ''}
        </span>
      </div>

      {records.map((r, i) => {
        const meta = recordMeta(type, r);
        return (
          <div
            key={`${r.value}-${i}`}
            className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border-b border-line/60 px-4 py-2.5 transition-colors last:border-0 hover:bg-brand-50/40"
          >
            <RecordTypeBadge type={type} />
            <div className="min-w-0">
              <p className="break-all font-mono text-[12.5px] leading-relaxed text-ink-soft">{r.value}</p>
              {meta && <p className="mt-0.5 text-[11px] text-slateGray">{meta}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {r.ttl != null && <span className="font-mono text-[10px] text-slateGray/80">TTL {r.ttl}</span>}
              <CopyButton value={r.value} />
            </div>
          </div>
        );
      })}

      {annot && (
        <p className="border-t border-state-warn/15 bg-state-warnSoft px-4 py-2 text-[11px] font-medium text-state-warn">
          {annot}
        </p>
      )}
    </Card>
  );
}

export function DnsPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const res = data.results || {};
  const active = DNS_ORDER.filter((t) => (res[t] || []).length > 0);

  if (!active.length) {
    return (
      <Card>
        <EmptyState title="No DNS records found." description="No records resolved for this domain and record set." />
      </Card>
    );
  }

  const wide = active.filter((t) => DNS_WIDE.has(t));
  const narrow = active.filter((t) => !DNS_WIDE.has(t));

  // Greedy two-column balance by estimated height — same heuristic as the legacy
  // masonry so tall TXT/SOA cards don't leave one column stranded.
  const colL = [], colR = [];
  let hL = 0, hR = 0;
  for (const t of narrow) {
    const est = 52 + (res[t] || []).length * 46;
    if (hL <= hR) { colL.push(t); hL += est; } else { colR.push(t); hR += est; }
  }

  return (
    <div className="space-y-3.5">
      {wide.map((t) => <DnsCard key={t} type={t} records={res[t]} />)}

      {(colL.length > 0 || colR.length > 0) && (
        <div className="grid items-start gap-3.5 lg:grid-cols-2">
          <div className="space-y-3.5">{colL.map((t) => <DnsCard key={t} type={t} records={res[t]} />)}</div>
          <div className="space-y-3.5">{colR.map((t) => <DnsCard key={t} type={t} records={res[t]} />)}</div>
        </div>
      )}

      {data.durationMs && (
        <p className="px-1 text-right text-[11px] text-slateGray">
          Resolved in {data.durationMs}ms · {data.resolver?.profile || 'balanced'} resolver
        </p>
      )}
    </div>
  );
}

/* ── WHOIS ───────────────────────────────────────────────────────────────────── */

// Same field list, labels and order as the legacy renderWhois().
const WHOIS_FIELDS = [
  ['Domain Name', 'domain name'], ['Registrar', 'registrar'], ['IANA ID', 'registrar iana id'],
  ['Registered', 'creation date'], ['Expires', 'registry expiry date'], ['Updated', 'updated date'],
  ['Status', 'domain status'], ['Name Servers', 'name server'], ['DNSSEC', 'dnssec'],
  ['Registrant Org', 'registrant organization'], ['Country', 'registrant country'],
  ['Abuse Email', 'registrar abuse contact email'],
];

export function WhoisPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const raw = data.rawData || '';
  const p = parseWhois(raw);

  const rows = WHOIS_FIELDS.map(([label, key]) => {
    const val = p[key];
    if (!val) return null;
    const text = Array.isArray(val) ? val.join('\n') : String(val);

    // Expiry keeps the legacy thresholds: <0 or <30d red, <90d amber, else green.
    let tone, extra = null;
    if (key === 'registry expiry date') {
      const exp = new Date(Array.isArray(val) ? val[0] : val);
      const days = Math.floor((exp - Date.now()) / 864e5);
      tone = days < 30 ? 'err' : days < 90 ? 'warn' : 'ok';
      extra = days > 0 ? `${days}d left` : 'EXPIRED';
    }
    return { label, text, tone, extra };
  }).filter(Boolean);

  const half = Math.ceil(WHOIS_FIELDS.length / 2);
  const left = rows.filter((_, i) => i < half);
  const right = rows.filter((_, i) => i >= half);

  const Column = ({ title, items }) => (
    <Card className="overflow-hidden">
      <SectionLabel>{title}</SectionLabel>
      <div className="px-5 pb-3">
        {items.length ? (
          items.map((r) => (
            <InfoRow
              key={r.label}
              label={r.label}
              tone={r.tone}
              value={
                <span className="whitespace-pre-line">
                  {r.text}
                  {r.extra && <span className="ml-1.5 font-sans text-[11px] text-slateGray">({r.extra})</span>}
                </span>
              }
            />
          ))
        ) : (
          <p className="py-3 text-[13px] text-slateGray">No fields available.</p>
        )}
      </div>
    </Card>
  );

  return (
    <div className="space-y-3.5">
      {!rows.length && (
        <Card>
          <EmptyState title="Could not parse structured WHOIS data." description="The raw response is available below." />
        </Card>
      )}
      <div className="grid items-start gap-3.5 lg:grid-cols-2">
        <Column title="Registration" items={left} />
        <Column title="Infrastructure" items={right} />
      </div>
      <Card>
        <details>
          <summary className="cursor-pointer list-none px-5 py-3.5 text-[12.5px] font-medium text-slateGray hover:text-ink">
            Raw WHOIS output
          </summary>
          <pre className="max-h-96 overflow-auto border-t border-line bg-surface-soft px-5 py-4 font-mono text-[11px] leading-relaxed text-slateGray">
            {raw}
          </pre>
        </details>
      </Card>
    </div>
  );
}

/* ── Security overview (DNS insights + blacklist) ────────────────────────────── */

export function SecurityPane({ data, all }) {
  // Mirrors legacy renderSec(): five fundamental checks + blacklist detail + notes.
  // Needs two slots at once — blacklist results (`data`) and DNS insights — so it
  // receives the whole state object as `all`.
  const ins = all?.dns?.insights || {};
  const chk = ins.checks || {};
  const notes = ins.notes || [];
  const bl = data?.results || [];
  const isListed = bl.some((r) => r.listed);
  const ips = data?.IPsChecked || 0;
  const blDone = data != null;

  const items = [
    { n: 'SPF Record', ok: chk.spf, d: chk.spf ? 'Sender Policy Framework configured — spoofing restricted' : 'No SPF record — email spoofing risk' },
    { n: 'DMARC Policy', ok: chk.dmarc, d: chk.dmarc ? 'DMARC policy present at _dmarc subdomain' : 'No DMARC record — phishing risk' },
    { n: 'CAA Records', ok: chk.caa, d: chk.caa ? 'CAA restricts certificate issuance to trusted CAs' : 'No CAA — any CA can issue certificates' },
    { n: 'MX Records', ok: chk.mx, d: chk.mx ? 'Mail exchange infrastructure configured' : 'No MX records — email not configured' },
    {
      n: 'Blacklist Status',
      ok: blDone && !isListed && ips > 0,
      d: !blDone ? 'Checking…' : isListed ? `Listed on ${bl.filter((r) => r.listed).length} DNSBL blacklist(s)` : `Clean across ${bl.length} DNSBL checks`,
    },
  ];

  const score = items.filter((i) => i.ok).length;
  const tone = score >= 4 ? 'ok' : score >= 2 ? 'warn' : 'err';
  const TONE_TEXT = { ok: 'text-state-ok', warn: 'text-state-warn', err: 'text-state-err' };
  const TONE_BG = { ok: 'bg-state-ok', warn: 'bg-state-warn', err: 'bg-state-err' };

  return (
    <div className="space-y-3.5">
      <div className="grid items-start gap-3.5 lg:grid-cols-[240px_1fr]">
        <Card className="p-7 text-center">
          <p className="text-2xs font-bold uppercase tracking-[0.14em] text-slateGray">Security score</p>
          <p className={`mt-3 font-display text-5xl font-extrabold leading-none ${TONE_TEXT[tone]}`}>
            {score}
            <span className="text-2xl text-slateGray/60">/5</span>
          </p>
          <p className="mt-2 text-[13px] text-slateGray">
            {score >= 4 ? 'Strong' : score >= 3 ? 'Good' : score >= 2 ? 'Fair' : 'Weak'}
          </p>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div
              className={`h-full rounded-full ${TONE_BG[tone]}`}
              style={{ width: `${(score / 5) * 100}%`, transition: 'width 1.2s cubic-bezier(.4,0,.2,1)' }}
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <SectionLabel>Security checks</SectionLabel>
          {items.map((i) => (
            <div key={i.n} className="flex items-start gap-3.5 border-b border-line/60 px-5 py-3.5 last:border-0">
              <span className={`mt-0.5 text-base ${i.ok ? 'text-state-ok' : 'text-state-err'}`} aria-hidden="true">
                {i.ok ? '✓' : '✗'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-ink">{i.n}</p>
                <p className="mt-0.5 break-words text-[12.5px] leading-relaxed text-slateGray">{i.d}</p>
              </div>
              <Pill tone={i.ok ? 'ok' : 'err'}>{i.ok ? 'PASS' : 'FAIL'}</Pill>
            </div>
          ))}
        </Card>
      </div>

      {isListed && (
        <Card className="border-state-err/25 bg-state-errSoft p-5">
          <p className="mb-2.5 text-[13px] font-bold text-state-err">⚠ Blacklist hits</p>
          {bl.filter((r) => r.listed).map((r, i) => (
            <p key={i} className="py-0.5 font-mono text-[12px] text-ink-soft">
              {r.ip} — {r.blacklist}
            </p>
          ))}
        </Card>
      )}

      {notes.length > 0 && (
        <Card className="border-state-warn/20 bg-state-warnSoft p-5">
          <p className="mb-3 text-[13px] font-bold text-state-warn">Recommendations</p>
          <div className="space-y-1.5">
            {notes.map((n, i) => (
              <p key={i} className="rounded-lg border border-state-warn/15 bg-white/60 px-3.5 py-2 text-[13px] text-ink-soft">
                → {n}
              </p>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── Propagation ─────────────────────────────────────────────────────────────── */

export function PropagationPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const res = data.results || [];
  const allV = res
    .filter((r) => r.status === 'ok' && (r.records || []).length > 0)
    .map((r) => (r.records || []).map((x) => x.value).sort().join(','));
  const consistent = new Set(allV).size <= 1;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-ink">Global DNS propagation</h3>
          <p className="mt-0.5 text-[11px] text-slateGray">
            {data.type || 'A'} records · {data.domain || ''}
          </p>
        </div>
        <Pill tone={consistent ? 'ok' : 'warn'}>{consistent ? '✓ Consistent' : '⚠ Inconsistent'}</Pill>
      </div>

      {res.map((r, i) => (
        <div
          key={i}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-line/60 px-5 py-3 last:border-0 hover:bg-brand-50/30 sm:grid-cols-[150px_minmax(0,1fr)_auto]"
        >
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-ink">{r.name}</p>
            <p className="mt-0.5 truncate text-[11px] text-slateGray">
              {r.location} · {r.ip}
            </p>
          </div>
          <p className="hidden break-all font-mono text-[12px] text-ink-soft sm:block">
            {(r.records || []).map((x) => x.value).join(', ') || '—'}
          </p>
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="font-mono text-[11px] text-slateGray/80">{r.durationMs}ms</span>
            <span className={r.status === 'ok' ? 'text-state-ok' : 'text-state-err'} aria-hidden="true">
              {r.status === 'ok' ? '✓' : '✗'}
            </span>
            <span className="sr-only">{r.status === 'ok' ? 'resolved' : 'failed'}</span>
          </div>
        </div>
      ))}
    </Card>
  );
}

/* ── GeoIP ───────────────────────────────────────────────────────────────────── */

export function GeoPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const g = data.geo || {};
  const fields = [
    ['IP Address', data.target], ['City', g.city], ['Region', g.region],
    ['Country', g.country_name], ['Organization', g.org], ['ASN', g.asn],
  ].filter(([, v]) => v);

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-2">
      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold text-ink">Network information</h3>
        {fields.map(([l, v]) => <InfoRow key={l} label={l} value={v} />)}
      </Card>
      <Card className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <span className="text-6xl leading-none" aria-hidden="true">{countryFlag(g.country_name || '')}</span>
        <p className="text-xl font-bold text-ink">
          {[g.city, g.country_name].filter(Boolean).join(', ') || 'Unknown location'}
        </p>
        <p className="font-mono text-[13px] text-brand">{data.target || ''}</p>
        {g.org && <Pill>{g.org}</Pill>}
      </Card>
    </div>
  );
}

/* ── Ports ───────────────────────────────────────────────────────────────────── */

// Same service labels as the legacy renderPorts() INFO map.
const PORT_INFO = {
  21: { n: 'FTP', d: 'File Transfer' }, 22: { n: 'SSH', d: 'Secure Shell' },
  25: { n: 'SMTP', d: 'Email Send' }, 80: { n: 'HTTP', d: 'Web' },
  110: { n: 'POP3', d: 'Email' }, 143: { n: 'IMAP', d: 'Email' },
  443: { n: 'HTTPS', d: 'Secure Web' }, 465: { n: 'SMTPS', d: 'Secure SMTP' },
  993: { n: 'IMAPS', d: 'Secure IMAP' }, 995: { n: 'POP3S', d: 'Secure POP3' },
  3306: { n: 'MySQL', d: 'Database' }, 5432: { n: 'PostgreSQL', d: 'Database' },
  8080: { n: 'HTTP Alt', d: 'Alt Web' },
};

export function PortsPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const ports = data.ports || [];
  const open = ports.filter((p) => p.open).length;

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Pill tone="ok">{open} open</Pill>
        <Pill>{ports.length - open} closed</Pill>
        <span className="text-[12.5px] text-slateGray">
          {ports.length} ports scanned on {data.domain || ''}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ports.map((p) => {
          const i = PORT_INFO[p.port] || { n: `Port ${p.port}`, d: '' };
          return (
            <Card
              key={p.port}
              hover
              className={`p-5 ${p.open ? 'border-state-ok/30 bg-state-okSoft/50' : ''}`}
            >
              <p className={`font-mono text-xl font-semibold ${p.open ? 'text-state-ok' : 'text-slateGray/40'}`}>
                {p.port}
              </p>
              <p className={`mt-1.5 text-[12.5px] font-semibold ${p.open ? 'text-ink' : 'text-slateGray/60'}`}>
                {i.n}
              </p>
              {i.d && <p className="mt-0.5 text-[11px] text-slateGray">{i.d}</p>}
              <Pill tone={p.open ? 'ok' : 'neutral'} className="mt-3">
                {p.open ? 'OPEN' : 'CLOSED'}
              </Pill>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

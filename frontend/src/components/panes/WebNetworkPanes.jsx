/**
 * Web- and network-category panes: Trace, Tech, CT logs, CORS, Robots, Redirect.
 * Ports of renderTrace(), renderTech(), renderCt(), renderCors(), renderRobots()
 * and renderRedirect() — same fields, same labels, same empty-state wording.
 */
import { Card, Pill, ErrorBlock, InfoRow } from '../ui/index.jsx';

/* ── Connectivity / trace ────────────────────────────────────────────────────── */

export function TracePane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-2">
      <Card className="p-5">
        <p className="mb-3.5 text-[13px] font-semibold text-ink">IP addresses</p>
        {data.hasIPv4 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line/60 py-2">
            <Pill tone="accent">IPv4</Pill>
            <span className="break-all font-mono text-[12.5px] text-ink-soft">{data.ipv4 || ''}</span>
          </div>
        )}
        {data.hasIPv6 && (
          <div className="flex flex-wrap items-center gap-2 py-2">
            <Pill tone="info">IPv6</Pill>
            <span className="break-all font-mono text-[12.5px] text-ink-soft">{data.ipv6 || ''}</span>
          </div>
        )}
        {!data.hasIPv4 && !data.hasIPv6 && (
          <p className="text-[13px] text-state-err">No A or AAAA records answered — the host is unreachable.</p>
        )}
      </Card>

      <Card className="p-5 text-center">
        <span className="text-4xl leading-none" aria-hidden="true">🌐</span>
        <p className="mt-2.5 text-sm font-semibold text-ink">{data.message || 'Connectivity'}</p>
        <div className="mt-2.5">
          {data.dualStack ? <Pill tone="ok">Dual Stack ✓</Pill> : <Pill tone="warn">Single Stack</Pill>}
        </div>
      </Card>
    </div>
  );
}

/* ── Technology fingerprint ──────────────────────────────────────────────────── */

export function TechPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const d = data.detected || {};
  // Same category order as the legacy pane.
  const cats = [
    ['CMS', d.cms], ['Frameworks', d.frameworks], ['JavaScript', d.javascript],
    ['Hosting', d.hosting], ['Analytics', d.analytics], ['Security', d.security],
    ['Servers', d.servers],
  ].filter(([, v]) => v && v.length);

  return (
    <Card className="p-5">
      <p className="mb-4 text-sm font-semibold text-ink">🔍 Technology detection</p>
      {cats.length ? (
        <div className="space-y-3">
          {cats.map(([label, items]) => (
            <div key={label}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slateGray">{label}</p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((t) => <Pill key={t}>{t}</Pill>)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-slateGray">No technologies detected</p>
      )}
    </Card>
  );
}

/* ── Certificate Transparency ────────────────────────────────────────────────── */

export function CtPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const subdomains = data.subdomains || [];
  const shown = subdomains.slice(0, 30); // legacy capped the pill list at 30

  return (
    <div className="space-y-3.5">
      <Card className="p-5">
        <p className="text-sm font-semibold text-ink">📜 Certificate Transparency</p>
        <p className="mt-1 text-[12.5px] text-slateGray">{subdomains.length} subdomain(s) found</p>
      </Card>

      {subdomains.length ? (
        <Card className="p-4">
          <div className="flex flex-wrap gap-2">
            {shown.map((s) => <Pill key={s} className="font-mono">{s}</Pill>)}
          </div>
          {subdomains.length > 30 && (
            <p className="mt-2.5 text-[12.5px] text-slateGray">+{subdomains.length - 30} more</p>
          )}
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <p className="text-[13px] text-slateGray">No subdomains found in CT logs</p>
        </Card>
      )}
    </div>
  );
}

/* ── CORS ────────────────────────────────────────────────────────────────────── */

export function CorsPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const cors = data.cors || {};

  return (
    <div className="space-y-3.5">
      <div className="grid items-start gap-3.5 lg:grid-cols-2">
        <Card className="p-5">
          <p className="mb-3.5 text-[13px] font-semibold text-ink">🔗 CORS status</p>
          <p className={`text-sm ${cors.enabled ? 'text-state-ok' : 'text-slateGray'}`}>
            {cors.enabled ? 'Enabled' : 'Disabled'}
          </p>
          {cors.origin && (
            <p className="mt-2.5 text-[12px] text-slateGray">
              Origin: <span className="break-all font-mono">{cors.origin}</span>
            </p>
          )}
        </Card>

        <Card className="p-5">
          <p className="mb-3.5 text-[13px] font-semibold text-ink">Configuration</p>
          <InfoRow label="Credentials" value={cors.credentials ? 'Yes' : 'No'} />
          {cors.methods?.length > 0 && (
            <div className="mt-2.5">
              <p className="text-[11px] text-slateGray">Methods:</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {cors.methods.map((m) => <Pill key={m} className="font-mono">{m}</Pill>)}
              </div>
            </div>
          )}
        </Card>
      </div>

      {data.issues?.length > 0 && (
        <Card className="border-state-warn/20 bg-state-warnSoft p-5">
          <div className="space-y-1">
            {data.issues.map((i, idx) => (
              <p key={idx} className="text-[12.5px] text-state-warn">• {i}</p>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── robots.txt / sitemap ────────────────────────────────────────────────────── */

export function RobotsPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const robots = data.robots || {};
  const sitemap = data.sitemap || {};

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-2">
      <Card className="p-5">
        <p className="mb-3 text-sm font-semibold text-ink">🤖 robots.txt</p>
        <Pill tone={robots.present ? 'ok' : 'warn'}>{robots.present ? 'Present' : 'Missing'}</Pill>
        {robots.rules?.length > 0 && (
          <p className="mt-3 text-[11px] text-slateGray">{robots.rules.length} rule(s) defined</p>
        )}
      </Card>

      <Card className="p-5">
        <p className="mb-3 text-sm font-semibold text-ink">🗺️ sitemap.xml</p>
        <Pill tone={sitemap.present ? 'ok' : 'warn'}>{sitemap.present ? 'Present' : 'Missing'}</Pill>
        {sitemap.totalUrls ? (
          <p className="mt-3 text-[11px] text-slateGray">{sitemap.totalUrls} URL(s) indexed</p>
        ) : null}
      </Card>
    </div>
  );
}

/* ── Redirect chain ──────────────────────────────────────────────────────────── */

export function RedirectPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const chain = data.chain || [];

  return (
    <div className="space-y-3.5">
      <Card className="p-5">
        <p className="text-sm font-semibold text-ink">🔀 {data.message || 'Redirect chain'}</p>
        <p className="mt-1 text-[12.5px] text-slateGray">
          {chain.length} hops · {data.totalTimeMs || 0}ms
        </p>
      </Card>

      <Card className="p-4">
        {chain.length ? (
          chain.map((h, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-line/60 py-2.5 last:border-0">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-[12px] font-bold text-brand">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-all font-mono text-[11px] text-ink-soft">{h.url}</p>
                {h.redirectTo && (
                  <p className="mt-1 break-all text-[11px] text-brand">→ {h.redirectTo}</p>
                )}
                {h.statusCode && <Pill className="mt-1">{h.statusCode}</Pill>}
              </div>
              {h.durationMs != null && (
                <span className="shrink-0 font-mono text-[10px] text-slateGray">{h.durationMs}ms</span>
              )}
            </div>
          ))
        ) : (
          <p className="text-[13px] text-slateGray">No redirects</p>
        )}
      </Card>
    </div>
  );
}

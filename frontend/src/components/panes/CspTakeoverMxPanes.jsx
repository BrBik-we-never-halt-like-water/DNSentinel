/**
 * CSP, subdomain-takeover and MX/SMTP panes.
 * Ports of renderCsp(), renderTakeover() and renderMx().
 */
import { Card, Pill, ErrorBlock, EmptyState } from '../ui/index.jsx';
import { Mail, ShieldAlert } from 'lucide-react';

/* ── Content-Security-Policy ─────────────────────────────────────────────────── */

/** Grade → tone, following the legacy A+/A/B/C/D/F colour ladder. */
const cspGradeTone = (g) =>
  g === 'A+' || g === 'A' ? 'text-state-ok' : g === 'B' ? 'text-state-ok' : g === 'C' || g === 'D' ? 'text-state-warn' : 'text-state-err';

export function CspPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  // Absent CSP gets its own full-width callout, as in the legacy pane.
  if (!data.present) {
    return (
      <Card className="flex items-center gap-4 border-state-err/20 bg-state-errSoft p-7">
        <span className="text-4xl leading-none" aria-hidden="true">🧱</span>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-state-err">No Content-Security-Policy</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-slateGray">
            CSP is the primary browser defence against XSS attacks. Without it, any injected script can
            execute freely.
          </p>
        </div>
      </Card>
    );
  }

  const grade = data.grade || 'F';
  const dirs = data.directives || {};
  const dirKeys = Object.keys(dirs);

  return (
    <div className="space-y-3">
      <div className="grid items-start gap-3.5 sm:grid-cols-[auto_1fr]">
        <Card className="flex flex-col items-center gap-2 px-8 py-6 text-center">
          <p className={`font-display text-5xl font-extrabold leading-none ${cspGradeTone(grade)}`}>{grade}</p>
          <p className="text-[12px] text-slateGray">CSP grade</p>
          <p className="text-xl font-bold text-ink">
            {data.score || 0}
            <span className="text-[13px] font-normal text-slateGray/70">/100</span>
          </p>
          <div className="mt-1 flex flex-wrap justify-center gap-1.5">
            {data.isReportOnly && <Pill tone="warn">Report-Only</Pill>}
            {data.hasNonce && <Pill tone="ok">nonce ✓</Pill>}
            {data.hasStrictDynamic && <Pill tone="ok">strict-dynamic ✓</Pill>}
          </div>
        </Card>

        <Card className="p-5">
          <p className="mb-2.5 text-[13px] font-semibold text-ink">
            {dirKeys.length} Directive{dirKeys.length !== 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {dirKeys.map((k) => (
              <Pill key={k} className="font-mono">{k}</Pill>
            ))}
          </div>
        </Card>
      </div>

      {data.issues?.length > 0 && (
        <Card className="border-state-err/25 bg-state-errSoft p-5">
          <p className="mb-2 text-[12px] font-bold text-state-err">Issues ({data.issues.length})</p>
          <div className="space-y-1">
            {data.issues.map((i, idx) => (
              <p key={idx} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-soft">
                <span className="shrink-0 text-state-err" aria-hidden="true">✗</span>
                {i}
              </p>
            ))}
          </div>
        </Card>
      )}

      {data.warnings?.length > 0 && (
        <Card className="border-state-warn/25 bg-state-warnSoft p-5">
          <p className="mb-2 text-[12px] font-bold text-state-warn">Warnings ({data.warnings.length})</p>
          <div className="space-y-1">
            {data.warnings.map((w, idx) => (
              <p key={idx} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-soft">
                <span className="shrink-0 text-state-warn" aria-hidden="true">⚠</span>
                {w}
              </p>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.08em] text-slateGray">Raw policy</p>
        <p className="break-all font-mono text-[11px] leading-loose text-ink-soft">{data.rawHeader || ''}</p>
      </Card>
    </div>
  );
}

/* ── Subdomain takeover ──────────────────────────────────────────────────────── */

export function TakeoverPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const vulns = data.vulnerabilities || [];
  const results = data.results || [];
  const hasVulns = vulns.length > 0;
  const safe = results.filter((r) => !r.vulnerable);

  const summary = hasVulns
    ? `${vulns.length} potential takeover${vulns.length > 1 ? 's' : ''} found!`
    : results.length === 0
      ? 'No CNAMEs pointing to third-party services'
      : `All ${results.length} CNAME(s) appear safe`;

  return (
    <div className="space-y-2.5">
      <Card className={`p-5 ${hasVulns ? 'border-state-err/30 bg-state-errSoft' : ''}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none" aria-hidden="true">{hasVulns ? '🔴' : '✅'}</span>
          <div className="min-w-0">
            <p className={`text-sm font-bold ${hasVulns ? 'text-state-err' : 'text-ink'}`}>{summary}</p>
            <p className="mt-1 text-[12.5px] text-slateGray">
              Scanned {data.cnamesFound || 0} CNAME record{(data.cnamesFound || 0) !== 1 ? 's' : ''} across 18
              common subdomains
            </p>
          </div>
        </div>
      </Card>

      {vulns.map((v, i) => (
        <Card key={i} className="border-state-err/35 bg-state-errSoft p-5">
          <div className="mb-2.5 flex items-center gap-2.5">
            <ShieldAlert className="h-5 w-5 shrink-0 text-state-err" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-state-err">{v.subdomain}</p>
              <p className="mt-0.5 truncate text-[11px] text-slateGray">CNAME → {v.cname}</p>
            </div>
            <Pill tone="err">{v.service || 'Unknown Service'}</Pill>
          </div>
          {v.fingerprintMatch && (
            <p className="break-all rounded-lg bg-white/70 px-3 py-2 font-mono text-[11px] text-slateGray">
              Fingerprint: &quot;{v.fingerprintMatch}&quot;
            </p>
          )}
        </Card>
      ))}

      {safe.length > 0 && (
        <Card className="p-5">
          <p className="mb-3 text-[13px] font-semibold text-ink">Safe CNAMEs</p>
          {safe.map((r, i) => (
            <div key={i} className="flex items-center gap-2.5 border-b border-line/60 py-2.5 last:border-0">
              <span className="shrink-0 text-state-ok" aria-hidden="true">✓</span>
              <div className="min-w-0 flex-1">
                <p className="break-all font-mono text-[12px] text-ink-soft">{r.subdomain}</p>
                <p className="text-[11px] text-slateGray">
                  → {r.cname} {r.service && <span className="text-brand">({r.service})</span>}
                </p>
              </div>
              <Pill tone="ok">Safe</Pill>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ── MX / SMTP ───────────────────────────────────────────────────────────────── */

export function MxPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const servers = data.mxServers || [];
  if (!servers.length) {
    return (
      <Card>
        <EmptyState
          icon={Mail}
          title="No MX records found"
          description="This domain cannot receive email — fine if that is intentional."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-2.5">
      {servers.map((s, i) => (
        <Card key={i} className="p-4">
          <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
            <Pill tone="brand" className="font-mono">P{s.priority}</Pill>
            <span className="break-all font-mono text-[13px] font-semibold text-ink">{s.host}</span>
            {s.ipv4 && <Pill className="font-mono">{s.ipv4}</Pill>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {s.smtp?.starttls ? <Pill tone="ok">✓ STARTTLS</Pill> : <Pill tone="warn">✗ STARTTLS</Pill>}
            {s.smtp?.banner && (
              <Pill className="max-w-[320px] truncate">{s.smtp.banner.substring(0, 80)}</Pill>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

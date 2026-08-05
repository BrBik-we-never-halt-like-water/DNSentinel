/**
 * Final batch of panes: HTTP, IPv6, MTA-STS/DANE, Typosquat and DNSSEC chain.
 * Ports of renderHttp(), renderIpv6(), renderMtasts(), renderTyposquat() and
 * renderDnssecChain() — same scores, breakpoints, checklists and wording.
 */
import { Card, Pill, ErrorBlock } from '../ui/index.jsx';
import { PaneHero, PaneGrid, RecordCard, NoteCard, ScoreBar } from './shared.jsx';

const TONE_TEXT = { ok: 'text-state-ok', warn: 'text-state-warn', err: 'text-state-err', neutral: 'text-slateGray' };

/** Simple ✓/✗ checklist row, shared by the IPv6 and chain panes. */
function CheckRow({ ok, label, value }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-line/60 py-2 last:border-0">
      <span className={`shrink-0 text-sm ${ok ? 'text-state-ok' : 'text-state-err'}`} aria-hidden="true">
        {ok ? '✓' : '✗'}
      </span>
      <span className="flex-1 text-[12px] text-ink-soft">{label}</span>
      <span className="max-w-[45%] truncate font-mono text-[11px] text-slateGray" title={String(value)}>
        {String(value)}
      </span>
    </div>
  );
}

/* ── HTTP features ───────────────────────────────────────────────────────────── */

const httpTone = (s) => (s >= 80 ? 'ok' : s >= 60 ? 'ok' : s >= 40 ? 'warn' : 'err');

export function HttpPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const score = data.score || 0;
  const tone = httpTone(score);

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-2">
      <Card className="p-6 text-center">
        <p className="mb-3 text-2xs font-semibold uppercase tracking-[0.1em] text-slateGray">HTTP score</p>
        <p className={`font-display text-5xl font-extrabold leading-none ${TONE_TEXT[tone]}`}>{score}</p>
        <ScoreBar score={score} tone={tone} className="mt-4 h-1.5" />
      </Card>

      <Card className="p-5">
        <p className="mb-3.5 text-[13px] font-semibold text-ink">Protocols</p>
        <div className="flex flex-wrap gap-2">
          {data.protocols?.http2 ? <Pill tone="ok">HTTP/2 ✓</Pill> : <Pill>HTTP/2 ✗</Pill>}
          {data.protocols?.http3 && <Pill tone="ok">HTTP/3 ✓</Pill>}
          {data.compression?.gzip && <Pill tone="ok">Gzip</Pill>}
          {data.compression?.brotli && <Pill tone="ok">Brotli</Pill>}
        </div>
        {data.recommendations?.length > 0 && (
          <div className="mt-4 space-y-1">
            {data.recommendations.map((r, i) => (
              <p key={i} className="text-[11.5px] leading-relaxed text-state-warn">→ {r}</p>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ── IPv6 ────────────────────────────────────────────────────────────────────── */

const ipv6Tone = (s) => (s >= 80 ? 'ok' : s >= 50 ? 'ok' : s >= 30 ? 'warn' : 'err');

export function Ipv6Pane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const score = data.score || 0;
  const tone = ipv6Tone(score);
  const v6 = data.ipv6 || [];

  // Same four checks, in the same order, as the legacy pane.
  const checks = [
    { label: 'AAAA record exists', ok: v6.length > 0, val: v6.length > 0 ? v6[0] : 'No IPv6 address' },
    { label: 'Dual-stack (IPv4 + IPv6)', ok: !!data.dualStack, val: data.dualStack ? 'Yes' : 'No' },
    {
      label: 'TLS over IPv6',
      ok: !!data.tlsV6?.success,
      val: data.tlsV6?.success ? data.tlsV6.protocol : data.tlsV6?.error || 'N/A',
    },
    {
      label: 'TLS over IPv4',
      ok: !!data.tlsV4?.success,
      val: data.tlsV4?.success ? data.tlsV4.protocol : data.tlsV4?.error || 'N/A',
    },
  ];

  return (
    <div className="grid items-start gap-3.5 sm:grid-cols-[auto_1fr]">
      <Card className="flex flex-col items-center gap-2.5 px-8 py-6 text-center">
        <p className={`font-display text-5xl font-extrabold leading-none ${TONE_TEXT[tone]}`}>{score}</p>
        <p className="text-2xs uppercase tracking-wide text-slateGray">IPv6 score</p>
        <ScoreBar score={score} tone={tone} className="w-full" />
        <Pill tone={data.ipv6Enabled ? 'ok' : 'err'}>
          {data.ipv6Enabled ? 'IPv6 Enabled' : 'IPv6 Not Configured'}
        </Pill>
        {data.dualStack && <Pill tone="ok">Dual-Stack</Pill>}
      </Card>

      <Card className="p-5">
        <p className="mb-3.5 text-[13px] font-semibold text-ink">Connectivity</p>
        {checks.map((c) => <CheckRow key={c.label} {...c} value={c.val} />)}
        {v6.length > 0 && (
          <div className="mt-3.5">
            <p className="mb-1.5 text-[11px] uppercase tracking-wide text-slateGray">IPv6 addresses</p>
            {v6.map((ip) => (
              <p key={ip} className="break-all py-0.5 font-mono text-[12px] text-brand">{ip}</p>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ── MTA-STS / DANE ──────────────────────────────────────────────────────────── */

/** TLSA certificate-usage code → label (legacy indexed this array by usage-1). */
const TLSA_USAGE = ['CA', 'Service', 'Trust Anchor', 'Domain'];

export function MtastsPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const rating = data.rating || 'not_configured';
  const tone = rating === 'good' ? 'ok' : rating === 'partial' ? 'warn' : 'neutral';
  const label = rating === 'good' ? 'Protected' : rating === 'partial' ? 'Partial' : 'Not Protected';

  const policy = data.mtaSts?.policy;
  const tlsaRecords = data.tlsa?.present ? data.tlsa.records || [] : [];

  const modeTone =
    policy?.mode === 'enforce' ? 'text-state-ok' : policy?.mode === 'testing' ? 'text-state-warn' : 'text-ink-soft';

  return (
    <div>
      <PaneHero
        icon={rating === 'good' ? '🔒' : '🔓'}
        tone={tone}
        title={label}
        subtitle={`SMTP security for ${data.domain || ''}`}
      >
        <div className="mt-4 flex flex-wrap gap-2">
          {data.mtaSts?.present ? <Pill tone="ok">DNS Record ✓</Pill> : <Pill tone="err">DNS Missing ✗</Pill>}
          {data.mtaSts?.wellKnown?.present ? (
            <Pill tone="ok">HTTPS Policy ✓</Pill>
          ) : (
            <Pill tone="warn">HTTPS Policy ✗</Pill>
          )}
          {data.tlsa?.present ? <Pill tone="ok">DANE/TLSA ✓</Pill> : <Pill tone="warn">DANE/TLSA ✗</Pill>}
        </div>
      </PaneHero>

      <PaneGrid>
        <RecordCard badge="MTA-STS" badgeTone="accent" title="Mail Transfer Agent Strict Transport Security">
          {data.mtaSts?.present ? <Pill tone="ok">Record present</Pill> : (
            <p className="text-[13px] text-state-err">No MTA-STS DNS record</p>
          )}
          {policy && (
            <div className="mt-3 space-y-1 rounded-lg bg-brand-50/50 px-3.5 py-3">
              {policy.version && (
                <p className="text-[12px]"><span className="text-slateGray">Version:</span> {policy.version}</p>
              )}
              {policy.mode && (
                <p className="text-[12px]">
                  <span className="text-slateGray">Mode:</span>{' '}
                  <span className={`font-semibold ${modeTone}`}>{policy.mode}</span>
                </p>
              )}
              {policy.mx && (
                <p className="break-all text-[12px]"><span className="text-slateGray">MX:</span> {policy.mx}</p>
              )}
            </div>
          )}
        </RecordCard>

        <RecordCard badge="TLSA" badgeTone="ok" title="DNS-Based Authentication of Named Entities">
          {tlsaRecords.length ? (
            <div className="space-y-2">
              {tlsaRecords.map((r, i) => (
                <div key={i} className="rounded-lg bg-state-okSoft px-3.5 py-2.5">
                  <Pill tone="ok" className="mr-2">
                    {TLSA_USAGE[r.certificateUsage - 1] || 'Unknown'}
                  </Pill>
                  <span className="text-[11px] text-slateGray">
                    Selector: {r.selector} · Hash: {r.matchingType} · {String(r.hash || '').substring(0, 32)}…
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-slateGray">No TLSA records found</p>
          )}
        </RecordCard>
      </PaneGrid>

      <NoteCard title="Issues" items={data.issues || []} tone="err" bullet="•" />
      <NoteCard title="Recommendations" items={data.recommendations || []} tone="warn" bullet="→" />
    </div>
  );
}

/* ── Typosquatting ───────────────────────────────────────────────────────────── */

export function TyposquatPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const results = data.results || [];
  const registered = results.filter((r) => r.registered);
  const clean = results.filter((r) => !r.registered);
  const pct = data.total > 0 ? Math.round((registered.length / data.total) * 100) : 0;
  // Legacy risk tiering: none = ok, 1–3 = warn, 4+ = err.
  const tone = registered.length === 0 ? 'ok' : registered.length <= 3 ? 'warn' : 'err';

  return (
    <div className="space-y-3.5">
      <div className="grid items-start gap-3.5 sm:grid-cols-[auto_1fr]">
        <Card className="flex flex-col items-center gap-2.5 px-8 py-6 text-center">
          <p className={`font-display text-5xl font-extrabold leading-none ${TONE_TEXT[tone]}`}>
            {registered.length}
          </p>
          <p className="text-2xs uppercase tracking-wide text-slateGray">Registered typos</p>
          <p className="text-[12px] text-slateGray/80">{data.total || 0} variants checked</p>
          <ScoreBar score={pct} tone={tone} className="w-full" />
        </Card>

        <Card className="p-5">
          <p className="text-[13px] font-semibold text-ink">Phishing risk</p>
          <p className="mb-3 mt-1 text-[12.5px] leading-relaxed text-slateGray">
            Typosquatted domains registered by others can be used for phishing, brand impersonation, or malware
            distribution.
          </p>
          <div className="flex gap-2.5">
            <div className="flex-1 rounded-xl border border-state-err/20 bg-state-errSoft px-3 py-3 text-center">
              <p className="text-xl font-bold text-state-err">{registered.length}</p>
              <p className="text-[10.5px] text-slateGray">Registered</p>
            </div>
            <div className="flex-1 rounded-xl border border-state-ok/20 bg-state-okSoft px-3 py-3 text-center">
              <p className="text-xl font-bold text-state-ok">{clean.length}</p>
              <p className="text-[10.5px] text-slateGray">Available</p>
            </div>
          </div>
        </Card>
      </div>

      {registered.length ? (
        <Card className="border-state-err/20 bg-state-errSoft/50 p-5">
          <p className="mb-3 text-[13px] font-bold text-state-err">Registered typosquats</p>
          {registered.map((r, i) => (
            <div key={i} className="flex items-center gap-2.5 border-b border-line/60 py-2 last:border-0">
              <span className="shrink-0 text-sm text-state-err" aria-hidden="true">⚠</span>
              <span className="min-w-0 flex-1 break-all font-mono text-[12px] text-ink">{r.domain}</span>
              {r.ips?.length > 0 && (
                <span className="shrink-0 font-mono text-[11px] text-slateGray">{r.ips[0]}</span>
              )}
              <Pill tone="err">Registered</Pill>
            </div>
          ))}
        </Card>
      ) : (
        <Card className="border-state-ok/20 bg-state-okSoft/50 p-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl leading-none" aria-hidden="true">✅</span>
            <div>
              <p className="text-sm font-semibold text-state-ok">No active typosquats found</p>
              <p className="mt-1 text-[12.5px] text-slateGray">
                None of the {data.total || 0} generated variants are currently registered.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── DNSSEC chain of trust ───────────────────────────────────────────────────── */

const CHAIN_STATUS = {
  valid: { tone: 'ok', icon: '🟢', label: 'Chain Valid' },
  partial: { tone: 'warn', icon: '🟡', label: 'Partial — Issues Detected' },
  incomplete: { tone: 'warn', icon: '🟠', label: 'Incomplete Configuration' },
  unsigned: { tone: 'err', icon: '⚪', label: 'DNSSEC Not Enabled' },
};

export function DnssecChainPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const sc = CHAIN_STATUS[data.status] || CHAIN_STATUS.unsigned;
  const chain = data.chain || [];
  const issues = data.issues || [];

  return (
    <div className="space-y-3.5">
      <div className="grid items-start gap-3.5 sm:grid-cols-[auto_1fr]">
        <Card className="flex flex-col items-center justify-center gap-3 p-7 text-center">
          <span className="text-5xl leading-none" aria-hidden="true">{sc.icon}</span>
          <p className={`text-[15px] font-bold ${TONE_TEXT[sc.tone]}`}>{sc.label}</p>
          {data.statusMessage && <p className="text-[12px] text-slateGray">{data.statusMessage}</p>}
        </Card>

        <Card className="p-5">
          <p className="mb-1 text-[13px] font-semibold text-ink">Chain of trust</p>
          {chain.map((step, i) => (
            <div
              key={i}
              className={`flex items-start gap-3.5 py-3.5 ${i < chain.length - 1 ? 'border-b border-line/60' : ''}`}
            >
              {/* Node + connector, mirroring the legacy vertical chain */}
              <div className="flex shrink-0 flex-col items-center self-stretch">
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-sm ${
                    step.present
                      ? 'border-state-ok bg-state-okSoft text-state-ok'
                      : 'border-state-err bg-state-errSoft text-state-err'
                  }`}
                  aria-hidden="true"
                >
                  {step.present ? '✓' : '✗'}
                </span>
                {i < chain.length - 1 && (
                  <span className={`mt-1 w-0.5 flex-1 ${step.present ? 'bg-state-ok/30' : 'bg-state-err/20'}`} />
                )}
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <p className={`text-[13px] font-bold ${step.present ? 'text-ink' : 'text-state-err'}`}>
                  {step.step}
                </p>
                {step.domain && (
                  <p className="mt-0.5 break-all font-mono text-[11px] text-slateGray/80">{step.domain}</p>
                )}
                {step.desc && <p className="mt-1 text-[12px] leading-relaxed text-slateGray">{step.desc}</p>}
              </div>

              <Pill tone={step.present ? 'ok' : 'err'}>{step.present ? 'Present' : 'Missing'}</Pill>
            </div>
          ))}
        </Card>
      </div>

      {issues.length > 0 && (
        <Card className="border-state-err/25 bg-state-errSoft p-5">
          <p className="mb-2 text-[12px] font-bold text-state-err">Issues</p>
          <div className="space-y-1">
            {issues.map((i, idx) => (
              <p key={idx} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-soft">
                <span className="shrink-0 text-state-err" aria-hidden="true">✗</span>
                {i}
              </p>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

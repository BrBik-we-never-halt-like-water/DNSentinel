/**
 * Security-category panes: Headers, HSTS preload, OCSP / revocation.
 * Ports of renderHeaders(), renderHsts() and renderOcsp() respectively.
 */
import { Card, Pill, ErrorBlock, InfoRow, SectionLabel } from '../ui/index.jsx';
import { PaneHero, NoteCard, ScoreBar, MiniField } from './shared.jsx';

/* ── Security headers ────────────────────────────────────────────────────────── */

/** Score → tone, using the legacy 80 / 60 / 40 breakpoints. */
const headerScoreTone = (s) => (s >= 80 ? 'ok' : s >= 60 ? 'ok' : s >= 40 ? 'warn' : 'err');

const RATING_LABEL = { excellent: 'Excellent', good: 'Good', fair: 'Fair' };

export function HeadersPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const analysis = data.analysis || {};
  const checks = analysis.checks || {};
  const score = analysis.score || 0;
  const tone = headerScoreTone(score);
  const label = RATING_LABEL[analysis.rating] || 'Poor';

  const TONE_TEXT = { ok: 'text-state-ok', warn: 'text-state-warn', err: 'text-state-err' };

  return (
    <div>
      <div className="grid items-start gap-3.5 lg:grid-cols-[240px_1fr]">
        <Card className="p-7 text-center">
          <p className="text-2xs font-bold uppercase tracking-[0.14em] text-slateGray">Header score</p>
          <p className={`mt-3 font-display text-5xl font-extrabold leading-none ${TONE_TEXT[tone]}`}>
            {score}
            <span className="text-2xl text-slateGray/60">/100</span>
          </p>
          <p className="mt-2 text-[13px] text-slateGray">{label}</p>
          <ScoreBar score={score} tone={tone} className="mt-5 h-1.5" />
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {data.http2 ? <Pill tone="ok">HTTP/2 ✓</Pill> : <Pill>HTTP/1.1</Pill>}
            <Pill>Status {data.statusCode || '—'}</Pill>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <SectionLabel>Security headers</SectionLabel>
          {Object.entries(checks).map(([name, c]) => {
            const state = c.passed ? 'ok' : c.deprecated ? 'warn' : 'err';
            const badgeLabel = c.passed ? 'PASS' : c.deprecated ? 'DEPRECATED' : 'MISSING';
            const showCurrent =
              c.detail && c.detail !== 'missing' && c.detail !== 'present' && !c.passed;
            return (
              <div key={name} className="flex items-start gap-3.5 border-b border-line/60 px-5 py-3.5 last:border-0">
                <span className={`mt-0.5 shrink-0 text-base ${TONE_TEXT[state]}`} aria-hidden="true">
                  {c.passed ? '✓' : c.deprecated ? '⚠' : '✗'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-ink">{name}</p>
                  <p className="mt-0.5 break-words text-[12.5px] leading-relaxed text-slateGray">
                    {c.detail || 'Header not present'}
                  </p>
                  {showCurrent && (
                    <p className="mt-1 break-all text-[11px] text-slateGray/80">Current: {c.detail}</p>
                  )}
                  {c.deprecated && <p className="mt-1 text-[11px] text-state-warn">Should be removed</p>}
                </div>
                <Pill tone={state}>{badgeLabel}</Pill>
              </div>
            );
          })}
        </Card>
      </div>

      <NoteCard title="Recommendations" items={analysis.recommendations || []} tone="warn" bullet="→" />
    </div>
  );
}

/* ── HSTS preload ────────────────────────────────────────────────────────────── */

/** Status → icon/label/description, matching the legacy statusConfig map. */
function hstsStatus(data) {
  const status = data.preloadStatus || 'unknown';
  const MAP = {
    preloaded: {
      tone: 'ok', icon: '🟢', label: 'On Preload List',
      desc: "Domain is in Chrome's HSTS preload list — browsers enforce HTTPS before any request.",
    },
    pending: {
      tone: 'warn', icon: '🟡', label: 'Submission Pending',
      desc: 'Domain is pending inclusion in the preload list.',
    },
    rejected: {
      tone: 'err', icon: '🔴', label: 'Submission Rejected',
      desc: 'Previous submission was rejected. Check eligibility requirements.',
    },
  };
  if (MAP[status]) return MAP[status];
  // `unknown` splits on eligibility, as the legacy config did.
  return data.eligible
    ? {
        tone: 'warn', icon: '⚡', label: 'Eligible but not submitted',
        desc: 'All requirements met — submit at hstspreload.org to join the preload list.',
      }
    : {
        tone: 'neutral', icon: '⚪', label: 'Not on preload list',
        desc: 'Domain has not been submitted for HSTS preloading.',
      };
}

export function HstsPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const sc = hstsStatus(data);
  const TONE_TEXT = { ok: 'text-state-ok', warn: 'text-state-warn', err: 'text-state-err', neutral: 'text-slateGray' };

  // Same five eligibility checks, in the same order, as the legacy pane.
  const checks = [
    { label: 'HSTS header present', ok: !!data.hstsHeader, val: data.hstsHeader ? 'Yes' : 'No' },
    {
      label: 'Max-age ≥ 1 year',
      ok: !!(data.maxAge && data.maxAge >= 31536000),
      val: data.maxAgeDays != null ? `${data.maxAgeDays} days` : 'N/A',
    },
    { label: 'includeSubDomains', ok: !!data.includeSubDomains, val: data.includeSubDomains ? 'Present' : 'Missing' },
    { label: 'preload directive', ok: !!data.preloadDirective, val: data.preloadDirective ? 'Present' : 'Missing' },
    { label: 'On Chrome preload list', ok: !!data.onPreloadList, val: data.onPreloadList ? 'Yes' : 'No' },
  ];

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-2">
      <Card className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="text-5xl leading-none" aria-hidden="true">{sc.icon}</span>
        <p className={`text-base font-bold ${TONE_TEXT[sc.tone]}`}>{sc.label}</p>
        <p className="text-[12.5px] leading-relaxed text-slateGray">{sc.desc}</p>
      </Card>

      <Card className="p-5">
        <p className="mb-3.5 text-[13px] font-semibold text-ink">Eligibility checklist</p>
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-2.5 border-b border-line/60 py-2 last:border-0">
            <span className={`shrink-0 text-sm ${c.ok ? 'text-state-ok' : 'text-state-err'}`} aria-hidden="true">
              {c.ok ? '✓' : '✗'}
            </span>
            <span className="flex-1 text-[12px] text-ink-soft">{c.label}</span>
            <span className={`font-mono text-[11px] ${c.ok ? 'text-state-ok' : 'text-slateGray'}`}>{c.val}</span>
          </div>
        ))}
        {data.hstsHeader && (
          <p className="mt-3.5 break-all rounded-lg bg-surface-soft px-3 py-2.5 font-mono text-[11px] text-ink-soft">
            {data.hstsHeader}
          </p>
        )}
      </Card>
    </div>
  );
}

/* ── OCSP / revocation ───────────────────────────────────────────────────────── */

export function OcspPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const rating = data.rating || 'unknown';
  const tone = rating === 'good' ? 'ok' : rating === 'warning' ? 'warn' : 'neutral';
  const label =
    rating === 'good' ? 'Good' : rating === 'warning' ? 'Warning' : rating === 'fair' ? 'Fair' : 'Unknown';

  return (
    <div>
      <PaneHero
        icon={rating === 'good' ? '✓' : '⚠'}
        tone={tone}
        title={label}
        subtitle="Certificate revocation status"
      />

      <div className="grid items-start gap-3.5 lg:grid-cols-2">
        <Card className="p-6">
          <p className="mb-4 text-[13px] font-semibold text-ink">Certificate</p>
          <InfoRow label="Serial" value={data.certificate?.serialNumber || '—'} />
          <InfoRow label="Issuer" value={data.certificate?.issuer || '—'} />
          <InfoRow label="Valid from" value={data.certificate?.validFrom || '—'} />
          <InfoRow label="Valid to" value={data.certificate?.validTo || '—'} />
        </Card>

        <Card className="p-6">
          <p className="mb-4 text-[13px] font-semibold text-ink">Revocation checking</p>
          <InfoRow
            label="OCSP supported"
            value={data.ocsp?.supported ? 'Yes ✓' : 'No'}
            tone={data.ocsp?.supported ? 'ok' : undefined}
          />
          {data.ocsp?.responderURL && <InfoRow label="OCSP responder" value={data.ocsp.responderURL} />}
          <InfoRow
            label="CRL supported"
            value={data.crl?.supported ? 'Yes ✓' : 'No'}
            tone={data.crl?.supported ? 'ok' : undefined}
          />
          {data.crl?.distributionPoint && <InfoRow label="CRL distribution" value={data.crl.distributionPoint} />}
          <InfoRow
            label="Stapling available"
            value={data.stapling?.supported ? 'Yes ✓' : 'No'}
            tone={data.stapling?.supported ? 'ok' : undefined}
          />
        </Card>
      </div>

      <NoteCard title="Issues" items={data.issues || []} tone="warn" bullet="•" />
    </div>
  );
}

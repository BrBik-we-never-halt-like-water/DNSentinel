/**
 * Shared pane building blocks.
 *
 * The legacy renderers repeated the same shapes over and over — a status hero, a
 * titled record card with a coloured type badge, a "⚠ issue / ✓ no issues" list, and
 * Issues/Recommendations callouts. These are those shapes, factored once so the 26
 * panes stay consistent and short.
 */
import { Card, Pill } from '../ui/index.jsx';

/** Rating → tone, using the legacy strong/good/fair/weak vocabulary. */
export const ratingTone = (r) =>
  r === 'strong' ? 'ok' : r === 'good' ? 'ok' : r === 'fair' ? 'warn' : 'err';

export const ratingLabel = (r) =>
  r === 'strong' ? 'Strong' : r === 'good' ? 'Good' : r === 'fair' ? 'Fair' : 'Weak';

/** Numeric score → tone with the legacy 85 / 60 breakpoints. */
export const scoreTone = (s) => (s >= 85 ? 'ok' : s >= 60 ? 'warn' : 'err');

const TONE_TEXT = { ok: 'text-state-ok', warn: 'text-state-warn', err: 'text-state-err', neutral: 'text-ink' };
const TONE_BG = { ok: 'bg-state-ok', warn: 'bg-state-warn', err: 'bg-state-err', neutral: 'bg-brand' };

/** Thin progress bar used by every scored pane. */
export function ScoreBar({ score = 0, tone = 'neutral', className = '' }) {
  return (
    <div className={`h-1 overflow-hidden rounded-full bg-surface-muted ${className}`}>
      <div
        className={`h-full rounded-full ${TONE_BG[tone]}`}
        style={{ width: `${Math.max(0, Math.min(100, score))}%`, transition: 'width 1.2s cubic-bezier(.4,0,.2,1)' }}
      />
    </div>
  );
}

/**
 * Status hero — the "big icon + verdict + score bar" block that opens most panes.
 * `icon` is an emoji string (kept from the legacy panes, which used emoji here) or a
 * node; decorative either way, so it is aria-hidden.
 */
export function PaneHero({ icon, title, subtitle, tone = 'neutral', score, badges, children }) {
  return (
    <Card className="mb-3.5 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {icon && (
          <span className="text-4xl leading-none" aria-hidden="true">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-[17px] font-bold ${TONE_TEXT[tone]}`}>{title}</p>
          {subtitle && <p className="mt-1 text-[12.5px] text-slateGray">{subtitle}</p>}
          {score != null && <ScoreBar score={score} tone={tone} className="mt-2.5 h-1.5" />}
          {children}
        </div>
        {badges && <div className="flex shrink-0 flex-wrap gap-2">{badges}</div>}
      </div>
    </Card>
  );
}

/**
 * A record card with a coloured type badge in its header (SPF / DMARC / DNSKEY / …).
 * `badgeTone` maps onto the design-system pill tones.
 */
export function RecordCard({ badge, badgeTone = 'neutral', title, meta, metaTone, children }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-soft/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {badge && <Pill tone={badgeTone} className="font-mono">{badge}</Pill>}
          <h3 className="truncate text-[13px] font-semibold text-ink">{title}</h3>
        </div>
        {meta != null && (
          <span className={`shrink-0 text-[11px] font-bold ${TONE_TEXT[metaTone || 'neutral']}`}>{meta}</span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

/** The record value block — monospace on a tinted surface, as in the legacy panes. */
export function RecordValue({ children }) {
  return (
    <p className="mb-2.5 break-all rounded-lg bg-brand-50/60 px-3 py-2 font-mono text-[11px] leading-relaxed text-brand-800">
      {children}
    </p>
  );
}

/** "⚠ issue" list, or "✓ No issues found" when empty — matches the legacy issueList(). */
export function IssueList({ issues = [] }) {
  if (!issues.length) return <p className="text-[11.5px] text-state-ok">✓ No issues found</p>;
  return (
    <div className="space-y-1">
      {issues.map((i, idx) => (
        <p key={idx} className="text-[11.5px] leading-relaxed text-state-warn">⚠ {i}</p>
      ))}
    </div>
  );
}

/** Absent-record message with a hint on how to fix it. */
export function MissingRecord({ label, hint }) {
  return (
    <>
      <p className="text-[13px] text-state-err">✗ {label}</p>
      {hint && <p className="mt-1.5 text-[11.5px] leading-relaxed text-slateGray">{hint}</p>}
    </>
  );
}

/**
 * Issues / Recommendations callout. `tone` picks the border+surface treatment;
 * `bullet` matches the legacy prefixes ("•" for issues, "→" for recommendations).
 */
export function NoteCard({ title, items = [], tone = 'warn', bullet = '→' }) {
  if (!items.length) return null;
  const shell =
    tone === 'err'
      ? 'border-state-err/20 bg-state-errSoft'
      : tone === 'ok'
        ? 'border-state-ok/20 bg-state-okSoft'
        : 'border-state-warn/20 bg-state-warnSoft';
  return (
    <Card className={`${shell} mt-3.5 p-5`}>
      <p className={`mb-2.5 text-[13px] font-bold ${TONE_TEXT[tone]}`}>{title}</p>
      <div className="space-y-1.5">
        {items.map((t, i) => (
          <p key={i} className="rounded-lg bg-white/60 px-3 py-2 text-[12.5px] leading-relaxed text-ink-soft">
            {bullet} {t}
          </p>
        ))}
      </div>
    </Card>
  );
}

/** Two-column grid used by most panes for their pair of record cards. */
export function PaneGrid({ children }) {
  return <div className="grid items-start gap-3.5 lg:grid-cols-2">{children}</div>;
}

/** Small key/value stack for compact detail blocks. */
export function MiniField({ label, children, tone }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slateGray/80">{label}</p>
      <div className={`mt-0.5 text-[12px] ${TONE_TEXT[tone || 'neutral']}`}>{children}</div>
    </div>
  );
}

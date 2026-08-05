/**
 * UI primitives — the shared vocabulary every screen is built from.
 * Kept in one module because they are small, cohesive and always imported together.
 */
import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const cx = (...c) => c.filter(Boolean).join(' ');

/* ── Button ──────────────────────────────────────────────────────────────────── */

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'disabled:pointer-events-none disabled:opacity-60';

const BTN_VARIANTS = {
  primary:
    'bg-brand text-white shadow-[0_2px_12px_rgba(109,40,217,0.28)] hover:bg-brand-600 ' +
    'hover:shadow-[0_6px_20px_rgba(109,40,217,0.36)] hover:-translate-y-px active:translate-y-0 ' +
    'focus-visible:ring-brand',
  accent:
    'bg-accent text-white shadow-[0_2px_12px_rgba(6,182,212,0.28)] hover:bg-accent-600 ' +
    'hover:-translate-y-px active:translate-y-0 focus-visible:ring-accent',
  secondary:
    'border border-line bg-surface text-ink hover:border-brand/40 hover:bg-brand-50 ' +
    'hover:text-brand focus-visible:ring-brand',
  ghost: 'text-slateGray hover:bg-surface-muted hover:text-ink focus-visible:ring-brand',
  danger: 'border border-state-err/30 bg-state-errSoft text-state-err hover:bg-red-100 focus-visible:ring-state-err',
};

const BTN_SIZES = {
  sm: 'h-9 px-3.5 text-[13px]',
  md: 'h-11 px-5 text-sm',
  lg: 'h-[52px] px-7 text-[15px]',
};

export const Button = forwardRef(function Button(
  { as: As = 'button', variant = 'primary', size = 'md', loading, className, children, ...rest },
  ref
) {
  return (
    <As
      ref={ref}
      className={cx(BTN_BASE, BTN_VARIANTS[variant], BTN_SIZES[size], className)}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </As>
  );
});

/* ── Card ────────────────────────────────────────────────────────────────────── */

export function Card({ as: As = 'div', hover, className, children, ...rest }) {
  return (
    <As
      className={cx(
        'surface-card',
        hover && 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift',
        className
      )}
      {...rest}
    >
      {children}
    </As>
  );
}

export function CardHeader({ title, meta, icon: Icon, className }) {
  return (
    <div className={cx('flex items-center justify-between gap-3 border-b border-line px-5 py-4', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />}
        <h3 className="truncate text-sm font-semibold text-ink">{title}</h3>
      </div>
      {meta && <span className="shrink-0 text-xs text-slateGray">{meta}</span>}
    </div>
  );
}

/* ── Pill / badges ───────────────────────────────────────────────────────────── */

const PILL_TONES = {
  neutral: 'border-line bg-surface-muted text-slateGray',
  brand: 'border-brand/25 bg-brand-50 text-brand',
  accent: 'border-accent/30 bg-accent-50 text-accent-700',
  ok: 'border-state-ok/25 bg-state-okSoft text-state-ok',
  warn: 'border-state-warn/25 bg-state-warnSoft text-state-warn',
  err: 'border-state-err/25 bg-state-errSoft text-state-err',
  info: 'border-state-info/25 bg-state-infoSoft text-state-info',
};

export function Pill({ tone = 'neutral', className, children, ...rest }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold',
        PILL_TONES[tone],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

/** Severity chip using the legacy severity vocabulary (crit/high/med/low/good). */
const SEV_TONE = { crit: 'err', high: 'err', med: 'warn', low: 'info', good: 'ok' };
const SEV_TEXT = { crit: 'Critical', high: 'High', med: 'Medium', low: 'Low', good: 'Pass' };

export function SeverityBadge({ sev }) {
  return (
    <Pill tone={SEV_TONE[sev] || 'neutral'} className="min-w-[62px] justify-center uppercase tracking-wide">
      {SEV_TEXT[sev] || sev}
    </Pill>
  );
}

/* ── Inputs ──────────────────────────────────────────────────────────────────── */

export const Input = forwardRef(function Input({ className, icon: Icon, ...rest }, ref) {
  return (
    <div className="relative">
      {Icon && (
        <Icon
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slateGray"
          aria-hidden="true"
        />
      )}
      <input
        ref={ref}
        className={cx(
          'w-full rounded-xl border border-line bg-surface text-ink placeholder:text-slateGray/70',
          'h-12 px-4 text-sm transition-shadow',
          'focus:border-brand focus:shadow-ring focus:outline-none',
          Icon && 'pl-10',
          className
        )}
        {...rest}
      />
    </div>
  );
});

/* ── Loading / empty / error states ──────────────────────────────────────────── */

export function Spinner({ className }) {
  return <Loader2 className={cx('h-5 w-5 animate-spin text-brand', className)} aria-hidden="true" />;
}

export function Skeleton({ className }) {
  return <div className={cx('skeleton', className)} />;
}

export function LoadingBlock({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center" role="status" aria-live="polite">
      <Spinner />
      <p className="text-[13px] text-slateGray">{label}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      {Icon && (
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface-muted text-slateGray">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      )}
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {description && <p className="max-w-sm text-[13px] leading-relaxed text-slateGray">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorBlock({ message }) {
  return (
    <div className="m-4 rounded-xl border border-state-err/20 bg-state-errSoft px-4 py-3">
      <p className="font-mono text-[12.5px] text-state-err">{message}</p>
    </div>
  );
}

/* ── Data display ────────────────────────────────────────────────────────────── */

/** Label/value row — the migrated equivalent of the legacy `irow()` helper. */
export function InfoRow({ label, value, mono = true, tone }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/70 py-2.5 last:border-0">
      <span className="shrink-0 text-[12.5px] text-slateGray">{label}</span>
      <span
        className={cx(
          'min-w-0 break-words text-right text-[12.5px] text-ink-soft',
          mono && 'font-mono',
          tone === 'ok' && 'text-state-ok',
          tone === 'warn' && 'text-state-warn',
          tone === 'err' && 'text-state-err'
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function SectionLabel({ children, className }) {
  return (
    <div className={cx('px-5 pb-2 pt-4 text-2xs font-bold uppercase tracking-[0.14em] text-slateGray', className)}>
      {children}
    </div>
  );
}

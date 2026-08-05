/**
 * App shell: navbar, decorative background, footer.
 * The decorative layer is inert — pointer-events-none and aria-hidden — so it can
 * never intercept a click or reach a screen reader.
 */
import { useEffect, useState } from 'react';
import { Menu, X, LogIn, LogOut, BookOpen } from 'lucide-react';
import { Button } from '../ui/index.jsx';

export function Wordmark({ className = '' }) {
  return (
    <span className={`font-display text-xl font-extrabold tracking-tightest ${className}`}>
      <span className="text-ink">DNS</span>
      <span className="bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">entinel</span>
    </span>
  );
}

/**
 * Decorative 3D-ish scene: soft gradient blobs, a glass ring and a floating sphere.
 * Pure CSS — no images, no 3D library, no measurable bundle cost.
 */
export function Decor() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Soft brand blobs */}
      <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] animate-drift rounded-full bg-[radial-gradient(circle_at_center,rgba(109,40,217,0.13),transparent_65%)] blur-2xl" />
      <div className="absolute -right-32 top-1/3 h-[28rem] w-[28rem] animate-drift rounded-full bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.12),transparent_65%)] blur-2xl [animation-delay:-8s]" />

      {/* Fine dot lattice, faded out toward the bottom */}
      <div
        className="absolute inset-0 opacity-[0.55] [mask-image:radial-gradient(ellipse_80%_55%_at_50%_0%,black,transparent)]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(100,116,139,0.22) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Glass ring + sphere — hidden on small screens where space is precious */}
      <div className="absolute right-[6%] top-[14%] hidden h-44 w-44 animate-float rounded-full border border-brand/15 bg-[radial-gradient(circle_at_32%_28%,rgba(109,40,217,0.10),transparent_62%)] shadow-[inset_0_0_40px_rgba(109,40,217,0.06)] lg:block" />
      <div className="absolute bottom-[18%] left-[5%] hidden h-24 w-24 animate-float rounded-full border border-white/60 bg-[radial-gradient(circle_at_30%_26%,#ffffff,rgba(6,182,212,0.20)_60%,rgba(109,40,217,0.16))] shadow-lift [animation-delay:-5s] lg:block" />
    </div>
  );
}

export function Navbar({ user, onSignIn, onSignOut }) {
  const [open, setOpen] = useState(false);

  // Close the mobile sheet on Escape, and lock scroll while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const links = [
    { href: '#features', label: 'Features' },
    { href: '#how', label: 'How it works' },
    { href: '#faq', label: 'FAQ' },
    { href: '/docs', label: 'API docs' },
  ];

  return (
    <header
      data-print="hide"
      className="sticky top-0 z-50 border-b border-line/80 bg-surface/80 backdrop-blur-xl"
    >
      <nav className="shell flex h-16 items-center justify-between gap-4" aria-label="Primary">
        <a href="/" className="shrink-0 rounded-lg" aria-label="DNSentinel home">
          <Wordmark />
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-slateGray transition-colors hover:bg-surface-muted hover:text-ink"
            >
              {l.label}
            </a>
          ))}
          <span className="mx-2 h-5 w-px bg-line" aria-hidden="true" />
          {user ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-ink-soft">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-brand to-accent text-[10px] font-bold text-white">
                  {(user.email[0] || '?').toUpperCase()}
                </span>
                <span className="max-w-[160px] truncate">{user.email}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={onSignOut} aria-label="Sign out">
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={onSignIn}>
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Sign in
            </Button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="grid h-10 w-10 place-items-center rounded-xl border border-line text-slateGray transition-colors hover:bg-surface-muted hover:text-ink md:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </nav>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Navigation" className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-ink/20 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 top-0 animate-scaleIn rounded-b-3xl border-b border-line bg-surface p-5 shadow-modal">
            <div className="mb-6 flex items-center justify-between">
              <Wordmark />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="grid h-10 w-10 place-items-center rounded-xl border border-line text-slateGray hover:bg-surface-muted hover:text-ink"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 text-base font-semibold text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand"
                >
                  {l.label}
                </a>
              ))}
            </div>
            <div className="mt-5 border-t border-line pt-4">
              {user ? (
                <Button variant="secondary" className="w-full" onClick={() => { onSignOut(); setOpen(false); }}>
                  Sign out
                </Button>
              ) : (
                <Button className="w-full" onClick={() => { onSignIn(); setOpen(false); }}>
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  Sign in
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer data-print="hide" className="mt-24 border-t border-line bg-surface">
      <div className="shell flex flex-col items-center gap-4 py-12 text-center">
        <Wordmark />
        <p className="max-w-md text-[13px] leading-relaxed text-slateGray">
          Comprehensive domain intelligence — DNS, WHOIS, TLS, email authentication,
          propagation and security posture in a single report.
        </p>
        <a
          href="/docs"
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium text-brand transition-colors hover:bg-brand-50"
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          API documentation
        </a>
        <p className="text-[15px] font-bold text-slateGray/70">Domain Intelligence — a BrBik product</p>
      </div>
    </footer>
  );
}

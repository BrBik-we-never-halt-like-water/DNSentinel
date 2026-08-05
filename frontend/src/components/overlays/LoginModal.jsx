/**
 * Sign-in modal. The authentication flow is untouched: same POST /api/auth/request
 * with `{ email }`, same magic-link expectation, same consoleMode dev hint, and the
 * browser's native email validation still gates submission.
 */
import { useEffect, useRef, useState } from 'react';
import { X, ShieldCheck, Mail, Lock, MailCheck } from 'lucide-react';
import { Button, Input } from '../ui/index.jsx';
import { authApi } from '../../utils/api.js';
import { useToasts } from '../../hooks/useToasts.jsx';

export function LoginModal({ open, onClose }) {
  const { toast } = useToasts();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null); // { email, consoleMode }
  const panelRef = useRef(null);
  const firstFieldRef = useRef(null);

  // Reset to the form each time the modal is reopened.
  useEffect(() => {
    if (open) {
      setSent(null);
      setSending(false);
      setTimeout(() => firstFieldRef.current?.focus(), 60);
    }
  }, [open]);

  // Escape to close + focus trap, matching the legacy trapFocus/releaseFocus pair.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const nodes = panelRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!nodes?.length) return;
      const list = Array.from(nodes).filter((n) => !n.disabled);
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const r = await authApi.request(email.trim());
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Request failed');
      setSent({ email: email.trim(), consoleMode: d.consoleMode });
    } catch (err) {
      toast(err.message || 'Could not send link', 'err');
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="fixed inset-0 h-full w-full cursor-default bg-ink/30 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        className="relative mt-10 w-full max-w-md animate-scaleIn overflow-hidden rounded-3xl border border-white/70 bg-surface/95 p-7 shadow-modal backdrop-blur-2xl"
      >
        <span
          className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-brand to-transparent"
          aria-hidden="true"
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl border border-line text-slateGray transition-colors hover:bg-surface-muted hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        {sent ? (
          <div className="animate-fadeUp pt-4 text-center">
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-state-ok/30 bg-state-okSoft text-state-ok">
              <MailCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 id="login-title" className="font-display text-xl font-extrabold text-ink">
              Check your inbox
            </h2>
            <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-slateGray">
              We sent a sign-in link to <strong className="font-semibold text-ink">{sent.email}</strong>. It
              expires in 15 minutes.
            </p>
            {sent.consoleMode && (
              <p className="mt-4 rounded-xl bg-state-warnSoft px-3 py-2 text-[11.5px] text-state-warn">
                Dev mode: email isn’t configured, so the link was logged to the server console.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="pt-2 text-center">
              <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-accent text-white shadow-[0_8px_24px_rgba(109,40,217,0.35)]">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 id="login-title" className="font-display text-xl font-extrabold tracking-tight text-ink">
                Welcome to DNSentinel
              </h2>
              <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-slateGray">
                Sign in with a magic link to sync scan history across devices and get email alerts for
                monitored domains. No password required.
              </p>
            </div>

            <form onSubmit={submit} className="mt-6">
              <label htmlFor="login-email" className="sr-only">Email address</label>
              <Input
                id="login-email"
                ref={firstFieldRef}
                icon={Mail}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
              <Button type="submit" size="lg" className="mt-3 w-full" loading={sending}>
                {sending ? 'Sending…' : 'Send magic link'}
              </Button>
            </form>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slateGray">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Passwordless &amp; secure — the link expires in 15 minutes
            </p>
          </>
        )}
      </div>
    </div>
  );
}

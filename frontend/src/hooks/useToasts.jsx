/**
 * Toasts — same four levels, messages and ~3.2s auto-dismiss as the legacy `toast()`,
 * re-expressed as context + a live region so screen readers announce them.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastCtx = createContext(null);

const ICONS = { ok: CheckCircle2, warn: AlertTriangle, err: XCircle, info: Info };
const ACCENT = {
  ok: 'border-l-state-ok text-state-ok',
  warn: 'border-l-state-warn text-state-warn',
  err: 'border-l-state-err text-state-err',
  info: 'border-l-brand text-brand',
};

let seq = 0;

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const dismiss = useCallback((id) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message, type = 'info', ms = 3200) => {
      const id = ++seq;
      setItems((list) => [...list, { id, message, type }]);
      if (ms > 0) setTimeout(() => dismiss(id), ms);
      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 right-5 z-[9999] flex w-[min(360px,calc(100vw-2.5rem))] flex-col gap-2.5"
        aria-live="polite"
        aria-atomic="false"
      >
        {items.map((t) => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex animate-scaleIn items-start gap-2.5 rounded-xl border border-line border-l-[3px] bg-surface/95 px-4 py-3 shadow-lift backdrop-blur ${ACCENT[t.type] || ACCENT.info}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="flex-1 text-[13px] leading-snug text-ink-soft">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="shrink-0 rounded-md p-0.5 text-slateGray transition-colors hover:bg-surface-muted hover:text-ink"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToasts() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToasts must be used inside <ToastProvider>');
  return ctx;
}

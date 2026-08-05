/**
 * Modal shell shared by every overlay.
 *
 * Reproduces the legacy overlay behaviour — click-outside and Escape to close, focus
 * trapped inside the panel (trapFocus/releaseFocus), body scroll locked — and returns
 * focus to whatever opened it, which the legacy version did not do.
 */
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function Modal({ open, onClose, title, icon: Icon, maxWidth = 'max-w-3xl', children }) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement;
    document.body.style.overflow = 'hidden';

    // Focus the first interactive element so keyboard users land inside the dialog.
    const t = setTimeout(() => {
      const first = panelRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      first?.focus();
    }, 50);

    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = panelRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!nodes?.length) return;
      const list = Array.from(nodes).filter((n) => !n.disabled && n.offsetParent !== null);
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

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
        aria-label={title}
        className={`relative mt-6 w-full ${maxWidth} animate-scaleIn rounded-3xl border border-line bg-surface p-6 shadow-modal sm:p-7`}
      >
        <div className="mb-5 flex items-center gap-3">
          <h2 className="flex min-w-0 items-center gap-2.5 text-base font-bold text-ink">
            {Icon && <Icon className="h-[18px] w-[18px] shrink-0 text-brand" aria-hidden="true" />}
            <span className="truncate">{title}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line text-slateGray transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

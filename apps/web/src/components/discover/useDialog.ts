'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Minimal dialog behavior for modals: Tab focus trap + Escape close.
 * Registered on window with capture so it wins over any underlying
 * dropdown/panel Escape handlers while the dialog is open.
 */
export function useDialog(ref: RefObject<HTMLElement | null>, open: boolean, onClose?: () => void) {
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = el.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, ref, onClose]);
}

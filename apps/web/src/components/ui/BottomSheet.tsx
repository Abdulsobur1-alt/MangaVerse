'use client';

import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   BottomSheet — the shared mobile overlay primitive.
   • Slides from the bottom edge with a spring; backdrop blurs to 0.45
   • Draggable: grab the handle/header — swipe down to dismiss,
     drag up to expand (60% → 95%). Body scrolls independently.
   • Tap backdrop to dismiss · Escape closes · focus trap
   • Body scroll lock while open, safe-area padding, reduced-motion aware
   • Unmounts after close (AnimatePresence) — zero cost when idle
   Future surface for: notifications, chapter list, search filters,
   share menu, reader settings, theme/language selectors, etc.
   ═══════════════════════════════════════════════════════════════ */

export interface BottomSheetProps {
  /** Controlled open state. */
  open: boolean;
  onClose: () => void;
  /** Accessible label for the dialog. */
  title?: string;
  /** Custom header block — also part of the drag region. */
  header?: React.ReactNode;
  /** Pinned footer (never scrolls). */
  footer?: React.ReactNode;
  /** Scrollable body. */
  children?: React.ReactNode;
  /** Initial height as % of viewport (default 60). */
  initialHeight?: number;
  /** Expanded height as % of viewport (default 95). */
  expandedHeight?: number;
  /** Adds a persistent, accessible close control beside the drag handle. */
  showCloseButton?: boolean;
  className?: string;
}

const SPRING = { type: 'spring' as const, stiffness: 380, damping: 38, mass: 0.9 };
const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 550;
const EXPAND_OFFSET = -70;

export function BottomSheet({
  open,
  onClose,
  title,
  header,
  footer,
  children,
  initialHeight = 60,
  expandedHeight = 95,
  showCloseButton = false,
  className,
}: BottomSheetProps) {
  const reducedMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  const height = `${expanded ? expandedHeight : initialHeight}dvh`;

  // Sheets can be opened from inside blurred/sticky header controls. Render
  // at the document root so those containing blocks cannot clip a viewport UI.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset to the initial snap whenever the sheet re-opens.
  useEffect(() => {
    if (open) setExpanded(false);
  }, [open]);

  // Body scroll lock + Escape + focus restore while open.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);

    const t = setTimeout(() => sheetRef.current?.focus(), 30);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  // Focus trap: keep Tab cycling inside the sheet.
  const onSheetKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const el = sheetRef.current;
    if (!el) return;
    const focusables = el.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
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
  }, []);

  // Drag up → grow the sheet from the bottom edge; drag down → shrink.
  // The visual y stays pinned (bottom-anchored) — the height itself
  // responds, so there is never a gap under the sheet.
  const onDrag = useCallback(
    (_: unknown, info: PanInfo) => {
      if (reducedMotion) return;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
      // Clamp against the *current* snap: when already expanded there is
      // no room to grow, and the sheet must never exceed expandedHeight.
      const current = expanded ? expandedHeight : initialHeight;
      const maxGrow = ((expandedHeight - current) / 100) * vh; // px of upward travel
      const maxShrink = ((current - 40) / 100) * vh; // px of downward travel
      setDragY(Math.max(-maxGrow, Math.min(maxShrink, info.offset.y)));
    },
    [reducedMotion, expanded, initialHeight, expandedHeight],
  );

  // Drag-to-dismiss / drag-up-to-expand with momentum.
  const onDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (reducedMotion) return;
      setDragY(0); // spring back to the current snap
      if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) {
        onClose();
      } else if (info.offset.y < EXPAND_OFFSET || info.velocity.y < -DISMISS_VELOCITY) {
        setExpanded(true);
      }
    },
    [onClose, reducedMotion],
  );

  // Begin dragging from the handle/header region (native pointer event).
  const onDragRegionPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (reducedMotion) return;
      dragControls.start(e.nativeEvent);
    },
    [dragControls, reducedMotion],
  );

  const entrance = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
    : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, transition: SPRING };

  const sheet = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80]">
          {/* Backdrop — blur + 0 → 0.45 opacity */}
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0 bg-black backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Entrance/exit wrapper — slides the sheet in/out; no drag here
              so the transform never conflicts with the drag gesture. The
              sheet below is in-flow so this wrapper's height = sheet height
              and y: 100% slides the full sheet off-screen. */}
          <motion.div className="absolute inset-x-0 bottom-0" {...entrance}>
            {/* Sheet — the drag surface. Height (not y) responds to drags. */}
            <motion.div
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-label={title ?? 'Sheet'}
              tabIndex={-1}
              onKeyDown={onSheetKeyDown}
              drag={reducedMotion ? false : 'y'}
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: expanded ? 0 : 0.08, bottom: 0.12 }}
              dragMomentum={false}
              onDrag={onDrag}
              onDragEnd={onDragEnd}
              className={cn(
                'relative flex flex-col overflow-hidden rounded-t-3xl border border-b-0 border-mv-border-light bg-mv-darker shadow-modal outline-none',
                'pb-[max(env(safe-area-inset-bottom),0.75rem)]',
                className,
              )}
              style={{
                height: reducedMotion ? height : `calc(${height} - ${dragY}px)`,
              }}
            >
              {/* Drag region — handle + header share the grab surface */}
              <div onPointerDown={onDragRegionPointerDown} className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing">
                {/* Drag handle */}
                <div className="flex justify-center pt-2.5" aria-hidden="true">
                  <span className="h-1.5 w-12 rounded-full bg-white/15" />
                </div>
                {header}
              </div>
              {showCloseButton && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={onClose}
                  aria-label={`Close ${title ?? 'sheet'}`}
                  className="tap-target absolute right-3 top-2.5 z-10 flex h-10 w-10 items-center justify-center rounded-xl text-mv-text-muted transition-colors hover:bg-white/5 hover:text-white"
                >
                  <Icon name="close" size={16} />
                </button>
              )}

              {/* Scrollable body */}
              <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-4', !header && title && 'pt-2')}>
                {children}
              </div>

              {/* Footer (optional, pinned) */}
              {footer && <div className="shrink-0 border-t border-mv-border/70 px-4 pt-3">{footer}</div>}
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return mounted ? (createPortal(sheet, document.body) as unknown as React.ReactElement) : null;
}

/** Slim default sheet header with title + close button (not draggable). */
export function SheetHeader({ title, onClose, eyebrow }: { title: string; onClose: () => void; eyebrow?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-1">
      <div className="min-w-0">
        {eyebrow && <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-dim">{eyebrow}</p>}
        <p className="truncate text-sm font-semibold text-white">{title}</p>
      </div>
      <button
        onClick={onClose}
        aria-label={`Close ${title}`}
        className="tap-target h-10 w-10 shrink-0 rounded-xl text-mv-text-muted transition-colors hover:bg-white/5 hover:text-white"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

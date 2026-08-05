'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useLibrary, useAddBookmark, useRemoveBookmark } from '@/lib/hooks/useLibrary';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   CollectionMenu — one-click shelf picker for the details page.
   Shows the user's current shelf for this title; tapping another
   shelf switches it (remove + add, since the API keys bookmarks on
   titleId). Guests get a sign-in CTA instead.
   ═══════════════════════════════════════════════════════════════ */

const SHELVES = [
  { key: 'Reading', icon: 'book' as const, active: 'border-mv-violet/40 bg-mv-violet/15 text-mv-violet' },
  { key: 'Plan to Read', icon: 'bookmark' as const, active: 'border-mv-gold/40 bg-mv-gold/15 text-mv-gold' },
  { key: 'Completed', icon: 'check' as const, active: 'border-mv-success/40 bg-mv-success/15 text-mv-success' },
  { key: 'On Hold', icon: 'pause' as const, active: 'border-blue-400/40 bg-blue-400/15 text-blue-400' },
  { key: 'Dropped', icon: 'close' as const, active: 'border-mv-danger/40 bg-mv-danger/15 text-mv-danger' },
] as const;

export function CollectionMenu({ titleId, title }: { titleId: string; title: string }) {
  const { token } = useAuthStore();
  const { data } = useLibrary(undefined, !!token);
  const add = useAddBookmark();
  const remove = useRemoveBookmark();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const bookmark = data?.items?.find((b) => b.titleId === titleId);
  const currentShelf = bookmark?.listName;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const busy = add.isPending || remove.isPending;

  const pick = async (shelf: string) => {
    if (!token || busy) return;
    setOpen(false);
    try {
      if (currentShelf === shelf) {
        await remove.mutateAsync(titleId); // tapping the active shelf removes it
      } else {
        if (currentShelf) await remove.mutateAsync(titleId);
        await add.mutateAsync({ titleId, listName: shelf });
      }
    } catch {
      // surfaced by hooks
    }
  };

  if (!token) {
    return (
      <a href="/login" className="btn-ghost flex items-center gap-2 px-5 py-2.5 text-xs">
        <Icon name="bookmark" size={14} />
        Add to Library
      </a>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'flex items-center gap-2 rounded-xl border px-5 py-2.5 text-xs font-medium transition-all',
          currentShelf
            ? 'border-mv-violet/40 bg-mv-violet/15 text-mv-violet'
            : 'border-white/10 bg-white/5 text-mv-text-secondary hover:border-mv-violet/40 hover:text-mv-violet',
        )}
      >
        <Icon name="bookmark" size={14} />
        {currentShelf || 'Add to Library'}
        <Icon name="chevronDown" size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-40 mt-2 w-52 overflow-hidden rounded-xl border border-mv-border-light bg-mv-darker/95 p-1.5 shadow-modal backdrop-blur-xl animate-scale-in"
        >
          <p className="px-2.5 pb-1 pt-1.5 text-[9px] font-semibold uppercase tracking-wider text-mv-text-dim">
            {currentShelf ? `On “${currentShelf}”` : 'Add to a shelf'}
          </p>
          {SHELVES.map((s) => {
            const active = currentShelf === s.key;
            return (
              <button
                key={s.key}
                role="menuitem"
                onClick={() => pick(s.key)}
                disabled={busy}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[11px] font-medium transition-colors',
                  active ? s.active : 'text-mv-text-secondary hover:bg-white/5 hover:text-white',
                  busy && 'opacity-50',
                )}
              >
                <Icon name={s.icon} size={13} />
                <span className="flex-1 text-left">{s.key}</span>
                {active && <Icon name="check" size={12} />}
              </button>
            );
          })}
          <p className="mt-1 border-t border-mv-border px-2.5 pt-2 text-[9px] text-mv-text-dim">
            Tap the active shelf again to remove.
          </p>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useLibrary, useAddBookmark, useRemoveBookmark } from '@/lib/hooks/useLibrary';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   BookmarkButton — quick save/remove against the user's library.
   Renders a filled bookmark when saved; animated on toggle.
   Silent for guests (never fires an authed request).
   ═══════════════════════════════════════════════════════════════ */

interface BookmarkButtonProps {
  titleId: string;
  title: string;
  /** Visual variant: 'icon' (cards) or 'pill' (hero). */
  variant?: 'icon' | 'pill';
  className?: string;
}

export function BookmarkButton({ titleId, title, variant = 'icon', className }: BookmarkButtonProps) {
  const { token } = useAuthStore();
  const { data } = useLibrary(undefined, !!token);
  const addBookmark = useAddBookmark();
  const removeBookmark = useRemoveBookmark();
  const [flip, setFlip] = useState(false);
  const [error, setError] = useState(false);

  const saved = !!token && !!data?.items?.some((b) => b.titleId === titleId);
  const busy = addBookmark.isPending || removeBookmark.isPending;

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token || busy) return;
    setFlip(true);
    setTimeout(() => setFlip(false), 350);
    try {
      if (saved) await removeBookmark.mutateAsync(titleId);
      else await addBookmark.mutateAsync({ titleId, listName: 'Reading' });
      setError(false);
    } catch {
      // Surface failure briefly (e.g. duplicate conflict) so the UI is honest.
      setError(true);
      setTimeout(() => setError(false), 1800);
    }
  };

  if (!token) return null;

  const icon =
    variant === 'pill' ? (
      <svg viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 transition-transform" style={{ transform: flip ? 'scale(1.25)' : 'scale(1)' }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 transition-transform" style={{ transform: flip ? 'scale(1.3)' : 'scale(1)' }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    );

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={saved ? `Remove ${title} from library` : `Save ${title} to library`}
      aria-pressed={saved}
      title={saved ? 'Remove from library' : 'Save to library'}
      className={cn(
        variant === 'pill'
          ? 'flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-[11px] font-medium text-white backdrop-blur-sm transition-all hover:border-mv-violet/50 hover:bg-white/15 disabled:opacity-50'
          : 'flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition-all duration-200 hover:bg-mv-accent/90 group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-40',
        saved && variant === 'icon' && 'opacity-100',
        saved && variant === 'pill' && 'border-mv-violet/40 bg-mv-violet/25 text-mv-violet',
        error && (variant === 'icon' ? 'bg-mv-danger/80 opacity-100' : 'border-mv-danger/50 bg-mv-danger/20 text-mv-danger'),
        className,
      )}
    >
      {icon}
      {variant === 'pill' && <span>{saved ? 'Saved' : 'Save'}</span>}
    </button>
  );
}

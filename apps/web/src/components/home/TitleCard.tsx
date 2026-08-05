'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CoverImage } from '@/components/CoverImage';
import { BookmarkButton } from './BookmarkButton';
import { Spotlight } from './primitives';
import { useAddBookmark, useLibrary } from '@/lib/hooks/useLibrary';
import { useAuthStore } from '@/store/authStore';
import { formatType, statusColors } from '@/lib/format';
import type { HomeTitle } from './types';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   TitleCard — the reusable manga card system.
   • Cover with rank / rating / status / progress overlays
   • Hover quick actions: bookmark + context menu (library shelves)
   • Editorial meta: author, genres, type, chapter count
   Used by every discovery rail on the homepage (and reusable across
   the app). Renders a skeleton when no item is provided.
   ═══════════════════════════════════════════════════════════════ */

const SHELF_OPTIONS = ['Plan to Read', 'Completed', 'On Hold'] as const;

export function TitleCard({
  item,
  rank,
  progress,
  compact = false,
  fluid = false,
  badge,
}: {
  item: HomeTitle;
  /** 1-based rank badge. */
  rank?: number;
  /** 0–100 reading progress → progress bar + completed state. */
  progress?: number;
  /** Compact variant (grid rails) hides genre chips. */
  compact?: boolean;
  /** Fluid width for grid layouts (overrides the fixed rail width). */
  fluid?: boolean;
  /** Notification chip (e.g. "New · Ch. 12"). */
  badge?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { token } = useAuthStore();
  const { data } = useLibrary(undefined, !!token);
  const addToShelf = useAddBookmark();
  const bookmarked = !!data?.items?.some((b) => b.titleId === item.id);

  // Close the context menu on outside click / escape
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const pct = progress ?? (item.rating ? 0 : undefined);
  const isComplete = pct !== undefined && pct >= 100;
  const status = statusColors(item.status);

  // The shelf menu is for discovering titles you haven't saved yet —
  // saved titles use the bookmark button (and shelf moves live in Library).
  const showMenu = !!token && !bookmarked;

  return (
    <div className={cn('group relative shrink-0', fluid ? 'w-full' : 'w-[130px] sm:w-[148px]')}>
      <Spotlight className="rounded-xl">
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-mv-border bg-mv-surface">
          <Link href={`/title/${item.slug}`} className="img-zoom absolute inset-0" aria-label={`View ${item.title}`}>
            <CoverImage src={item.coverUrl} title={item.title} type={item.type} className="h-full w-full" />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            {/* Quick actions */}
            <div className="absolute inset-x-2 bottom-2 flex items-center justify-between opacity-0 transition-all duration-300 group-hover:opacity-100">
              <BookmarkButton titleId={item.id} title={item.title} />
              <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[9px] font-semibold text-white backdrop-blur-sm">
                View
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </span>
            </div>
          </Link>

          {/* Rank badge */}
          {typeof rank === 'number' && (
            <span className="absolute left-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-md bg-gradient-to-br from-mv-purple to-mv-accent px-1.5 text-[11px] font-bold text-white shadow-glow-sm">
              {rank}
            </span>
          )}

          {/* Rating */}
          {item.rating != null && (
            <span className="glass absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-medium text-mv-gold">
              ★ {item.rating.toFixed(1)}
            </span>
          )}

          {/* Status */}
          <span className={cn('status-pill absolute bottom-1.5 left-1.5', status.className)}>{status.label}</span>

          {/* Reading progress bar */}
          {pct !== undefined && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
              <div
                className={cn('h-full transition-all duration-500', isComplete ? 'bg-mv-success' : 'bg-gradient-to-r from-mv-purple to-mv-accent')}
                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
              />
            </div>
          )}
          {badge && (
            <span className="absolute bottom-1.5 right-1.5 rounded-md bg-gradient-to-r from-mv-accent to-mv-purple px-1.5 py-0.5 text-[8px] font-bold text-white shadow-glow-sm">
              {badge}
            </span>
          )}
        </div>
      </Spotlight>

      {/* Meta */}
      <div className="mt-2">
        <Link href={`/title/${item.slug}`} className="line-clamp-2 text-xs font-medium leading-snug text-mv-text-secondary transition-colors group-hover:text-white">
          {item.title}
        </Link>
        <p className="mt-1 flex items-center justify-between text-[9px] text-mv-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="rounded bg-white/5 px-1.5 py-0.5 font-medium uppercase text-mv-text-dim">{formatType(item.type)}</span>
            <span>{item.totalChapters || '?'} ch</span>
          </span>
          {isComplete && <span className="font-medium text-mv-success">Done ✓</span>}
        </p>
        {!compact && item.author && (
          <Link
            href={`/author/${encodeURIComponent(item.author)}`}
            className="mt-0.5 block truncate text-[9px] italic text-mv-text-dim transition-colors hover:text-mv-violet"
            title={`View works by ${item.author}`}
          >
            {item.author}
          </Link>
        )}
        {!compact && item.genres && item.genres.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {item.genres.slice(0, 2).map((g) => (
              <Link
                key={g}
                href={`/browse?genres=${g}`}
                className="rounded-full border border-mv-border-light bg-mv-surface/50 px-2 py-0.5 text-[8px] text-mv-text-muted transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
              >
                {g.replace(/_/g, ' ')}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Context menu — overlays the cover, so it is never clipped by rail overflow */}
      {showMenu && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setMenuOpen((o) => !o);
            }}
            aria-label={`More actions for ${item.title}`}
            aria-expanded={menuOpen}
            className="absolute right-1.5 top-7 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/70 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
          </button>

          {menuOpen && (
            <div
              ref={menuRef}
              className="absolute inset-0 z-30 overflow-hidden rounded-xl border border-mv-border-light bg-mv-darker/95 backdrop-blur-xl animate-scale-in"
              role="menu"
              aria-label={`Add ${item.title} to a shelf`}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40" />
              <div className="relative flex h-full flex-col justify-end p-2.5">
                <p className="mb-1.5 px-1 text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">
                  Add to shelf
                </p>
                {SHELF_OPTIONS.map((shelf) => (
                  <button
                    key={shelf}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      addToShelf.mutate({ titleId: item.id, listName: shelf });
                    }}
                    className="rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium text-white transition-colors hover:bg-mv-accent/25"
                    role="menuitem"
                  >
                    + {shelf}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="mt-1 rounded-lg px-2.5 py-1.5 text-left text-[10px] text-mv-text-muted transition-colors hover:bg-white/5 hover:text-mv-text"
                  role="menuitem"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Skeleton placeholder matching TitleCard dimensions. */
export function TitleCardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[130px] shrink-0 sm:w-[148px]">
          <div className="skeleton aspect-[3/4] rounded-xl" />
          <div className="skeleton mt-2 h-3 w-4/5 rounded" />
          <div className="skeleton mt-1.5 h-2 w-1/2 rounded" />
        </div>
      ))}
    </>
  );
}

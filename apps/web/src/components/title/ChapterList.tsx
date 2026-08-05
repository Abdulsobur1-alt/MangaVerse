'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { COIN_UNLOCK_COST } from '@mangaverse/shared';
import { cn } from '@/lib/cn';
import type { TitleChapter } from '@/lib/hooks/useTitles';

/* ═══════════════════════════════════════════════════════════════
   ChapterList — the chapter browser, rebuilt.
   • Search by number/title · sort ↑/↓ by number
   • Read (✓) / in-progress (%) / locked (🔒) states
   • Per-chapter ETA, release date, page count
   • Keyboard: ↑/↓ move, ↵ opens, focus stays on the list
   • Load-more pagination (append pages, dedupe)
   ═══════════════════════════════════════════════════════════════ */

function eta(pageCount?: number | null): string {
  if (!pageCount) return '';
  const mins = Math.max(1, Math.round((pageCount * 1.25) / 60));
  return `~${mins}m`;
}

function prettyTitle(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface ChapterListProps {
  chapters: TitleChapter[];
  /** All loaded pages concatenated (for append). */
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export function ChapterList({ chapters, total, hasMore, loadingMore, onLoadMore }: ChapterListProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [asc, setAsc] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? chapters.filter((c) => String(c.number).includes(q) || (c.title ?? '').toLowerCase().includes(q))
      : chapters;
    return [...list].sort((a, b) => (asc ? a.number - b.number : b.number - a.number));
  }, [chapters, query, asc]);

  const readCount = chapters.filter((c) => c.progress?.completed).length;
  const inProgress = chapters.find((c) => c.progress && !c.progress.completed);

  // Keep the focused index in bounds + reset on filter change
  useEffect(() => {
    setFocusedIdx(0);
  }, [query, asc, chapters.length]);

  // Keep the highlighted row visible during keyboard navigation
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-chidx="${focusedIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [focusedIdx]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = filtered[focusedIdx];
      if (hit) router.push(`/reader/${hit.id}`);
    }
  };

  return (
    <section aria-label="Chapters" className="rounded-2xl border border-mv-border bg-mv-darker">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mv-border px-4 py-3.5 sm:px-5">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-white">
            <span className="h-5 w-1 rounded-full bg-gradient-to-b from-mv-purple to-mv-accent" aria-hidden="true" />
            Chapters
            <span className="text-xs font-normal text-mv-text-muted">({total.toLocaleString()})</span>
          </h2>
          {readCount > 0 && (
            <p className="mt-0.5 text-[10px] text-mv-text-muted">
              {readCount} read · {inProgress ? `resumed at Ch. ${inProgress.number}` : 'up to date'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Icon name="search" size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-mv-text-dim" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find chapter…"
              aria-label="Search chapters"
              className="field w-36 py-1.5 pl-8 pr-2 text-[10px] sm:w-44"
            />
          </div>
          {/* Sort */}
          <button
            onClick={() => setAsc((a) => !a)}
            aria-label={asc ? 'Sort newest first' : 'Sort oldest first'}
            aria-pressed={asc}
            title={asc ? 'Oldest first' : 'Newest first'}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-mv-border-light bg-mv-surface text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
          >
            <Icon name="arrowPath" size={13} className={cn('transition-transform', asc && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* List */}
      <div ref={listRef} onKeyDown={onKeyDown} role="listbox" aria-label="Chapter list" tabIndex={0} className="outline-none focus-visible:ring-1 focus-visible:ring-mv-violet/50">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-xs text-mv-text-muted">No chapters match “{query}”.</p>
            <button onClick={() => setQuery('')} className="mt-2 text-[11px] text-mv-violet hover:underline">
              Clear search
            </button>
          </div>
        ) : (
          filtered.map((ch, idx) => {
            const completed = ch.progress?.completed;
            const inProg = ch.progress && !ch.progress.completed;
            const locked = ch.isLocked && !completed;
            const isFocused = idx === focusedIdx;
            return (
              <Link
                key={ch.id}
                href={`/reader/${ch.id}`}
                data-chidx={idx}
                role="option"
                aria-selected={isFocused}
                onMouseEnter={() => setFocusedIdx(idx)}
                className={cn(
                  'group flex items-center gap-3 px-4 py-3 transition-colors sm:px-5',
                  idx > 0 && 'border-t border-mv-border/50',
                  isFocused ? 'bg-mv-surface' : 'hover:bg-mv-surface/60',
                )}
              >
                {/* State icon */}
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold transition-colors',
                    completed
                      ? 'border-mv-success/50 bg-mv-success/15 text-mv-success'
                      : inProg
                        ? 'border-mv-violet/50 bg-mv-accent/10 text-mv-violet'
                        : 'border-mv-border-light text-mv-text-dim',
                  )}
                >
                  {locked ? (
                    <Icon name="lock" size={11} className="text-mv-warning" />
                  ) : completed ? (
                    <Icon name="check" size={12} strokeWidth={3} />
                  ) : inProg ? (
                    <span>{Math.round(((ch.progress?.pageNumber || 0) / (ch.pageCount || 20)) * 100)}%</span>
                  ) : (
                    <span>{ch.number}</span>
                  )}
                </span>

                {/* Copy */}
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-[13px] font-medium transition-colors', completed ? 'text-mv-text-muted' : 'text-mv-text group-hover:text-mv-violet')}>
                    Chapter {ch.number}
                    {ch.title && <span className="ml-2 hidden truncate text-[11px] text-mv-text-muted sm:inline">{prettyTitle(ch.title)}</span>}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-[9px] text-mv-text-dim">
                    {ch.pageCount ? `${ch.pageCount} pages` : 'Pages unknown'}
                    {eta(ch.pageCount) && <span>· {eta(ch.pageCount)} read</span>}
                    {ch.createdAt && <span>· {new Date(ch.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                    {inProg && <span className="font-medium text-mv-violet">· in progress</span>}
                  </span>
                </span>

                {/* Locked chip */}
                {locked && (
                  <span className="shrink-0 rounded border border-mv-warning/30 bg-mv-warning/10 px-2 py-0.5 text-[9px] font-medium text-mv-warning">
                    🔒 {COIN_UNLOCK_COST}🪙
                  </span>
                )}

                <Icon name="chevronRight" size={14} className="shrink-0 text-mv-text-dim transition-colors group-hover:text-mv-violet" />
              </Link>
            );
          })
        )}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="border-t border-mv-border px-4 py-3 text-center">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="rounded-full border border-mv-border-light bg-mv-surface px-5 py-2 text-[11px] font-medium text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : `Load more (${(total - chapters.length).toLocaleString()} remaining)`}
          </button>
        </div>
      )}
    </section>
  );
}

/** Skeleton while the first chapter page loads. */
export function ChapterListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-mv-border bg-mv-darker p-4">
      <div className="skeleton mb-4 h-6 w-32 rounded-lg" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-t border-mv-border/50 py-3 first:border-0">
          <div className="skeleton h-7 w-7 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-3 w-1/3 rounded" />
            <div className="skeleton h-2 w-1/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

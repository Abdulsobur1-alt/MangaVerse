'use client';

import { useState, useMemo } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/AppShell';
import Link from 'next/link';
import { useLibrary, useRemoveBookmark, type BookmarkItem } from '@/lib/hooks/useLibrary';
import { useReadingProgress } from '@/lib/hooks/useReading';
import { useAuthStore } from '@/store/authStore';
import { CoverImage } from '@/components/CoverImage';
import { formatType } from '@/lib/format';

/* ═══════════════════════════════════════════════════════════════
   My Library — a personal bookshelf.
   • Stat tiles: collection size, reading now, completed, chapters read
   • Shelf tabs (All / Reading / Plan to Read / Completed / On Hold / Dropped)
   • Progress visualization on every card + inline resume button
   • Search within the shelf · Grid / List views · per-shelf empty states
   ═══════════════════════════════════════════════════════════════ */

const SHELVES = ['Reading', 'Plan to Read', 'Completed', 'On Hold', 'Dropped'] as const;

interface ProgressInfo {
  chaptersRead: number;
  completed: boolean;
}

interface ReadingEntry {
  chapter: { id: string; number: number; series: { id: string; slug: string } };
  pageNumber: number;
  completed: boolean;
}

/** Latest in-progress (or most recent) chapter per title — for the Continue button. */
function buildResumeMap(
  readingData: ReadingEntry[] | undefined,
): Record<string, { chapterId: string; chapterNumber: number }> {
  const map: Record<string, { chapterId: string; chapterNumber: number }> = {};
  readingData?.forEach((entry) => {
    const titleId = entry.chapter.series.id;
    const existing = map[titleId];
    if (!existing || entry.chapter.number > existing.chapterNumber) {
      map[titleId] = { chapterId: entry.chapter.id, chapterNumber: entry.chapter.number };
    }
  });
  return map;
}

function StatTile({ label, value, accent, hint }: { label: string; value: string | number; accent?: string; hint: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-mv-border bg-mv-darker p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-mv-violet/30 hover:shadow-card-hover">
      <div className="pointer-events-none absolute -right-4 -top-6 h-16 w-16 rounded-full bg-mv-accent/10 blur-2xl transition-opacity group-hover:opacity-100" />
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold tracking-tight ${accent || 'text-white'}`}>{value}</p>
      <p className="mt-0.5 text-[10px] text-mv-text-dim">{hint}</p>
    </div>
  );
}

export default function LibraryPage() {
  const [activeShelf, setActiveShelf] = useState<string>('All');
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { token } = useAuthStore();
  const { data: libraryData, isLoading } = useLibrary();
  const { data: readingData } = useReadingProgress(!!token);
  const removeBookmark = useRemoveBookmark();
  const [removing, setRemoving] = useState<string | null>(null);

  // Progress lookup from reading history
  const progressMap = useMemo(() => {
    const map: Record<string, ProgressInfo> = {};
    (readingData as ReadingEntry[] | undefined)?.forEach((entry) => {
      const titleId = entry.chapter.series.id;
      if (!map[titleId]) map[titleId] = { chaptersRead: 0, completed: false };
      map[titleId].chaptersRead = Math.max(map[titleId].chaptersRead, entry.chapter.number);
      if (entry.completed) map[titleId].completed = true;
    });
    return map;
  }, [readingData]);

  const resumeMap = useMemo(() => buildResumeMap(readingData as ReadingEntry[] | undefined), [readingData]);

  const items: BookmarkItem[] = libraryData?.items || [];

  const shelfCounts = useMemo(() => {
    const counts: Record<string, number> = { All: items.length };
    SHELVES.forEach((s) => {
      counts[s] = items.filter((b) => b.listName === s).length;
    });
    return counts;
  }, [items]);

  // Stats
  const readingNow = items.filter((b) => resumeMap[b.titleId]).length;
  const completed = shelfCounts['Completed'] || 0;
  const chaptersRead = Object.values(progressMap).reduce((sum, p) => sum + p.chaptersRead, 0);

  // Filter: shelf + search
  const filtered = useMemo(() => {
    let list = activeShelf === 'All' ? items : items.filter((b) => b.listName === activeShelf);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((b) => b.title.title.toLowerCase().includes(q));
    }
    return list;
  }, [items, activeShelf, query]);

  const handleRemove = async (titleId: string) => {
    setRemoving(titleId);
    try {
      await removeBookmark.mutateAsync(titleId);
    } catch {
      // Error handled silently
    }
    setRemoving(null);
  };

  const getPct = (b: BookmarkItem) => {
    const p = progressMap[b.titleId];
    if (!p || !b.title.totalChapters) return 0;
    return Math.min(Math.round((p.chaptersRead / b.title.totalChapters) * 100), 100);
  };

  const resume = (b: BookmarkItem) => resumeMap[b.titleId];

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 md:px-8">
          {/* ─── Header ─────────────────────────────── */}
          <div className="mb-7">
            <p className="eyebrow mb-2">Personal Shelf</p>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                My <span className="text-gradient">Library</span>
              </h1>
              {!isLoading && (
                <span className="rounded-full border border-mv-border-light bg-mv-surface/60 px-3 py-1 text-[11px] text-mv-text-secondary">
                  {libraryData?.total || 0} titles · {chaptersRead} chapters read
                </span>
              )}
            </div>
          </div>

          {/* ─── Stat tiles ─────────────────────────── */}
          <div className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="In Library" value={items.length} hint="total bookmarks" />
            <StatTile label="Reading Now" value={readingNow} accent="text-mv-violet" hint="in progress" />
            <StatTile label="Completed" value={completed} accent="text-mv-success" hint="finished series" />
            <StatTile label="Chapters Read" value={chaptersRead.toLocaleString()} accent="text-mv-gold" hint="across all series" />
          </div>

          {/* ─── Toolbar: shelf tabs + search + view ── */}
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Shelf tabs */}
            <div className="scrollbar-none -mx-5 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:px-0" role="group" aria-label="Library shelves">
              {(['All', ...SHELVES] as const).map((shelf) => {
                const active = activeShelf === shelf;
                return (
                  <button
                    key={shelf}
                    aria-pressed={active}
                    onClick={() => setActiveShelf(shelf)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-all duration-200 ${
                      active
                        ? 'bg-gradient-to-r from-mv-purple to-mv-accent text-white shadow-glow-sm'
                        : 'border border-mv-border-light bg-mv-surface/60 text-mv-text-secondary hover:border-mv-violet/40 hover:text-mv-text'
                    }`}
                  >
                    {shelf}
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${active ? 'bg-white/20 text-white' : 'bg-white/5 text-mv-text-dim'}`}>
                      {shelfCounts[shelf] || 0}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search + view toggle */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 lg:w-56 lg:flex-none">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mv-text-dim"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your shelf…"
                  aria-label="Search your library"
                  className="field pl-9 py-2 text-xs"
                />
              </div>
              <div className="flex overflow-hidden rounded-xl border border-mv-border-light">
                <button
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                  aria-pressed={viewMode === 'grid'}
                  className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-mv-accent/20 text-mv-violet' : 'text-mv-text-dim hover:text-mv-text'}`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                  aria-pressed={viewMode === 'list'}
                  className={`border-l border-mv-border-light p-2 transition-colors ${viewMode === 'list' ? 'bg-mv-accent/20 text-mv-violet' : 'text-mv-text-dim hover:text-mv-text'}`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="3.5" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="3.5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="3.5" cy="18" r="1" fill="currentColor" stroke="none" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* ─── Loading skeletons ───────────────────── */}
          {isLoading && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i}>
                  <div className="skeleton aspect-[3/4] rounded-xl" />
                  <div className="skeleton mt-2 h-3 w-4/5 rounded" />
                  <div className="skeleton mt-1.5 h-2 w-1/2 rounded" />
                </div>
              ))}
            </div>
          )}

          {/* ─── Content ─────────────────────────────── */}
          {!isLoading && filtered.length === 0 && (
            <div className="card flex flex-col items-center rounded-3xl px-6 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-mv-purple/20 to-mv-accent/10">
                <svg className="h-7 w-7 text-mv-violet" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-mv-text">
                {query.trim()
                  ? `No titles match “${query}”`
                  : activeShelf === 'All'
                    ? 'Your shelf is empty'
                    : `Nothing on the “${activeShelf}” shelf yet`}
              </p>
              <p className="mt-1 max-w-sm text-xs text-mv-text-muted">
                {query.trim()
                  ? 'Try a different search, or clear the filter.'
                  : 'Explore the catalog and add titles to build your personal bookshelf.'}
              </p>
              {query.trim() ? (
                <button onClick={() => setQuery('')} className="btn-ghost mt-6 px-5 py-2.5 text-xs">
                  Clear Search
                </button>
              ) : (
                <Link href="/browse" className="btn-primary mt-6 px-5 py-2.5 text-xs">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Discover Titles
                </Link>
              )}
            </div>
          )}

          {/* Grid view */}
          {!isLoading && filtered.length > 0 && viewMode === 'grid' && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filtered.map((bookmark) => {
                const pct = getPct(bookmark);
                const r = resume(bookmark);
                const busy = removing === bookmark.titleId;
                return (
                  <div key={bookmark.id} className={`group relative ${busy ? 'opacity-40' : ''}`}>
                    <div className="card-lift img-zoom relative aspect-[3/4] overflow-hidden rounded-xl border border-mv-border bg-mv-surface">
                      <Link href={`/title/${bookmark.title.slug}`} className="absolute inset-0" aria-label={`View ${bookmark.title.title}`}>
                        <CoverImage src={bookmark.title.coverUrl} title={bookmark.title.title} type={bookmark.title.type} className="h-full w-full" />
                        <div className="absolute inset-0 bg-gradient-to-t from-mv-dark/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        {/* Progress bar */}
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
                          <div
                            className={`h-full transition-all duration-500 ${pct >= 100 ? 'bg-mv-success' : 'bg-gradient-to-r from-mv-purple to-mv-accent'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </Link>
                      {/* Resume chip — real reader link, sibling of the cover link */}
                      {r && (
                        <Link
                          href={`/reader/${r.chapterId}`}
                          className="absolute bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-3 py-1 text-[9px] font-semibold text-white opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:opacity-100 hover:bg-gradient-to-r hover:from-mv-accent hover:to-mv-purple"
                        >
                          Continue · Ch. {r.chapterNumber} →
                        </Link>
                      )}
                    </div>
                    {/* Remove */}
                    <button
                      onClick={() => handleRemove(bookmark.titleId)}
                      disabled={busy}
                      aria-label={`Remove ${bookmark.title.title} from library`}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-mv-text-muted opacity-0 backdrop-blur-sm transition-all hover:bg-mv-danger/80 hover:text-white group-hover:opacity-100 disabled:opacity-30"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <div className="mt-2.5">
                      <Link href={`/title/${bookmark.title.slug}`}>
                        <p className="line-clamp-2 text-xs font-medium leading-snug text-mv-text-secondary transition-colors group-hover:text-white">
                          {bookmark.title.title}
                        </p>
                      </Link>
                      <p className="mt-1 flex items-center gap-1.5 text-[9px] text-mv-text-muted">
                        <span className="rounded bg-white/5 px-1.5 py-0.5 font-medium uppercase text-mv-text-dim">{formatType(bookmark.title.type)}</span>
                        <span className={pct >= 100 ? 'text-mv-success' : 'text-mv-violet'}>{pct >= 100 ? 'Completed' : `${pct}% read`}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* List view */}
          {!isLoading && filtered.length > 0 && viewMode === 'list' && (
            <div className="overflow-hidden rounded-2xl border border-mv-border bg-mv-darker">
              {filtered.map((bookmark, idx) => {
                const pct = getPct(bookmark);
                const r = resume(bookmark);
                const busy = removing === bookmark.titleId;
                return (
                  <div
                    key={bookmark.id}
                    className={`group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-mv-surface ${idx > 0 ? 'border-t border-mv-border/60' : ''} ${busy ? 'opacity-40' : ''}`}
                  >
                    <Link href={`/title/${bookmark.title.slug}`} className="block h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-mv-surface">
                      <CoverImage src={bookmark.title.coverUrl} title={bookmark.title.title} type={bookmark.title.type} className="h-full w-full" />
                    </Link>
                    <Link href={`/title/${bookmark.title.slug}`} className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-mv-text transition-colors group-hover:text-mv-violet">
                        {bookmark.title.title}
                      </p>
                      <p className="mt-0.5 text-[10px] text-mv-text-muted">
                        {formatType(bookmark.title.type)} · {bookmark.listName} · {bookmark.title.totalChapters || '?'} chapters
                      </p>
                      <div className="mt-2 flex max-w-xs items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-mv-success' : 'bg-gradient-to-r from-mv-purple to-mv-accent'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-[9px] text-mv-text-dim">{pct}%</span>
                      </div>
                    </Link>
                    {r && (
                      <Link
                        href={`/reader/${r.chapterId}`}
                        className="hidden shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-mv-accent to-mv-purple px-3.5 py-1.5 text-[10px] font-semibold text-white shadow-md shadow-mv-accent/25 transition-all hover:brightness-110 sm:inline-flex"
                      >
                        Continue · Ch. {r.chapterNumber}
                      </Link>
                    )}
                    <button
                      onClick={() => handleRemove(bookmark.titleId)}
                      disabled={busy}
                      aria-label={`Remove ${bookmark.title.title} from library`}
                      className="shrink-0 rounded-lg p-1.5 text-mv-text-dim transition-colors hover:bg-mv-danger/10 hover:text-mv-danger disabled:opacity-30"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

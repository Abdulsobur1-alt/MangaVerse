'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/AppShell';
import Link from 'next/link';
import { useLibrary, useRemoveBookmark, type BookmarkItem } from '@/lib/hooks/useLibrary';
import { useReadingProgress } from '@/lib/hooks/useReading';
import { useCollections } from '@/lib/hooks/useCollections';
import { usePrefs, useUpdatePrefs, type LibraryView } from '@/lib/hooks/usePrefs';
import { useAuthStore } from '@/store/authStore';
import { useResumeData } from '@/components/shell/ContinueReading';
import { CoverImage } from '@/components/CoverImage';
import { Icon } from '@/components/ui/Icon';
import { formatType } from '@/lib/format';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   My Library — a premium personal reading hub (Phase 7).
   Answers "what am I reading, what's next, what have I finished?":
   • Welcome header + quick stats + streak
   • Continue Reading rail — resume the moment you land
   • Custom-collections strip (deep-links to /collections)
   • Five default shelves with live counts, search, and three views
     (grid / list / compact) — default view syncs to device prefs
   • Per-shelf premium empty states that point to the next action
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

function StatTile({ label, value, accent, hint, icon }: { label: string; value: string | number; accent?: string; hint: string; icon: 'book' | 'play' | 'check' | 'chart' | 'flame' }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-mv-border bg-mv-darker p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-mv-violet/30 hover:shadow-card-hover">
      <div className="pointer-events-none absolute -right-4 -top-6 h-16 w-16 rounded-full bg-mv-accent/10 blur-2xl transition-opacity group-hover:opacity-100" />
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">{label}</p>
        <Icon name={icon} size={13} className="text-mv-text-dim" />
      </div>
      <p className={`mt-1.5 text-2xl font-bold tracking-tight ${accent || 'text-white'}`}>{value}</p>
      <p className="mt-0.5 text-[10px] text-mv-text-dim">{hint}</p>
    </div>
  );
}

/** Latest in-progress (or most recent) chapter per title — for resume links. */
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

const VIEWS: { key: LibraryView; label: string; icon: 'grid' | 'list' | 'menu' }[] = [
  { key: 'grid', label: 'Grid view', icon: 'grid' },
  { key: 'list', label: 'List view', icon: 'list' },
  { key: 'compact', label: 'Compact view', icon: 'menu' },
];

export default function LibraryPage() {
  const { token, user } = useAuthStore();
  const [activeShelf, setActiveShelf] = useState<string>('All');
  const [query, setQuery] = useState('');
  const { data: prefs } = usePrefs(!!token);
  const updatePrefs = useUpdatePrefs();
  const [viewMode, setViewMode] = useState<LibraryView>('grid');

  // Default view syncs to device prefs (once loaded) and persists back.
  useEffect(() => {
    if (prefs?.libraryView) setViewMode(prefs.libraryView);
  }, [prefs?.libraryView]);

  const switchView = (mode: LibraryView) => {
    setViewMode(mode);
    if (token && prefs?.libraryView !== mode) updatePrefs.mutate({ libraryView: mode });
  };

  const { data: libraryData, isLoading } = useLibrary(undefined, !!token);
  const { data: readingData } = useReadingProgress(!!token);
  const { data: collections } = useCollections(!!token);
  const removeBookmark = useRemoveBookmark();
  const [removing, setRemoving] = useState<string | null>(null);
  const resume = useResumeData(10);

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

  const resumeFor = (b: BookmarkItem) => resumeMap[b.titleId];
  const dense = prefs?.cardDensity === 'compact';

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 md:px-8">
          {/* ─── Welcome header ─────────────────────── */}
          <header className="relative overflow-hidden">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-mv-purple/15 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow mb-2">Personal Shelf</p>
                <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                  {user?.displayName ? `${user.displayName.split(' ')[0]}'s ` : 'My '}
                  <span className="text-gradient">Library</span>
                </h1>
                <p className="mt-1.5 text-xs text-mv-text-muted">
                  Your bookshelf, reading journal, and next great read — in one place.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!isLoading && (
                  <span className="rounded-full border border-mv-border-light bg-mv-surface/60 px-3 py-1 text-[11px] text-mv-text-secondary">
                    {libraryData?.total || 0} titles · {chaptersRead.toLocaleString()} chapters read
                  </span>
                )}
                <Link
                  href="/bookmarks"
                  className="flex items-center gap-1.5 rounded-full border border-mv-border-light bg-mv-surface/60 px-3 py-1 text-[11px] font-medium text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
                >
                  <Icon name="bookmark" size={12} />
                  Bookmarks
                </Link>
                <Link
                  href="/download"
                  className="flex items-center gap-1.5 rounded-full border border-mv-border-light bg-mv-surface/60 px-3 py-1 text-[11px] font-medium text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
                >
                  <Icon name="download" size={12} />
                  Downloads
                </Link>
                <Link
                  href="/goals"
                  className="flex items-center gap-1.5 rounded-full border border-mv-border-light bg-mv-surface/60 px-3 py-1 text-[11px] font-medium text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
                >
                  <Icon name="zap" size={12} />
                  Goals
                </Link>
              </div>
            </div>
          </header>

          {/* ─── Continue Reading rail ──────────────── */}
          {resume.entries.length > 0 && (
            <section aria-label="Continue reading" className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Icon name="play" size={15} className="text-mv-violet" />
                  Continue Reading
                </h2>
                <Link href="/history" className="text-[10px] text-mv-text-dim transition-colors hover:text-mv-violet">
                  Full history →
                </Link>
              </div>
              <div className="scrollbar-none -mx-5 flex gap-3 overflow-x-auto px-5 sm:mx-0 sm:px-0">
                {resume.entries.map((entry) => (
                  <Link
                    key={entry.titleId}
                    href={`/reader/${entry.chapterId}`}
                    className="group/rail relative w-32 shrink-0 overflow-hidden rounded-xl border border-mv-border bg-mv-darker transition-all duration-300 hover:-translate-y-0.5 hover:border-mv-violet/40 hover:shadow-card-hover"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden bg-mv-surface">
                      <CoverImage src={entry.coverUrl} title={entry.title} type={entry.type} className="h-full w-full transition-transform duration-500 group-hover/rail:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-mv-dark/90 via-transparent to-transparent" />
                      <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-2 py-0.5 text-[8px] font-semibold text-white backdrop-blur-sm">
                        Ch. {entry.chapterNumber}
                      </span>
                    </div>
                    <div className="p-2">
                      <p className="truncate text-[10px] font-medium text-mv-text-secondary transition-colors group-hover/rail:text-white">
                        {entry.title}
                      </p>
                      {/* Progress bar */}
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-mv-purple to-mv-accent transition-all duration-500"
                          style={{ width: `${Math.max(4, entry.pct)}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ─── Stat tiles ─────────────────────────── */}
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
            <StatTile label="In Library" value={items.length} hint="total bookmarks" icon="book" />
            <StatTile label="Reading Now" value={readingNow} accent="text-mv-violet" hint="in progress" icon="play" />
            <StatTile label="Completed" value={completed} accent="text-mv-success" hint="finished series" icon="check" />
            <StatTile label="Chapters Read" value={chaptersRead.toLocaleString()} accent="text-mv-gold" hint="across all series" icon="chart" />
            <StatTile label="Streak" value={user?.streakDays ?? 0} accent="text-mv-orange" hint="days in a row" icon="flame" />
          </div>

          {/* ─── Custom collections strip ───────────── */}
          {!isLoading && (
            <section aria-label="My collections" className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Icon name="sparkles" size={15} className="text-mv-violet" />
                  My Collections
                </h2>
                <Link href="/collections" className="text-[10px] text-mv-text-dim transition-colors hover:text-mv-violet">
                  Manage →
                </Link>
              </div>
              {collections && collections.length > 0 ? (
                <div className="scrollbar-none -mx-5 flex gap-3 overflow-x-auto px-5 sm:mx-0 sm:px-0">
                  {collections.slice(0, 6).map((c) => (
                    <Link
                      key={c.id}
                      href={`/collection/${c.id}`}
                      className="group/card relative flex w-40 shrink-0 items-center gap-3 rounded-xl border border-mv-border bg-mv-darker p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-mv-violet/40 hover:shadow-card-hover"
                    >
                      <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-mv-surface">
                        {c.cover ? (
                          <CoverImage src={c.cover} title={c.name} type="MANGA" className="h-full w-full" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-mv-purple/25 to-mv-accent/15">
                            <Icon name="sparkles" size={14} className="text-mv-violet" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-medium text-mv-text-secondary transition-colors group-hover/card:text-white">
                          {c.name}
                        </p>
                        <p className="text-[9px] text-mv-text-dim">{c.itemCount} title{c.itemCount === 1 ? '' : 's'}</p>
                      </div>
                    </Link>
                  ))}
                  <Link
                    href="/collections"
                    className="flex w-40 shrink-0 items-center justify-center gap-2 rounded-xl border border-dashed border-mv-border-light text-mv-text-dim transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
                  >
                    <Icon name="plus" size={14} />
                    <span className="text-[11px] font-medium">New collection</span>
                  </Link>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-dashed border-mv-border-light px-4 py-3">
                  <p className="text-[11px] text-mv-text-muted">
                    Collections are your own curated shelves — “Weekend Reads”, “Peak Fiction”, anything.
                  </p>
                  <Link
                    href="/collections"
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-mv-purple to-mv-accent px-3.5 py-1.5 text-[10px] font-semibold text-white transition-all hover:brightness-110"
                  >
                    <Icon name="plus" size={12} />
                    Create one
                  </Link>
                </div>
              )}
            </section>
          )}

          {/* ─── Toolbar: shelf tabs + search + view ── */}
          <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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

            <div className="flex items-center gap-2">
              <div className="relative flex-1 lg:w-56 lg:flex-none">
                <Icon name="search" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mv-text-dim" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your shelf…"
                  aria-label="Search your library"
                  className="field pl-9 py-2 text-xs"
                />
              </div>
              <div className="flex overflow-hidden rounded-xl border border-mv-border-light">
                {VIEWS.map((view, i) => (
                  <button
                    key={view.key}
                    onClick={() => switchView(view.key)}
                    aria-label={view.label}
                    aria-pressed={viewMode === view.key}
                    className={cn(
                      'p-2 transition-colors',
                      i > 0 && 'border-l border-mv-border-light',
                      viewMode === view.key ? 'bg-mv-accent/20 text-mv-violet' : 'text-mv-text-dim hover:text-mv-text',
                    )}
                  >
                    <Icon name={view.icon} size={15} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Loading skeletons ───────────────────── */}
          {isLoading && (
            <div className={cn('mt-6 grid gap-4', dense ? 'grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6')}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i}>
                  <div className="skeleton aspect-[3/4] rounded-xl" />
                  <div className="skeleton mt-2 h-3 w-4/5 rounded" />
                  <div className="skeleton mt-1.5 h-2 w-1/2 rounded" />
                </div>
              ))}
            </div>
          )}

          {/* ─── Empty state ─────────────────────────── */}
          {!isLoading && filtered.length === 0 && (
            <div className="card flex flex-col items-center rounded-3xl px-6 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-mv-purple/20 to-mv-accent/10">
                <Icon name="library" size={26} className="text-mv-violet" />
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
                  : activeShelf === 'Completed'
                    ? 'Finish a series and it will live here — every completed chapter counts.'
                    : 'Explore the catalog and add titles to build your personal bookshelf.'}
              </p>
              <div className="mt-6 flex items-center gap-2">
                {query.trim() ? (
                  <button onClick={() => setQuery('')} className="btn-ghost px-5 py-2.5 text-xs">
                    Clear Search
                  </button>
                ) : (
                  <Link href="/browse" className="btn-primary px-5 py-2.5 text-xs">
                    <Icon name="search" size={13} className="mr-1.5 inline" />
                    Discover Titles
                  </Link>
                )}
                {!query.trim() && activeShelf === 'All' && (
                  <Link href="/collections" className="btn-ghost px-5 py-2.5 text-xs">
                    Create a collection
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* ─── Grid view ───────────────────────────── */}
          {!isLoading && filtered.length > 0 && viewMode === 'grid' && (
            <div className={cn('mt-6 grid gap-x-4 gap-y-7', dense ? 'grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6')}>
              {filtered.map((bookmark) => {
                const pct = getPct(bookmark);
                const r = resumeFor(bookmark);
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
                    <button
                      onClick={() => handleRemove(bookmark.titleId)}
                      disabled={busy}
                      aria-label={`Remove ${bookmark.title.title} from library`}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-mv-text-muted opacity-0 backdrop-blur-sm transition-all hover:bg-mv-danger/80 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-30"
                    >
                      <Icon name="close" size={11} />
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

          {/* ─── List view ───────────────────────────── */}
          {!isLoading && filtered.length > 0 && viewMode === 'list' && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-mv-border bg-mv-darker">
              {filtered.map((bookmark, idx) => {
                const pct = getPct(bookmark);
                const r = resumeFor(bookmark);
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
                      <Icon name="close" size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── Compact view ────────────────────────── */}
          {!isLoading && filtered.length > 0 && viewMode === 'compact' && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-mv-border bg-mv-darker">
              {filtered.map((bookmark, idx) => {
                const pct = getPct(bookmark);
                const r = resumeFor(bookmark);
                const busy = removing === bookmark.titleId;
                return (
                  <div
                    key={bookmark.id}
                    className={`group flex items-center gap-3 px-3 py-2 transition-colors hover:bg-mv-surface ${idx > 0 ? 'border-t border-mv-border/60' : ''} ${busy ? 'opacity-40' : ''}`}
                  >
                    <Link href={`/title/${bookmark.title.slug}`} className="block h-10 w-7 shrink-0 overflow-hidden rounded bg-mv-surface">
                      <CoverImage src={bookmark.title.coverUrl} title={bookmark.title.title} type={bookmark.title.type} className="h-full w-full" />
                    </Link>
                    <Link href={`/title/${bookmark.title.slug}`} className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-mv-text transition-colors group-hover:text-mv-violet">
                        {bookmark.title.title}
                      </p>
                      <p className="text-[9px] text-mv-text-muted">
                        {formatType(bookmark.title.type)} · {bookmark.listName}
                      </p>
                    </Link>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[8px] font-semibold', pct >= 100 ? 'bg-mv-success/15 text-mv-success' : 'bg-mv-violet/15 text-mv-violet')}>
                      {pct >= 100 ? 'Done' : `${pct}%`}
                    </span>
                    {r && (
                      <Link
                        href={`/reader/${r.chapterId}`}
                        title={`Continue chapter ${r.chapterNumber}`}
                        className="shrink-0 rounded-full p-1.5 text-mv-text-dim opacity-0 transition-all hover:bg-mv-violet/15 hover:text-mv-violet focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Icon name="play" size={13} />
                      </Link>
                    )}
                    <button
                      onClick={() => handleRemove(bookmark.titleId)}
                      disabled={busy}
                      aria-label={`Remove ${bookmark.title.title} from library`}
                      className="shrink-0 rounded-lg p-1.5 text-mv-text-dim opacity-0 transition-all hover:bg-mv-danger/10 hover:text-mv-danger focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-30"
                    >
                      <Icon name="close" size={13} />
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

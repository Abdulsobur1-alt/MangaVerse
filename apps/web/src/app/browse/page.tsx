'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { TopBar } from '@/components/TopBar';
import { CoverImage } from '@/components/CoverImage';
import { useTitles, useSearchSuggestions } from '@/lib/hooks/useTitles';
import { getPageNumbers } from '@mangaverse/shared';
import { formatTimeAgo, formatType, statusColors } from '@/lib/format';

const FORMATS = ['All', 'manga', 'manhwa', 'manhua', 'light_novel'];
const STATUSES = ['All', 'ongoing', 'completed', 'hiatus'];
const ALL_GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Isekai', 'Mecha', 'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'];
const SORTS = [
  { value: 'trending', label: '🔥 Trending' },
  { value: 'updated', label: '🔄 Recently Updated' },
  { value: 'newest', label: '🆕 Newest' },
  { value: 'rating', label: '⭐ Rating' },
  { value: 'title', label: '📄 A–Z' },
];
const RESULTS_PER_PAGE = 24;

/** Normalize a display genre ("Sci-Fi", "Slice of Life") to the canonical
 *  snake_case form stored by the API ("sci-fi", "slice_of_life"). */
function normalizeGenre(g: string): string {
  return g.trim().toLowerCase().replace(/\s+/g, '_');
}

/** Pretty-print a stored genre value for UI tags. */
function prettyGenre(g: string): string {
  return g.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Read deep-link params from the URL: /browse?format=manhwa&sort=updated&genres=action */
function readDeepLinkParams() {
  if (typeof window === 'undefined') return { format: '', status: '', genres: [] as string[], sort: 'trending' };
  const params = new URLSearchParams(window.location.search);
  return {
    format: params.get('format') || '',
    status: params.get('status') || '',
    genres: (params.get('genres') || '').split(',').filter(Boolean),
    sort: params.get('sort') || 'trending',
  };
}

function BrowsePage() {
  // Hydration-safe deep links: render defaults during SSR/hydration, then sync
  // the URL params once after mount (avoids server/client mismatch on
  // /browse?format=… direct loads). Deep links from Home arrive via fresh
  // navigation, so this effect still applies them on mount.
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [sort, setSort] = useState('trending');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showGenrePanel, setShowGenrePanel] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Apply deep-link URL params once after mount
  useEffect(() => {
    const p = readDeepLinkParams();
    setType(p.format);
    setStatus(p.status);
    setSelectedGenres(p.genres);
    setSort(p.sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch search suggestions for autocomplete
  const { data: suggestions } = useSearchSuggestions(
    search.length > 1 && !debouncedSearch ? search : '',
  );

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Build genres query param (normalized to canonical snake_case)
  const genresParam = selectedGenres.length > 0 ? selectedGenres.map(normalizeGenre).join(',') : undefined;

  const { data, isLoading } = useTitles({
    page,
    limit: RESULTS_PER_PAGE,
    type: type || undefined,
    status: status || undefined,
    genres: genresParam,
    sort,
    search: debouncedSearch || undefined,
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  const handleGenreToggle = (genre: string) => {
    // Store canonical values in state so deep-linked (canonical) and
    // panel-chosen (display) forms never create duplicates.
    const norm = normalizeGenre(genre);
    setSelectedGenres(prev => {
      const existing = prev.find(g => normalizeGenre(g) === norm);
      return existing ? prev.filter(g => g !== existing) : [...prev, norm];
    });
    setPage(1);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearch(suggestion);
    setDebouncedSearch(suggestion);
    setShowSuggestions(false);
    setPage(1);
  };

  return (
    <main className="min-h-screen bg-mv-dark">
      <TopBar />

      <div className="mx-auto max-w-7xl p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-black text-white">
              <span className="h-7 w-1.5 rounded-full bg-gradient-to-b from-mv-accent to-mv-purple" />
              <span className="bg-gradient-to-r from-white to-mv-text-secondary bg-clip-text text-transparent">Browse Titles</span>
            </h1>
            <p className="mt-1.5 pl-4 text-xs text-mv-text-muted">
              {isLoading ? 'Searching...' : `${data?.total?.toLocaleString() || 0} titles`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-mv-accent/20 text-mv-accent' : 'text-mv-text-dim hover:text-mv-text'}`}
              title="Grid view"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded p-1.5 transition-colors ${viewMode === 'list' ? 'bg-mv-accent/20 text-mv-accent' : 'text-mv-text-dim hover:text-mv-text'}`}
              title="List view"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search with suggestions */}
        <div className="relative mb-6" ref={searchRef}>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Search by title, author, genre..."
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 pl-11 text-sm text-mv-text outline-none backdrop-blur-sm placeholder:text-mv-text-dim transition-all focus:border-mv-accent/60 focus:bg-white/[0.05] focus:shadow-lg focus:shadow-mv-accent/10"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-mv-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {search && (
            <button
              onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-mv-text-dim hover:text-mv-text"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {/* Search Suggestions */}
          {showSuggestions && suggestions && suggestions.length > 0 && (
            <div className="glass absolute top-full left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl shadow-2xl shadow-black/50 animate-fade-up">
              <p className="px-4 py-2 text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted bg-mv-surface">Suggestions</p>
              {suggestions.map((s) => (
                <button
                  key={s.slug}
                  onClick={() => handleSuggestionClick(s.title)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs text-mv-text-secondary hover:bg-mv-surface transition-colors"
                >
                  <span className="text-mv-text-dim">{s.type === 'MANHWA' ? '🇰🇷' : s.type === 'MANHUA' ? '🇨🇳' : s.type === 'LIGHT_NOVEL' ? '📕' : '📖'}</span>
                  <span className="flex-1">{s.title}</span>
                  <span className="rounded bg-mv-surface px-1.5 py-0.5 text-[9px] text-mv-text-dim">{s.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filters bar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {/* Format */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">Format</span>
            <div className="flex gap-1">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  onClick={() => { setType(f === 'All' ? '' : f); setPage(1); }}
                  className={`rounded-full px-2.5 py-1 text-[10px] transition-all duration-200 ${
                    (f === 'All' && !type) || f === type
                      ? 'bg-gradient-to-r from-mv-accent to-mv-purple font-medium text-white shadow-md shadow-mv-accent/25'
                      : 'bg-white/[0.04] text-mv-text-secondary hover:bg-white/[0.08] hover:text-mv-text'
                  }`}
                >
                  {f === 'light_novel' ? 'LN' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">Status</span>
            <div className="flex gap-1">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatus(s === 'All' ? '' : s); setPage(1); }}
                  className={`rounded-full px-2.5 py-1 text-[10px] transition-all duration-200 ${
                    (s === 'All' && !status) || s === status
                      ? 'bg-gradient-to-r from-mv-accent to-mv-purple font-medium text-white shadow-md shadow-mv-accent/25'
                      : 'bg-white/[0.04] text-mv-text-secondary hover:bg-white/[0.08] hover:text-mv-text'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Genre selector */}
          <div className="relative">
            <button
              onClick={() => setShowGenrePanel(!showGenrePanel)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] transition-colors ${
                selectedGenres.length > 0
                  ? 'bg-mv-purple/20 text-mv-purple border border-mv-purple/30'
                  : 'bg-mv-surface text-mv-text-secondary hover:bg-mv-border-light'
              }`}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Genres{selectedGenres.length > 0 ? ` (${selectedGenres.length})` : ''}
            </button>

            {showGenrePanel && (
              <div className="glass absolute top-full left-0 z-40 mt-2 w-64 rounded-2xl p-3 shadow-2xl shadow-black/50 animate-fade-up">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-mv-text">Filter by Genre</p>
                  {selectedGenres.length > 0 && (
                    <button
                      onClick={() => { setSelectedGenres([]); setPage(1); }}
                      className="text-[9px] text-mv-text-dim hover:text-mv-accent"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_GENRES.map((g) => (
                    <button
                      key={g}
                      onClick={() => handleGenreToggle(g)}
                      className={`rounded-full px-2.5 py-1 text-[10px] transition-colors ${
                        selectedGenres.includes(g)
                          ? 'bg-mv-accent/20 text-mv-accent border border-mv-accent/40'
                          : 'bg-mv-surface text-mv-text-secondary hover:bg-mv-border-light border border-transparent'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="ml-auto rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-mv-text outline-none transition-all focus:border-mv-accent/60"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Active filter tags */}
        {(type || status || selectedGenres.length > 0 || debouncedSearch) && (
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] text-mv-text-dim">Active filters:</span>
            {type && (
              <span className="flex items-center gap-1 rounded-full bg-mv-accent/10 px-2 py-0.5 text-[9px] text-mv-accent">
                {type}
                <button onClick={() => { setType(''); setPage(1); }} className="hover:text-white">×</button>
              </span>
            )}
            {status && (
              <span className="flex items-center gap-1 rounded-full bg-mv-accent/10 px-2 py-0.5 text-[9px] text-mv-accent">
                {status}
                <button onClick={() => { setStatus(''); setPage(1); }} className="hover:text-white">×</button>
              </span>
            )}
            {selectedGenres.map(g => (
              <span key={g} className="flex items-center gap-1 rounded-full bg-mv-purple/10 px-2 py-0.5 text-[9px] text-mv-purple">
                {prettyGenre(g)}
                <button onClick={() => handleGenreToggle(g)} className="hover:text-white">×</button>
              </span>
            ))}
            {debouncedSearch && (
              <span className="flex items-center gap-1 rounded-full bg-mv-surface px-2 py-0.5 text-[9px] text-mv-text-secondary">
                "{debouncedSearch}"
                <button onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }} className="hover:text-white">×</button>
              </span>
            )}
          </div>
        )}

        {/* Result count */}
        <p className="mb-4 text-[10px] text-mv-text-muted">
          {isLoading ? 'Loading...' : (
            <>
              <span className="font-medium text-mv-text-secondary">{data?.total || 0}</span> results
              {debouncedSearch && <> for "<span className="text-mv-text-secondary">{debouncedSearch}</span>"</>}
              {selectedGenres.length > 0 && <> in {selectedGenres.join(', ')}</>}
            </>
          )}
        </p>

        {/* Grid/List Content */}
        {isLoading ? (
          <div className={`${viewMode === 'grid' ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6' : 'space-y-2'}`}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className={`rounded-lg bg-mv-surface ${viewMode === 'grid' ? 'aspect-[3/4] w-full' : 'h-16 w-full'}`} />
                {viewMode === 'grid' && <div className="mt-2 h-3 w-3/4 rounded bg-mv-surface" />}
                {viewMode === 'grid' && <div className="mt-1 h-2 w-1/2 rounded bg-mv-surface" />}
              </div>
            ))}
          </div>
        ) : viewMode === 'grid' ? (
          /* ── Grid View ── */
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {data?.items?.map((item) => (
              <Link key={item.id} href={`/title/${item.slug}`} className="group cursor-pointer">
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-mv-darker transition-all group-hover:scale-[1.03] group-hover:shadow-lg group-hover:shadow-mv-accent/5">
                  <CoverImage src={item.coverUrl} title={item.title} type={item.type} className="h-full w-full" />
                  {/* Status banner — colored per status, mirrors the list view */}
                  {item.status && (
                    <span className={`absolute bottom-2 left-2 rounded-md border px-1.5 py-0.5 text-[8px] font-semibold backdrop-blur-sm ${statusColors(item.status).className}`}>
                      {statusColors(item.status).label}
                    </span>
                  )}
                  {/* Latest chapter badge */}
                  {item.latestChapter && (
                    <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[8px] font-medium text-mv-text-secondary backdrop-blur-sm">
                      up to Ch. {item.latestChapter.number}
                    </span>
                  )}
                  {/* Cover shimmer overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-mv-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="mt-1.5 text-xs text-gray-400 line-clamp-2 group-hover:text-white transition-colors">
                  {item.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-mv-surface px-1.5 py-0.5 text-[8px] text-mv-text-secondary font-medium uppercase">
                    {formatType(item.type)}
                  </span>
                  {item.rating && (
                    <span className="text-[9px] text-mv-gold">⭐ {item.rating.toFixed(1)}</span>
                  )}
                  {item.totalChapters && (
                    <span className="text-[8px] text-mv-text-dim">{item.totalChapters}ch</span>
                  )}
                </div>
                {sort === 'updated' && item.latestChapter && (
                  <p className="mt-0.5 text-[9px] text-green-400/90">
                    Ch. {item.latestChapter.number} · {formatTimeAgo(item.latestChapter.createdAt)}
                  </p>
                )}
              </Link>
            ))}
          </div>
        ) : (
          /* ── List View ── */
          <div className="space-y-1">
            {data?.items?.map((item) => (
              <Link
                key={item.id}
                href={`/title/${item.slug}`}
                className="flex items-center gap-4 rounded-lg px-4 py-3 transition-colors hover:bg-mv-surface group"
              >
                <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-mv-darker">
                  <CoverImage src={item.coverUrl} title={item.title} type={item.type} className="h-full w-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-mv-text group-hover:text-white transition-colors truncate">{item.title}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    {item.author && <span className="text-[9px] text-mv-text-muted truncate">{item.author}</span>}
                    {item.genres?.slice(0, 3).map(g => (
                      <span key={g} className="rounded-full bg-mv-surface px-1.5 py-0 text-[8px] text-mv-text-dim">{g}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {item.rating && <span className="text-[10px] text-mv-gold">⭐ {item.rating.toFixed(1)}</span>}
                  <span className={`rounded-md px-2 py-0.5 text-[9px] font-medium ${
                    item.status === 'ongoing' ? 'bg-green-900/20 text-green-400' :
                    item.status === 'completed' ? 'bg-blue-900/20 text-blue-400' : 'bg-yellow-900/20 text-yellow-400'
                  }`}>
                    {item.status === 'ongoing' ? 'Ong' : item.status === 'completed' ? 'Done' : 'Hold'}
                  </span>
                  <svg className="h-4 w-4 text-mv-text-dim group-hover:text-mv-text-secondary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && data?.items?.length === 0 && (
          <div className="flex flex-col items-center py-20">
            <svg className="mb-4 h-12 w-12 text-mv-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm text-mv-text-muted mb-1">No titles found</p>
            <p className="text-xs text-mv-text-dim mb-4">Try adjusting your search or filters</p>
            <button
              onClick={() => { setSearch(''); setDebouncedSearch(''); setType(''); setStatus(''); setSelectedGenres([]); setPage(1); }}
              className="rounded-lg bg-mv-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-red-500"
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* Page Number Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-mv-surface text-xs text-mv-text-secondary transition-colors hover:bg-mv-border-light disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ‹
            </button>

            {getPageNumbers(page, totalPages).map((p, i) =>
              p === -1 ? (
                <span key={`ellipsis-${i}`} className="px-1 text-xs text-mv-text-dim">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                    p === page
                      ? 'bg-mv-accent text-white'
                      : 'bg-mv-surface text-mv-text-secondary hover:bg-mv-border-light hover:text-mv-text'
                  }`}
                >
                  {p}
                </button>
              ),
            )}

            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!data?.hasMore}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-mv-surface text-xs text-mv-text-secondary transition-colors hover:bg-mv-border-light disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default BrowsePage;

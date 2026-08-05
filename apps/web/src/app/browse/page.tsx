'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { CoverImage } from '@/components/CoverImage';
import { useTitles, useSearchSuggestions } from '@/lib/hooks/useTitles';
import { getPageNumbers } from '@mangaverse/shared';
import { formatTimeAgo, formatType, statusColors } from '@/lib/format';

const FORMATS = ['All', 'manga', 'manhwa', 'manhua', 'light_novel'];
const STATUSES = ['All', 'ongoing', 'completed', 'hiatus'];
const ALL_GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Isekai', 'Mecha', 'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'];
const SORTS = [
  { value: 'trending', label: 'Trending' },
  { value: 'updated', label: 'Recently Updated' },
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'title', label: 'A–Z' },
];
const RESULTS_PER_PAGE = 24;

function normalizeGenre(g: string): string {
  return g.trim().toLowerCase().replace(/\s+/g, '_');
}

function prettyGenre(g: string): string {
  return g.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function readDeepLinkParams() {
  if (typeof window === 'undefined') return { format: '', status: '', genres: [] as string[], sort: 'trending', search: '' };
  const params = new URLSearchParams(window.location.search);
  return {
    format: params.get('format') || '',
    status: params.get('status') || '',
    genres: (params.get('genres') || '').split(',').filter(Boolean),
    sort: params.get('sort') || 'trending',
    search: params.get('search') || '',
  };
}

function BrowsePage() {
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

  useEffect(() => {
    const p = readDeepLinkParams();
    setType(p.format);
    setStatus(p.status);
    setSelectedGenres(p.genres);
    setSort(p.sort);
    if (p.search) {
      setSearch(p.search);
      setDebouncedSearch(p.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: suggestions } = useSearchSuggestions(search.length > 1 && !debouncedSearch ? search : '');

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
  const hasActiveFilters = !!(type || status || selectedGenres.length > 0 || debouncedSearch);

  const handleGenreToggle = (genre: string) => {
    const norm = normalizeGenre(genre);
    setSelectedGenres((prev) => {
      const existing = prev.find((g) => normalizeGenre(g) === norm);
      return existing ? prev.filter((g) => g !== existing) : [...prev, norm];
    });
    setPage(1);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearch(suggestion);
    setDebouncedSearch(suggestion);
    setShowSuggestions(false);
    setPage(1);
  };

  const clearAll = () => {
    setSearch('');
    setDebouncedSearch('');
    setType('');
    setStatus('');
    setSelectedGenres([]);
    setPage(1);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 md:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              Browse <span className="text-gradient">Titles</span>
            </h1>
            <p className="mt-1 text-xs text-mv-text-muted">
              {isLoading ? 'Searching…' : `${data?.total?.toLocaleString() || 0} titles`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              className={`rounded-xl p-2 transition-colors ${viewMode === 'grid' ? 'bg-mv-accent/20 text-mv-violet' : 'text-mv-text-dim hover:text-mv-text'}`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className={`rounded-xl p-2 transition-colors ${viewMode === 'list' ? 'bg-mv-accent/20 text-mv-violet' : 'text-mv-text-dim hover:text-mv-text'}`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6" ref={searchRef}>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Search by title, author, genre…"
            className="field h-12 pl-11 text-sm"
          />
          <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mv-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {search && (
            <button
              onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }}
              aria-label="Clear search"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-mv-text-dim hover:bg-white/5 hover:text-mv-text"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {showSuggestions && suggestions && suggestions.length > 0 && (
            <div className="glass absolute top-full left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl shadow-modal animate-scale-in">
              <p className="bg-mv-surface/80 px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">Suggestions</p>
              {suggestions.map((s) => (
                <button
                  key={s.slug}
                  onClick={() => handleSuggestionClick(s.title)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs text-mv-text-secondary transition-colors hover:bg-white/5 hover:text-mv-text"
                >
                  <span className="text-mv-text-muted">{s.type === 'MANHWA' ? '🇰🇷' : s.type === 'MANHUA' ? '🇨🇳' : s.type === 'LIGHT_NOVEL' ? '📕' : '📖'}</span>
                  <span className="flex-1">{s.title}</span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-mv-text-muted">{s.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="eyebrow">Format</span>
            <div className="flex gap-1">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  onClick={() => { setType(f === 'All' ? '' : f); setPage(1); }}
                  className={`rounded-full px-3 py-1.5 text-[10px] transition-all duration-200 ${
                    (f === 'All' && !type) || f === type
                      ? 'bg-gradient-to-r from-mv-purple to-mv-accent font-medium text-white shadow-glow-sm'
                      : 'bg-white/[0.04] text-mv-text-secondary hover:bg-white/[0.08] hover:text-mv-text'
                  }`}
                >
                  {f === 'light_novel' ? 'LN' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="eyebrow">Status</span>
            <div className="flex gap-1">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatus(s === 'All' ? '' : s); setPage(1); }}
                  className={`rounded-full px-3 py-1.5 text-[10px] transition-all duration-200 ${
                    (s === 'All' && !status) || s === status
                      ? 'bg-gradient-to-r from-mv-purple to-mv-accent font-medium text-white shadow-glow-sm'
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
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] transition-colors ${
                selectedGenres.length > 0
                  ? 'border border-mv-violet/30 bg-mv-violet/15 text-mv-violet'
                  : 'bg-white/[0.04] text-mv-text-secondary hover:bg-white/[0.08] hover:text-mv-text'
              }`}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Genres{selectedGenres.length > 0 ? ` (${selectedGenres.length})` : ''}
            </button>

            {showGenrePanel && (
              <div className="glass absolute top-full left-0 z-40 mt-2 w-72 rounded-2xl p-3 shadow-modal animate-scale-in">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-mv-text">Filter by Genre</p>
                  {selectedGenres.length > 0 && (
                    <button onClick={() => { setSelectedGenres([]); setPage(1); }} className="text-[9px] text-mv-text-dim hover:text-mv-violet">
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
                          ? 'border border-mv-violet/40 bg-mv-accent/15 text-mv-violet'
                          : 'border border-transparent bg-white/[0.04] text-mv-text-secondary hover:bg-white/[0.08]'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort results"
            className="ml-auto rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-mv-text outline-none transition-all focus:border-mv-violet/50"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Active filter tags */}
        {hasActiveFilters && (
          <div className="mb-5 flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] text-mv-text-dim">Active filters:</span>
            {type && (
              <span className="flex items-center gap-1 rounded-full bg-mv-accent/10 px-2 py-0.5 text-[9px] text-mv-violet">
                {type}
                <button onClick={() => { setType(''); setPage(1); }} className="hover:text-white">×</button>
              </span>
            )}
            {status && (
              <span className="flex items-center gap-1 rounded-full bg-mv-accent/10 px-2 py-0.5 text-[9px] text-mv-violet">
                {status}
                <button onClick={() => { setStatus(''); setPage(1); }} className="hover:text-white">×</button>
              </span>
            )}
            {selectedGenres.map((g) => (
              <span key={g} className="flex items-center gap-1 rounded-full bg-mv-purple/10 px-2 py-0.5 text-[9px] text-mv-violet">
                {prettyGenre(g)}
                <button onClick={() => handleGenreToggle(g)} className="hover:text-white">×</button>
              </span>
            ))}
            {debouncedSearch && (
              <span className="flex items-center gap-1 rounded-full bg-mv-surface px-2 py-0.5 text-[9px] text-mv-text-secondary">
                “{debouncedSearch}”
                <button onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }} className="hover:text-white">×</button>
              </span>
            )}
          </div>
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6' : 'space-y-2'}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i}>
                <div className={`skeleton ${viewMode === 'grid' ? 'aspect-[3/4] w-full rounded-xl' : 'h-16 w-full rounded-xl'}`} />
                {viewMode === 'grid' && (
                  <>
                    <div className="skeleton mt-2 h-3 w-3/4 rounded" />
                    <div className="skeleton mt-1.5 h-2 w-1/2 rounded" />
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Grid view */}
        {!isLoading && viewMode === 'grid' && data?.items?.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {data.items.map((item) => (
              <Link key={item.id} href={`/title/${item.slug}`} className="group">
                <div className="img-zoom card-lift relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-mv-surface">
                  <CoverImage src={item.coverUrl} title={item.title} type={item.type} className="h-full w-full" />
                  {item.status && (
                    <span className={`status-pill absolute bottom-2 left-2 ${statusColors(item.status).className}`}>{statusColors(item.status).label}</span>
                  )}
                  {item.latestChapter && (
                    <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[8px] font-medium text-mv-text-secondary backdrop-blur-sm">
                      up to Ch. {item.latestChapter.number}
                    </span>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-mv-violet/10 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs text-mv-text-secondary transition-colors group-hover:text-white">{item.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[8px] font-medium uppercase text-mv-text-secondary">{formatType(item.type)}</span>
                  {item.rating && <span className="text-[9px] text-mv-gold">★ {item.rating.toFixed(1)}</span>}
                  {item.totalChapters && <span className="text-[8px] text-mv-text-dim">{item.totalChapters}ch</span>}
                </div>
                {sort === 'updated' && item.latestChapter && (
                  <p className="mt-0.5 text-[9px] text-mv-success/90">Ch. {item.latestChapter.number} · {formatTimeAgo(item.latestChapter.createdAt)}</p>
                )}
              </Link>
            ))}
          </div>
        ) : null}

        {/* List view */}
        {!isLoading && viewMode === 'list' && data?.items?.length ? (
          <div className="space-y-1">
            {data.items.map((item) => (
              <Link
                key={item.id}
                href={`/title/${item.slug}`}
                className="group flex items-center gap-4 rounded-xl border border-transparent px-4 py-3 transition-all hover:border-mv-border hover:bg-mv-darker"
              >
                <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-mv-surface">
                  <CoverImage src={item.coverUrl} title={item.title} type={item.type} className="h-full w-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-mv-text transition-colors group-hover:text-mv-violet">{item.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    {item.author && <span className="truncate text-[9px] text-mv-text-muted">{item.author}</span>}
                    {item.genres?.slice(0, 3).map((g) => (
                      <span key={g} className="rounded-full bg-white/5 px-1.5 py-0.5 text-[8px] text-mv-text-dim">{g.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {item.rating && <span className="text-[10px] text-mv-gold">★ {item.rating.toFixed(1)}</span>}
                  <span className={`status-pill ${statusColors(item.status || '').className}`}>{statusColors(item.status || '').label}</span>
                  <svg className="h-4 w-4 text-mv-text-dim transition-colors group-hover:text-mv-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        ) : null}

        {/* Empty state */}
        {!isLoading && (!data?.items || data.items.length === 0) && (
          <div className="flex flex-col items-center py-24">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-mv-border bg-mv-darker">
              <svg className="h-7 w-7 text-mv-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-sm text-mv-text-muted">No titles found</p>
            <p className="mb-5 mt-1 text-xs text-mv-text-dim">Try adjusting your search or filters</p>
            <button onClick={clearAll} className="btn-primary px-5 py-2.5 text-xs">
              Clear all filters
            </button>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-mv-surface text-xs text-mv-text-secondary transition-colors hover:bg-mv-border-light disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous page"
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
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-medium transition-colors ${
                    p === page
                      ? 'bg-gradient-to-br from-mv-purple to-mv-accent text-white shadow-glow-sm'
                      : 'bg-mv-surface text-mv-text-secondary hover:bg-mv-border-light hover:text-mv-text'
                  }`}
                >
                  {p}
                </button>
              ),
            )}
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data?.hasMore}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-mv-surface text-xs text-mv-text-secondary transition-colors hover:bg-mv-border-light disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default BrowsePage;

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { TopBar } from '@/components/TopBar';
import { useTitles, useSearchSuggestions } from '@/lib/hooks/useTitles';
import { getPageNumbers } from '@mangaverse/shared';

const FORMATS = ['All', 'manga', 'manhwa', 'manhua', 'light_novel'];
const STATUSES = ['All', 'ongoing', 'completed', 'hiatus'];
const ALL_GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Isekai', 'Mecha', 'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'];
const SORTS = [
  { value: 'trending', label: '🔥 Trending' },
  { value: 'newest', label: '🆕 Newest' },
  { value: 'rating', label: '⭐ Rating' },
  { value: 'title', label: '📄 A–Z' },
];
const RESULTS_PER_PAGE = 24;

export default function BrowsePage() {
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

  // Build genres query param
  const genresParam = selectedGenres.length > 0 ? selectedGenres.join(',') : undefined;

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
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre],
    );
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
            <h1 className="text-xl font-semibold text-white">Browse Titles</h1>
            <p className="mt-0.5 text-xs text-mv-text-muted">
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
            className="w-full rounded-xl bg-mv-surface border border-mv-border-light px-4 py-3 pl-10 text-sm text-mv-text outline-none placeholder:text-mv-text-dim focus:border-mv-accent/50 transition-colors"
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
            <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-mv-border bg-mv-darker shadow-xl overflow-hidden animate-fade-in">
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
                  className={`rounded-full px-2.5 py-1 text-[10px] transition-colors ${
                    (f === 'All' && !type) || f === type
                      ? 'bg-mv-accent text-white'
                      : 'bg-mv-surface text-mv-text-secondary hover:bg-mv-border-light'
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
                  className={`rounded-full px-2.5 py-1 text-[10px] transition-colors ${
                    (s === 'All' && !status) || s === status
                      ? 'bg-mv-accent text-white'
                      : 'bg-mv-surface text-mv-text-secondary hover:bg-mv-border-light'
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
              <div className="absolute top-full left-0 z-40 mt-1 w-64 rounded-xl border border-mv-border bg-mv-darker p-3 shadow-xl animate-fade-in">
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
            className="ml-auto rounded-lg bg-mv-surface border border-mv-border-light px-3 py-1.5 text-xs text-mv-text outline-none focus:border-mv-accent/50"
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
                {g}
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
                <div className="aspect-[3/4] w-full rounded-xl bg-gradient-to-br from-mv-darker via-mv-surface to-mv-darker flex items-center justify-center transition-all group-hover:scale-[1.03] group-hover:shadow-lg group-hover:shadow-mv-accent/5 overflow-hidden relative">
                  <span className="text-xs text-mv-text-muted text-center px-2 leading-tight">{item.title}</span>
                  {/* Cover shimmer overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-mv-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="mt-1.5 text-xs text-gray-400 line-clamp-2 group-hover:text-white transition-colors">
                  {item.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-mv-surface px-1.5 py-0.5 text-[8px] text-mv-text-secondary font-medium uppercase">
                    {item.type === 'LIGHT_NOVEL' ? 'LN' : item.type?.slice(0, 2)}
                  </span>
                  {item.rating && (
                    <span className="text-[9px] text-mv-gold">⭐ {item.rating.toFixed(1)}</span>
                  )}
                  {item.totalChapters && (
                    <span className="text-[8px] text-mv-text-dim">{item.totalChapters}ch</span>
                  )}
                </div>
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
                <div className="h-14 w-10 shrink-0 rounded-md bg-gradient-to-br from-mv-darker to-mv-surface flex items-center justify-center">
                  <span className="text-[8px] text-mv-text-dim">{item.type?.slice(0, 2)}</span>
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



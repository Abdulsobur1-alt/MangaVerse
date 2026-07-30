'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TopBar } from '@/components/TopBar';
import { useTitles } from '@/lib/hooks/useTitles';

const FORMATS = ['All', 'manga', 'manhwa', 'manhua', 'light_novel'];
const STATUSES = ['All', 'ongoing', 'completed', 'hiatus'];
const SORTS = [
  { value: 'trending', label: 'Trending' },
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Rating' },
  { value: 'title', label: 'A–Z' },
];

export default function BrowsePage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('trending');
  const [page, setPage] = useState(1);

  // Proper debounce with useEffect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useTitles({
    page,
    limit: 20,
    type: type || undefined,
    status: status || undefined,
    sort,
    search: debouncedSearch || undefined,
  });

  return (
    <main className="min-h-screen bg-mv-dark">
      <TopBar />

      <div className="mx-auto max-w-7xl p-6">
        <h1 className="mb-6 text-xl font-semibold text-white">Browse Titles</h1>

        {/* Search Bar */}
        <div className="relative mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search 12,000+ manga, manhwa, and light novels..."
            className="w-full rounded-lg bg-mv-surface border border-mv-border-light px-4 py-3 pl-10 text-sm text-mv-text outline-none placeholder:text-mv-text-dim focus:border-mv-accent/50 transition-colors"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-mv-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Filters Row */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Format</span>
            <div className="flex gap-1">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  onClick={() => { setType(f === 'All' ? '' : f); setPage(1); }}
                  className={`rounded-full px-3 py-1 text-[10px] transition-colors ${
                    (f === 'All' && !type) || f === type
                      ? 'bg-mv-accent text-white'
                      : 'bg-mv-surface text-mv-text-secondary hover:bg-mv-border-light'
                  }`}
                >
                  {f === 'light_novel' ? 'Light Novel' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Status</span>
            <div className="flex gap-1">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatus(s === 'All' ? '' : s); setPage(1); }}
                  className={`rounded-full px-3 py-1 text-[10px] transition-colors ${
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

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="ml-auto rounded-md bg-mv-surface border border-mv-border-light px-3 py-1.5 text-xs text-mv-text outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <p className="mb-4 text-xs text-mv-text-muted">
          {isLoading ? 'Searching...' : `${data?.total || 0} results${debouncedSearch ? ` for "${debouncedSearch}"` : ''}`}
        </p>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/4] w-full rounded-lg bg-mv-surface" />
                <div className="mt-2 h-3 w-3/4 rounded bg-mv-surface" />
                <div className="mt-1 h-2 w-1/2 rounded bg-mv-surface" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {data?.items?.map((item) => (
              <Link key={item.id} href={`/title/${item.slug}`} className="group cursor-pointer">
                <div className="aspect-[3/4] w-full rounded-lg bg-gradient-to-br from-mv-darker to-mv-surface flex items-center justify-center transition-all group-hover:scale-[1.02] group-hover:shadow-lg overflow-hidden">
                  <span className="text-xs text-mv-text-muted text-center px-2 leading-tight">{item.title}</span>
                </div>
                <p className="mt-1.5 text-xs text-gray-400 line-clamp-2 group-hover:text-white transition-colors">
                  {item.title}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded bg-mv-surface px-1.5 py-0.5 text-[9px] text-mv-text-secondary">
                    {item.type}
                  </span>
                  {item.rating && (
                    <span className="text-[10px] text-mv-gold">⭐ {item.rating.toFixed(1)}</span>
                  )}
                </div>
              </Link>
            ))}
            {data?.items?.length === 0 && (
              <p className="col-span-full text-center text-sm text-mv-text-muted py-12">
                No titles found. Try adjusting your filters.
              </p>
            )}
          </div>
        )}

        {/* Pagination */}
        {data && data.total > data.limit && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md bg-mv-surface px-4 py-2 text-xs text-mv-text transition-colors hover:bg-mv-border-light disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="text-xs text-mv-text-muted">
              Page {page} of {Math.ceil(data.total / data.limit)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data.hasMore}
              className="rounded-md bg-mv-surface px-4 py-2 text-xs text-mv-text transition-colors hover:bg-mv-border-light disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

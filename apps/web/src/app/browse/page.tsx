'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Reveal } from '@/components/Reveal';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { TitleCard, TitleCardSkeleton } from '@/components/home/TitleCard';
import { SectionHeader } from '@/components/home/primitives';
import { DiscoverSearch } from '@/components/discover/DiscoverSearch';
import { FilterBar } from '@/components/discover/FilterBar';
import { CuratedCollections } from '@/components/discover/CuratedCollections';
import { GenreGrid } from '@/components/discover/GenreGrid';
import { AiSearchCard } from '@/components/discover/AiSearchCard';
import { useTitlesPages, useTitles, useTrendingTitles, useRecentlyUpdated, useGenreCounts, type TitlesQuery } from '@/lib/hooks/useTitles';
import { filtersFromParams, filtersToQuery, filtersActive, DEFAULT_FILTERS, type FilterState } from '@/components/discover/utils';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Browse — the Discovery Hub (Phase 6).
   Two modes, one URL:
   • Discovery (no filters): search bar → curated collections → AI
     teaser → genre grid → live rails. Browsing should feel effortless.
   • Catalog (filters/search active): FilterBar + infinite results grid.
   The URL is the source of truth for every filter — filter sets are
   shareable and deep-linkable. Search typing stays local and commits
   on Enter so history isn't spammed.
   ═══════════════════════════════════════════════════════════════ */

const PAGE_SIZE = 24;

/**
 * URL-as-state for the browse hub. The browser URL is the single source of
 * truth for filters: this hook initialises from it, writes through the router
 * (shareable deep links), and re-syncs on back/forward (popstate) plus any
 * external <Link> navigation to /browse with different query params (a cheap
 * search-fragment watcher — the string compare bails out on equal values).
 * Note: deliberately avoids useSearchParams + Suspense due to a duplicate
 * @types/react resolution quirk in this monorepo (TS2786).
 */
function useBrowseFilters() {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>(() =>
    typeof window === 'undefined' ? { ...DEFAULT_FILTERS } : filtersFromParams(new URLSearchParams(window.location.search)),
  );
  // Always-current snapshot so applyFilters never writes from a stale closure.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Re-sync whenever the URL query string changes (popstate / external nav)
  useEffect(() => {
    let last = window.location.search;
    const sync = () => {
      const current = window.location.search;
      if (current === last) return;
      last = current;
      const next = filtersFromParams(new URLSearchParams(current));
      setFilters((prev) => (filtersToQuery(prev) === filtersToQuery(next) ? prev : next));
    };
    window.addEventListener('popstate', sync);
    const id = window.setInterval(sync, 400);
    return () => {
      window.removeEventListener('popstate', sync);
      window.clearInterval(id);
    };
  }, []);

  // Writes: compute the next state purely, update instantly, mirror to the URL.
  // The router.replace call lives OUTSIDE the state updater (updaters must be
  // pure — React may invoke them twice in StrictMode).
  const applyFilters = useCallback((patch: Partial<FilterState>) => {
    const next = { ...filtersRef.current, ...patch };
    setFilters(next);
    const qs = filtersToQuery(next);
    router.replace(`/browse${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [router]);

  return { filters, applyFilters };
}

function BrowseHub() {
  const router = useRouter();
  const { filters, applyFilters } = useBrowseFilters();

  // ── Local search draft (URL only commits on Enter) ──
  const [draft, setDraft] = useState(filters.search);
  useEffect(() => { setDraft(filters.search); }, [filters.search]);

  const [loadedPages, setLoadedPages] = useState(1);
  const [showMore, setShowMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const active = filtersActive(filters);

  // Reset loaded pages whenever the filter key changes
  const filterKey = useMemo(() => filtersToQuery(filters), [filters]);
  useEffect(() => { setLoadedPages(1); }, [filterKey]);

  // ── Catalog data (accumulated pages) ──
  const query = useMemo<TitlesQuery>(() => ({
    genres: filters.genres.length > 0 ? filters.genres.join(',') : undefined,
    type: filters.type || undefined,
    status: filters.status || undefined,
    yearFrom: filters.yearFrom ?? undefined,
    yearTo: filters.yearTo ?? undefined,
    minRating: filters.minRating ?? undefined,
    sort: filters.sort,
    search: filters.search.trim() || undefined,
    limit: PAGE_SIZE,
  }), [filters]);

  const { items, total, hasMore, isFetching, isLoading, error } = useTitlesPages(active ? query : { enabled: false }, loadedPages);
  const { data: genreCounts } = useGenreCounts();

  // ── Discovery rails (only fetched when in discovery mode) ──
  const { data: trending } = useTrendingTitles();
  const { data: topRated } = useTitles({ sort: 'rating', limit: 12, enabled: !active });
  const { data: recentUpdates } = useRecentlyUpdated();
  const { data: newReleases } = useTitles({ sort: 'newest', limit: 12, enabled: !active });

  // ── Infinite load-more ──
  useEffect(() => {
    if (!active || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setShowMore(true)),
      { rootMargin: '600px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [active, hasMore, filterKey]);

  useEffect(() => {
    if (showMore && hasMore && !isFetching) {
      setLoadedPages((p) => p + 1);
      setShowMore(false);
    }
  }, [showMore, hasMore, isFetching]);

  const commitSearch = useCallback((term: string) => {
    setDraft(term);
    applyFilters({ search: term });
  }, [applyFilters]);

  const clearAll = useCallback(() => {
    setDraft('');
    applyFilters({ ...DEFAULT_FILTERS });
    setLoadedPages(1);
  }, [applyFilters]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
        {/* ─── Hero ─────────────────────────────────────── */}
        <header className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-mv-purple/15 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <p className="eyebrow">Discovery Hub</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
              Find your next <span className="text-gradient">obsession</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-mv-text-secondary">
              Search everything, explore curated collections, or drill into genres and authors.
            </p>
          </div>
          <div className="relative mt-6">
            <DiscoverSearch
              large
              value={draft}
              onChange={setDraft}
              onSubmit={commitSearch}
              className="max-w-3xl"
            />
          </div>
        </header>

        <div className="mt-8 space-y-12 md:mt-10 md:space-y-16">
          {!active ? (
            /* ══ Discovery mode ══ */
            <>
              <Reveal>
                <section aria-label="Curated collections">
                  <SectionHeader title="Curated Collections" href="/browse" sub="Hand-picked ways in — every card is a real filter set" icon={<span aria-hidden="true">🧺</span>} />
                  <CuratedCollections />
                </section>
              </Reveal>

              <Reveal>
                <section aria-label="AI discovery">
                  <AiSearchCard />
                </section>
              </Reveal>

              <Reveal>
                <section aria-label="Browse genres">
                  <SectionHeader title="Browse by Genre" href="/browse" sub="Live title counts from the catalog" icon={<span aria-hidden="true">🗂️</span>} />
                  <GenreGrid />
                </section>
              </Reveal>

              <Reveal>
                <section aria-label="Trending now">
                  <SectionHeader title="Trending Now" href="/browse?sort=trending" sub="What everyone is reading this week" icon={<span aria-hidden="true">🔥</span>} />
                  {!trending ? (
                    <div className="flex gap-3 overflow-hidden"><TitleCardSkeleton count={8} /></div>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                      {(trending ?? []).slice(0, 10).map((t, i) => <TitleCard key={t.id} item={t} rank={i + 1} />)}
                    </div>
                  )}
                </section>
              </Reveal>

              <Reveal>
                <section aria-label="Top rated">
                  <SectionHeader title="Top Rated" href="/browse?sort=rating" sub="The canon, highest rated first" icon={<span aria-hidden="true">⭐</span>} />
                  {!topRated ? (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {Array.from({ length: 12 }).map((_, i) => <div key={i} className="skeleton aspect-[3/4] rounded-xl" />)}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {(topRated.items ?? []).slice(0, 12).map((t) => <TitleCard key={t.id} item={t} fluid />)}
                    </div>
                  )}
                </section>
              </Reveal>

              <Reveal>
                <section aria-label="Recently updated">
                  <SectionHeader title="Recently Updated" href="/browse?sort=updated" sub="Fresh chapters, just dropped" icon={<span aria-hidden="true">🆕</span>} />
                  {!recentUpdates ? (
                    <div className="flex gap-3 overflow-hidden"><TitleCardSkeleton count={8} /></div>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                      {(recentUpdates ?? []).slice(0, 10).map((t) => (
                        <TitleCard key={t.id} item={t as unknown as import('@/components/home/types').HomeTitle} badge={t.latestChapter ? `Ch. ${t.latestChapter.number}` : undefined} />
                      ))}
                    </div>
                  )}
                </section>
              </Reveal>

              <Reveal>
                <section aria-label="New releases">
                  <SectionHeader title="New Releases" href="/browse?sort=newest" sub="Fresh on the shelf" icon={<span aria-hidden="true">🎉</span>} />
                  {!newReleases ? (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {Array.from({ length: 12 }).map((_, i) => <div key={i} className="skeleton aspect-[3/4] rounded-xl" />)}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {(newReleases.items ?? []).slice(0, 12).map((t) => <TitleCard key={t.id} item={t} fluid />)}
                    </div>
                  )}
                </section>
              </Reveal>
            </>
          ) : (
            /* ══ Catalog mode ══ */
            <>
              <div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-white">Results</h2>
                    <p className="mt-0.5 text-[11px] text-mv-text-muted">
                      {isLoading ? 'Searching…' : `${total.toLocaleString()} titles match your filters`}
                    </p>
                  </div>
                  <button
                    onClick={clearAll}
                    className="flex items-center gap-1.5 rounded-full border border-mv-border-light bg-mv-surface/60 px-3.5 py-1.5 text-[11px] text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
                  >
                    <Icon name="refresh" size={12} />
                    Reset filters
                  </button>
                </div>

                <FilterBar filters={filters} onChange={applyFilters} genreCounts={genreCounts ?? []} resultCount={total} />
              </div>

              {/* Results grid */}
              {isLoading ? (
                <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i}>
                      <div className="skeleton aspect-[3/4] rounded-xl" />
                      <div className="skeleton mt-2 h-3 w-4/5 rounded" />
                      <div className="skeleton mt-1.5 h-2 w-1/2 rounded" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="card mt-8 flex flex-col items-center rounded-2xl px-6 py-16 text-center">
                  <Icon name="alert" size={28} className="mb-3 text-mv-text-dim" />
                  <p className="text-sm text-mv-text-secondary">Something went wrong loading titles.</p>
                  <button onClick={() => setLoadedPages((p) => p + 1)} className="btn-primary mt-5 px-5 py-2.5 text-xs">Try again</button>
                </div>
              ) : items.length === 0 ? (
                <div className="card mt-8 flex flex-col items-center rounded-2xl px-6 py-16 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-mv-border bg-mv-darker">
                    <Icon name="search" size={22} className="text-mv-text-dim" />
                  </div>
                  <p className="text-sm font-medium text-mv-text">No titles found</p>
                  <p className="mt-1 max-w-sm text-xs text-mv-text-muted">
                    {filters.genres.length > 1
                      ? 'Your genre combination might be too strict — try removing a genre or widening the year range.'
                      : 'Try a broader search, loosen the rating, or clear a filter.'}
                  </p>
                  <button onClick={clearAll} className="btn-primary mt-6 px-5 py-2.5 text-xs">Clear all filters</button>
                </div>
              ) : (
                <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {items.map((t) => <TitleCard key={t.id} item={t} fluid />)}
                </div>
              )}

              {/* Load-more sentinel + button */}
              {!isLoading && items.length > 0 && hasMore && (
                <div className="mt-10 flex flex-col items-center gap-3">
                  <div ref={sentinelRef} className="h-4" aria-hidden="true" />
                  <button
                    onClick={() => setLoadedPages((p) => p + 1)}
                    disabled={isFetching}
                    className={cn(
                      'btn-ghost px-6 py-2.5 text-xs',
                      isFetching && 'opacity-50',
                    )}
                  >
                    {isFetching ? 'Loading more…' : `Load more (${Math.max(0, total - items.length).toLocaleString()} left)`}
                  </button>
                  {isFetching && <Spinner size={16} className="text-mv-violet" />}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default function BrowsePage() {
  return <BrowseHub />;
}

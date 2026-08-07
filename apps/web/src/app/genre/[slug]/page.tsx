'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Reveal } from '@/components/Reveal';
import { Icon } from '@/components/ui/Icon';
import { TitleCard, TitleCardSkeleton } from '@/components/home/TitleCard';
import { SectionHeader } from '@/components/home/primitives';
import { DiscoverSearch } from '@/components/discover/DiscoverSearch';
import { useTitles, useGenreCounts } from '@/lib/hooks/useTitles';
import { genreMetaFor, toDbGenre, genreDisplayLabel } from '@/components/discover/utils';
import { GENRES_META } from '@/components/home/types';
import { formatTypeFull, formatTimeAgo } from '@/lib/format';
import { compactNumber } from '@mangaverse/shared';

/* ═══════════════════════════════════════════════════════════════
   Genre page — Phase 6.
   Every genre gets a dedicated identity: gradient hero with live
   title count, a small derived stats strip, four curated rails
   (Popular / Newest / Most Bookmarked / Hidden Gems), and related
   genres to keep the exploration flowing. Accepts either slug form
   (`sci-fi` or `sci_fi`) and falls back gracefully for unknown genres.
   ═══════════════════════════════════════════════════════════════ */

export default function GenrePage() {
  const { slug } = useParams<{ slug: string }>();
  const dbSlug = toDbGenre(slug ?? '');
  const meta = genreMetaFor(dbSlug);
  const { data: counts } = useGenreCounts();
  const count = (counts ?? []).find((g) => toDbGenre(g.genre) === dbSlug)?.count ?? 0;

  const popular = useTitles({ genre: dbSlug, sort: 'rating', limit: 12 });
  const newest = useTitles({ genre: dbSlug, sort: 'newest', limit: 12 });
  const bookmarked = useTitles({ genre: dbSlug, sort: 'bookmarks', limit: 12 });
  const gems = useTitles({ genre: dbSlug, sort: 'rating', minRating: 8.5, limit: 12 });

  // ── Derived stats (honest: from the sampled rails, labelled as such) ──
  const stats = useMemo(() => {
    const pool = [...(popular.data?.items ?? []), ...(newest.data?.items ?? []), ...(bookmarked.data?.items ?? [])];
    const byId = new Map(pool.map((t) => [t.id, t]));
    const items = [...byId.values()];
    const rated = items.filter((t) => t.rating != null);
    const avg = rated.length > 0 ? rated.reduce((s, t) => s + (t.rating ?? 0), 0) / rated.length : null;
    const formats = new Map<string, number>();
    items.forEach((t) => formats.set(formatTypeFull(t.type), (formats.get(formatTypeFull(t.type)) ?? 0) + 1));
    const topFormat = [...formats.entries()].sort((a, b) => b[1] - a[1])[0];
    const avgYear = (() => {
      const years = items.map((t) => t.releaseYear).filter((y): y is number => typeof y === 'number');
      return years.length > 0 ? Math.round(years.reduce((s, y) => s + y, 0) / years.length) : null;
    })();
    const latest = items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return { avg, topFormat: topFormat?.[0], topFormatCount: topFormat?.[1], avgYear, latest };
  }, [popular.data, newest.data, bookmarked.data]);

  const related = GENRES_META.filter((g) => g.key !== meta.key).slice(0, 8);
  const anyLoading = popular.isLoading && newest.isLoading && bookmarked.isLoading && gems.isLoading;
  const empty = !anyLoading && !popular.data?.items?.length && !newest.data?.items?.length && !bookmarked.data?.items?.length;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
        {/* ─── Genre hero ───────────────────────────────── */}
        <header className="relative overflow-hidden rounded-3xl border border-mv-border-light">
          <div className="absolute inset-0 bg-gradient-to-br from-mv-darker via-mv-surface to-mv-darker" />
          <div
            className="absolute -right-16 -top-20 h-72 w-72 rounded-full opacity-40 blur-3xl"
            style={{ background: `radial-gradient(circle, ${meta.glow}, transparent 70%)` }}
          />
          <div className="relative flex flex-col gap-6 p-7 md:flex-row md:items-end md:justify-between md:p-10">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-mv-border-light bg-mv-surface/70 text-2xl shadow-card" aria-hidden="true">
                  {meta.emoji}
                </span>
                <span className="rounded-full border border-mv-violet/25 bg-mv-violet/10 px-3 py-1 text-[10px] font-medium text-mv-violet">
                  {count > 0 ? `${compactNumber(count)} titles` : 'Genre'}
                </span>
              </div>
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">{meta.label}</h1>
              <p className="mt-2 text-sm leading-relaxed text-mv-text-secondary">{meta.blurb}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2.5">
              <Link href={`/browse?genres=${dbSlug}`} className="btn-primary px-5 py-2.5 text-xs">
                Browse all {count > 0 ? `${compactNumber(count)} ` : ''}{meta.label}
                <Icon name="arrowRight" size={14} />
              </Link>
              <Link href="/browse" className="btn-ghost px-5 py-2.5 text-xs">All genres</Link>
            </div>
          </div>

          {/* Stats strip — labelled as estimates */}
          <div className="relative grid grid-cols-2 gap-px border-t border-mv-border-light bg-mv-border-light sm:grid-cols-4">
            <Stat label="Avg rating (sample)" value={stats.avg != null ? `★ ${stats.avg.toFixed(1)}` : '—'} />
            <Stat label="Top format" value={stats.topFormat ?? '—'} sub={stats.topFormatCount ? `${stats.topFormatCount} sampled` : undefined} />
            <Stat label="Avg release year" value={stats.avgYear ? String(stats.avgYear) : '—'} />
            <Stat label="Latest addition" value={stats.latest ? formatTimeAgo(stats.latest.createdAt) : '—'} />
          </div>
        </header>

        {/* Search within genre */}
        <div className="mt-8">
          <GenreSearch dbSlug={dbSlug} label={meta.label} />
        </div>

        {/* ─── Rails ────────────────────────────────────── */}
        <div className="mt-12 space-y-12">
          {empty ? (
            <div className="card flex flex-col items-center rounded-2xl px-6 py-16 text-center">
              <span className="text-4xl" aria-hidden="true">{meta.emoji}</span>
              <p className="mt-4 text-sm font-medium text-mv-text">No titles in this genre yet</p>
              <p className="mt-1 max-w-sm text-xs text-mv-text-muted">
                This genre is fresh on the shelf — check back soon, or explore a related genre below.
              </p>
            </div>
          ) : (
            <>
              <Reveal>
                <section aria-label={`Popular ${meta.label}`}>
                  <SectionHeader title={`Popular ${meta.label}`} href={`/browse?genres=${dbSlug}&sort=rating`} sub="Highest rated first" icon={<span aria-hidden="true">⭐</span>} />
                  {popular.isLoading ? (
                    <div className="flex gap-3 overflow-hidden"><TitleCardSkeleton count={8} /></div>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                      {(popular.data?.items ?? []).slice(0, 10).map((t, i) => <TitleCard key={t.id} item={t} rank={i + 1} />)}
                    </div>
                  )}
                </section>
              </Reveal>

              <Reveal>
                <section aria-label={`Newest ${meta.label}`}>
                  <SectionHeader title="Newest" href={`/browse?genres=${dbSlug}&sort=newest`} sub="Fresh additions" icon={<span aria-hidden="true">🎉</span>} />
                  {newest.isLoading ? (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {Array.from({ length: 12 }).map((_, i) => <div key={i} className="skeleton aspect-[3/4] rounded-xl" />)}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {(newest.data?.items ?? []).slice(0, 12).map((t) => <TitleCard key={t.id} item={t} fluid />)}
                    </div>
                  )}
                </section>
              </Reveal>

              <Reveal>
                <section aria-label={`Most bookmarked ${meta.label}`}>
                  <SectionHeader title="Community Favorites" href={`/browse?genres=${dbSlug}&sort=bookmarks`} sub="Most saved by readers" icon={<span aria-hidden="true">🔖</span>} />
                  {bookmarked.isLoading ? (
                    <div className="flex gap-3 overflow-hidden"><TitleCardSkeleton count={8} /></div>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                      {(bookmarked.data?.items ?? []).slice(0, 10).map((t) => <TitleCard key={t.id} item={t} />)}
                    </div>
                  )}
                </section>
              </Reveal>

              <Reveal>
                <section aria-label={`Hidden gems in ${meta.label}`}>
                  <SectionHeader title="Hidden Gems" href={`/browse?genres=${dbSlug}&sort=rating&minRating=8.5`} sub="8.5+ rated — the quiet standouts" icon={<span aria-hidden="true">💎</span>} />
                  {gems.isLoading ? (
                    <div className="flex gap-3 overflow-hidden"><TitleCardSkeleton count={8} /></div>
                  ) : (gems.data?.items?.length ?? 0) > 0 ? (
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                      {(gems.data?.items ?? []).slice(0, 10).map((t) => <TitleCard key={t.id} item={t} />)}
                    </div>
                  ) : (
                    <div className="card rounded-2xl px-6 py-8 text-center">
                      <p className="text-xs text-mv-text-muted">No 8.5+ rated titles in this genre yet — the popular rail is the place to start.</p>
                    </div>
                  )}
                </section>
              </Reveal>

              {/* Related genres */}
              <Reveal>
                <section aria-label="Related genres">
                  <SectionHeader title="Related Genres" href="/browse" sub="Keep exploring" icon={<span aria-hidden="true">🧭</span>} />
                  <div className="flex flex-wrap gap-2">
                    {related.map((g) => (
                      <Link
                        key={g.key}
                        href={`/genre/${toDbGenre(g.key)}`}
                        className="group flex items-center gap-2 rounded-full border border-mv-border-light bg-mv-surface/60 px-4 py-2 text-xs text-mv-text-secondary transition-all hover:-translate-y-0.5 hover:border-mv-violet/40 hover:text-mv-violet"
                      >
                        <span aria-hidden="true">{g.emoji}</span>
                        {g.label}
                        <Icon name="chevronRight" size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    ))}
                  </div>
                </section>
              </Reveal>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-mv-darker/90 px-5 py-4">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-mv-text-muted">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
      {sub && <p className="text-[9px] text-mv-text-dim">{sub}</p>}
    </div>
  );
}

function GenreSearch({ dbSlug, label }: { dbSlug: string; label: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <DiscoverSearch
      value={q}
      onChange={setQ}
      onSubmit={(term) => {
        router.push(`/browse?genres=${dbSlug}&search=${encodeURIComponent(term)}`);
      }}
      placeholder={`Search within ${label}…`}
    />
  );
}

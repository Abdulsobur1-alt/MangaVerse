'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Reveal } from '@/components/Reveal';
import { Icon } from '@/components/ui/Icon';
import { TitleCard } from '@/components/home/TitleCard';
import { DiscoverSearch } from '@/components/discover/DiscoverSearch';
import { useTitles } from '@/lib/hooks/useTitles';
import { toDbGenre, genreDisplayLabel } from '@/components/discover/utils';
import { formatTypeFull, formatTimeAgo, statusColors } from '@/lib/format';

/* ═══════════════════════════════════════════════════════════════
   Author page — Phase 6.
   The catalog doesn't model creator biographies, portraits, or
   awards — so this page is honest about it: everything here is
   DERIVED from the author's actual works in the catalog (counts,
   average rating, dominant genre, formats, statuses). No invented
   "About" copy, no fake follower numbers.
   ═══════════════════════════════════════════════════════════════ */

export default function AuthorPage() {
  const { name } = useParams<{ name: string }>();
  const author = (name ?? '').trim();

  const { data, isLoading, error } = useTitles({
    author: author || undefined,
    limit: 100,
    sort: 'rating',
    enabled: author.length > 0,
  });
  const works = data?.items ?? [];
  const total = data?.total ?? 0;

  // ── Derived stats from the loaded works (labelled as such) ──
  const stats = useMemo(() => {
    const rated = works.filter((w) => w.rating != null);
    const avg = rated.length > 0 ? rated.reduce((s, w) => s + (w.rating ?? 0), 0) / rated.length : null;

    const genreCounts = new Map<string, number>();
    works.forEach((w) => w.genres.forEach((g) => genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1)));
    const topGenre = [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    const formatCounts = new Map<string, number>();
    works.forEach((w) => formatCounts.set(w.type, (formatCounts.get(w.type) ?? 0) + 1));
    const formats = [...formatCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    const statusCounts = new Map<string, number>();
    works.forEach((w) => statusCounts.set(w.status, (statusCounts.get(w.status) ?? 0) + 1));
    const statuses = [...statusCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    const latest = [...works].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return { avg, topGenre: topGenre?.[0], topGenreCount: topGenre?.[1], formats, statuses, latest };
  }, [works]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
        {/* ─── Header ───────────────────────────────────── */}
        <header className="relative overflow-hidden rounded-3xl border border-mv-border-light">
          <div className="absolute inset-0 bg-gradient-to-br from-mv-darker via-mv-surface to-mv-darker" />
          <div className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full bg-mv-purple/15 blur-3xl" />
          <div className="relative flex flex-col items-start gap-6 p-7 md:flex-row md:items-center md:p-10">
            {/* Portrait placeholder — honest, no fake portrait */}
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-mv-purple to-mv-accent text-3xl font-bold text-white shadow-glow-sm">
              {author.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Creator</p>
              <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">{author}</h1>
              <p className="mt-2 text-sm text-mv-text-secondary">
                {isLoading ? 'Looking up their works…' : `${total.toLocaleString()} work${total === 1 ? '' : 's'} in the catalog`}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {stats.avg != null && (
                  <span className="flex items-center gap-1.5 rounded-full border border-mv-gold/25 bg-mv-gold/10 px-3 py-1 text-[10px] font-medium text-mv-gold">
                    <Icon name="star" size={11} />
                    {stats.avg.toFixed(1)} avg rating
                  </span>
                )}
                {stats.topGenre && (
                  <Link
                    href={`/genre/${toDbGenre(stats.topGenre)}`}
                    className="rounded-full border border-mv-violet/25 bg-mv-violet/10 px-3 py-1 text-[10px] font-medium text-mv-violet transition-colors hover:bg-mv-violet/20"
                  >
                    {genreDisplayLabel(stats.topGenre)} specialist
                  </Link>
                )}
                {stats.latest && (
                  <span className="flex items-center gap-1.5 rounded-full border border-mv-border-light bg-mv-surface/60 px-3 py-1 text-[10px] text-mv-text-muted">
                    <Icon name="clock" size={11} />
                    Latest work {formatTimeAgo(stats.latest.createdAt)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Derived stats strip */}
          <div className="relative grid grid-cols-2 gap-px border-t border-mv-border-light bg-mv-border-light sm:grid-cols-4">
            <Stat label="Works" value={String(total)} />
            <Stat label="Avg rating" value={stats.avg != null ? `★ ${stats.avg.toFixed(1)}` : '—'} sub="across rated works" />
            <Stat label="Dominant genre" value={stats.topGenre ? genreDisplayLabel(stats.topGenre) : '—'} sub={stats.topGenreCount ? `${stats.topGenreCount} works` : undefined} />
            <Stat label="Formats" value={stats.formats.map(([t]) => formatTypeFull(t)).join(' · ')} sub={stats.formats.length > 0 ? 'across their works' : undefined} />
          </div>
        </header>

        {/* ─── Honest creator section ───────────────────── */}
        <Reveal className="mt-6">
          <div className="rounded-2xl border border-mv-border bg-mv-darker/60 p-5">
            <div className="flex items-start gap-3">
              <Icon name="info" size={16} className="mt-0.5 shrink-0 text-mv-text-dim" />
              <div className="text-[11px] leading-relaxed text-mv-text-muted">
                <p>
                  <span className="font-semibold text-mv-text-secondary">About this creator.</span>{' '}
                  The catalog doesn't carry author biographies, portraits, or awards yet — so this page only shows what's
                  verifiable from their works. When the data model gains creator profiles, this section will upgrade to a
                  full biography with publishing history.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {stats.statuses.map(([s, n]) => (
                    <span key={s} className={`status-pill ${statusColors(s).className}`}>
                      {statusColors(s).label} · {n}
                    </span>
                  ))}
                  {stats.formats.map(([t, n]) => (
                    <span key={t} className="rounded-full border border-mv-border-light bg-mv-surface/60 px-2.5 py-0.5 text-[9px] text-mv-text-muted">
                      {formatTypeFull(t)} · {n}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Search the catalog */}
        <div className="mt-8">
          <AuthorSearch author={author} />
        </div>

        {/* ─── Works grid ───────────────────────────────── */}
        <div className="mt-10">
          <h2 className="mb-5 flex items-center gap-2.5 text-lg font-bold text-white md:text-xl">
            <span className="flex h-6 w-1.5 items-center justify-center rounded-full bg-gradient-to-b from-mv-purple to-mv-accent" aria-hidden="true" />
            Works by {author}
          </h2>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i}>
                  <div className="skeleton aspect-[3/4] rounded-xl" />
                  <div className="skeleton mt-2 h-3 w-4/5 rounded" />
                </div>
              ))}
            </div>
          ) : error || works.length === 0 ? (
            <div className="card flex flex-col items-center rounded-2xl px-6 py-16 text-center">
              <Icon name="search" size={28} className="mb-3 text-mv-text-dim" />
              <p className="text-sm font-medium text-mv-text">No works found for “{author}”</p>
              <p className="mt-1 max-w-sm text-xs text-mv-text-muted">
                The name may be spelled differently, or their works haven't been added yet.
              </p>
              <Link href="/browse" className="btn-primary mt-6 px-5 py-2.5 text-xs">Browse everything</Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {works.map((w) => <TitleCard key={w.id} item={w} fluid />)}
              </div>
              {total > works.length && (
                <p className="mt-6 text-center text-[10px] text-mv-text-dim">
                  Showing the top {works.length} by rating of {total} works.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 bg-mv-darker/90 px-5 py-4">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-mv-text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-white">{value}</p>
      {sub && <p className="text-[9px] text-mv-text-dim">{sub}</p>}
    </div>
  );
}

function AuthorSearch({ author }: { author: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <DiscoverSearch
      value={q}
      onChange={setQ}
      onSubmit={(term) => {
        router.push(`/browse?search=${encodeURIComponent(term)}`);
      }}
      placeholder={`Search the rest of the catalog… (${author}'s works are below)`}
    />
  );
}

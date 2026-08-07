'use client';

import Link from 'next/link';
import { CoverImage } from '@/components/CoverImage';
import { SectionHeader } from './primitives';
import { GENRES_META, type HomeTitle } from './types';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   GenreExplorer — rich, interactive genre discovery.
   Each card: emoji icon, editorial blurb, representative artwork
   (first cover in the current discovery pool), live title count,
   and hover micro-interactions (lift, glow, artwork zoom).
   ═══════════════════════════════════════════════════════════════ */

export function GenreExplorer({ pool }: { pool: HomeTitle[] }) {
  // Genre → titles currently visible in the discovery pool.
  const byGenre = new Map<string, HomeTitle[]>();
  pool.forEach((t) => (t.genres ?? []).forEach((g) => {
    const list = byGenre.get(g) ?? [];
    list.push(t);
    byGenre.set(g, list);
  }));

  return (
    <section aria-label="Browse by genre">
      <SectionHeader title="Explore Genres" href="/browse" sub="Find your next obsession" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {GENRES_META.map((genre, i) => {
          const titles = byGenre.get(genre.key) ?? [];
          const artwork = titles[0]?.coverUrl ?? null;
          return (
            <Link
              key={genre.key}
              href={`/browse?genres=${genre.key}`}
              className="group relative h-36 overflow-hidden rounded-2xl border border-mv-border bg-mv-surface/50 transition-all duration-300 hover:-translate-y-1 hover:border-mv-violet/40 hover:shadow-card-hover"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {/* Representative artwork backdrop */}
              <div className="absolute inset-0 opacity-40 transition-all duration-500 group-hover:scale-105 group-hover:opacity-60" aria-hidden="true">
                {artwork ? (
                  <CoverImage src={artwork} title={genre.label} type="MANGA" className="h-full w-full" />
                ) : (
                  <div className={cn('h-full w-full bg-gradient-to-br', genre.accent)} />
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-mv-darker/95 via-mv-darker/40 to-mv-darker/10" />

              {/* Glow on hover */}
              <div
                className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-40"
                style={{ background: genre.glow }}
                aria-hidden="true"
              />

              <div className="relative flex h-full flex-col p-3.5">
                <span className="text-2xl drop-shadow transition-transform duration-300 group-hover:scale-110" aria-hidden="true">
                  {genre.emoji}
                </span>
                <p className="mt-auto text-sm font-bold text-white">{genre.label}</p>
                <p className="mt-0.5 line-clamp-1 text-[9px] text-mv-text-muted">{genre.blurb}</p>
                <span className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-medium text-mv-violet opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  {titles.length > 0 ? `${titles.length} on the shelf` : 'Explore'}
                  <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

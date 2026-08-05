'use client';

import Link from 'next/link';
import { GENRES_META } from '@/components/home/types';
import { useGenreCounts } from '@/lib/hooks/useTitles';
import { toDbGenre } from './utils';
import { compactNumber } from '@mangaverse/shared';

/* ═══════════════════════════════════════════════════════════════
   GenreGrid — the genre explorer of the Discovery Hub.
   Each card carries its own identity (emoji, blurb, glow color) and
   a LIVE title count from /api/titles/genres. Cards deep-link to the
   dedicated /genre/[slug] pages.
   ═══════════════════════════════════════════════════════════════ */

export function GenreGrid() {
  const { data: counts } = useGenreCounts();
  const countsMap = new Map((counts ?? []).map((g) => [toDbGenre(g.genre), g.count]));

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {GENRES_META.map((g) => {
        const dbKey = toDbGenre(g.key);
        const count = countsMap.get(dbKey) ?? 0;
        return (
          <Link
            key={g.key}
            href={`/genre/${dbKey}`}
            className="group relative overflow-hidden rounded-2xl border border-mv-border-light bg-mv-surface/50 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-mv-violet/40 hover:shadow-card-hover"
          >
            <div
              className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-15 blur-2xl transition-opacity duration-300 group-hover:opacity-40"
              style={{ background: `radial-gradient(circle, ${g.glow}, transparent 70%)` }}
            />
            <div className="flex items-center gap-2.5">
              <span className="text-xl transition-transform duration-300 group-hover:scale-110" aria-hidden="true">{g.emoji}</span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-white">{g.label}</p>
                <p className="text-[9px] text-mv-text-muted">{count > 0 ? `${compactNumber(count)} titles` : 'Explore'}</p>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-[9px] leading-relaxed text-mv-text-muted">{g.blurb}</p>
          </Link>
        );
      })}
    </div>
  );
}

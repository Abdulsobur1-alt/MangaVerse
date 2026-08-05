'use client';

import { useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { TitleDetail } from '@/lib/hooks/useTitles';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   StatsDashboard — visual analytics without inventing endpoints.
   • Community rating bar (0–10 with a gradient fill)
   • Stat tiles: saved / views / chapters / reviews / est. finish
   • Completion rate (per-chapter progress, when signed in)
   • Genre ranking strip (genres as ranked pills)
   ═══════════════════════════════════════════════════════════════ */

interface StatsDashboardProps {
  title: TitleDetail;
  chaptersTotal: number;
  views: number;
  readCount: number;
  progressPct: number;
  estMinutes: number | null;
  averageRating: number | null;
  totalReviews: number;
}

export function StatsDashboard({
  title,
  chaptersTotal,
  views,
  readCount,
  progressPct,
  estMinutes,
  averageRating,
  totalReviews,
}: StatsDashboardProps) {
  const rating = averageRating ?? title.rating ?? 0;
  const ratingPct = Math.min(100, (rating / 10) * 100);
  const completionPct = chaptersTotal > 0 ? Math.round((readCount / chaptersTotal) * 100) : 0;

  const tiles = useMemo(
    () => [
      { icon: 'star' as const, label: 'Community rating', value: rating ? `${rating.toFixed(1)}/10` : '—', sub: `${totalReviews} reviews` },
      { icon: 'bookmark' as const, label: 'Saved', value: (title._count?.bookmarks ?? 0).toLocaleString(), sub: 'libraries' },
      { icon: 'eye' as const, label: 'Views', value: views.toLocaleString(), sub: 'estimated' },
      { icon: 'book' as const, label: 'Chapters', value: chaptersTotal.toLocaleString(), sub: estMinutes ? `≈ ${estMinutes} min total` : 'length unknown' },
      { icon: 'check' as const, label: 'Your progress', value: `${completionPct}%`, sub: `${readCount} of ${chaptersTotal} read` },
      { icon: 'zap' as const, label: 'Genres', value: String(title.genres?.length ?? 0), sub: 'explore the ranking below' },
    ],
    [rating, totalReviews, title, views, chaptersTotal, estMinutes, completionPct, readCount],
  );

  return (
    <section aria-label="Statistics" className="rounded-2xl border border-mv-border bg-mv-darker p-6">
      <p className="eyebrow mb-5 flex items-center gap-2">
        <Icon name="chart" size={12} className="text-mv-violet" />
        Stats
      </p>

      {/* Rating bar */}
      <div className="mb-6">
        <div className="mb-2 flex items-end justify-between">
          <span className="text-[10px] text-mv-text-muted">Community rating</span>
          <span className="flex items-center gap-1 text-lg font-bold text-mv-gold">
            ★ {rating.toFixed(1)}<span className="text-[10px] font-normal text-mv-text-dim">/ 10</span>
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-mv-gold/70 via-mv-gold to-amber-300 transition-all duration-700"
            style={{ width: `${ratingPct}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[8px] text-mv-text-dim">
          <span>0</span>
          <span>5</span>
          <span>10</span>
        </div>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="group rounded-xl border border-mv-border bg-mv-surface/50 p-3 transition-colors hover:border-mv-violet/30">
            <div className="flex items-center gap-1.5 text-mv-text-muted">
              <Icon name={t.icon} size={12} className="text-mv-violet/80" />
              <span className="truncate text-[8px] font-semibold uppercase tracking-[0.1em]">{t.label}</span>
            </div>
            <p className="mt-1.5 text-lg font-bold text-white">{t.value}</p>
            <p className="text-[9px] text-mv-text-dim">{t.sub}</p>
          </div>
        ))}
      </div>

      {/* Genre ranking */}
      {title.genres && title.genres.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-mv-text-muted">Genres on this title</p>
          <div className="flex flex-wrap gap-1.5">
            {title.genres.map((g, i) => (
              <span
                key={g}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px]',
                  i === 0 ? 'border-mv-gold/30 bg-mv-gold/10 font-semibold text-mv-gold' : 'border-mv-border-light bg-mv-surface/60 text-mv-text-secondary',
                )}
              >
                {i === 0 && <Icon name="star" size={9} />}
                {g.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

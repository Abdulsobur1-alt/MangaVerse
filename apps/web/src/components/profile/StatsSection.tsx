'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { getGenreColor } from '@/lib/hooks/useReadingStats';
import { cn } from '@/lib/cn';
import type { AnalyticsData } from '@/lib/hooks/useIdentity';

/* ═══════════════════════════════════════════════════════════════
   StatsSection — the premium analytics dashboard (Phase 9).
   Story-first tiles ("428 hours exploring stories") backed by real
   visualizations: a 365-day heatmap, monthly rhythm bars, favorite
   genres / authors / artists, and longest vs fastest series.
   ═══════════════════════════════════════════════════════════════ */

function formatHours(h: number): string {
  return h >= 1000 ? `${Math.round(h).toLocaleString()} hrs` : `${h} hrs`;
}

function StatTile({ label, value, icon, accent, hint }: { label: string; value: string | number; icon: 'book' | 'clock' | 'compass' | 'flame' | 'star' | 'check' | 'calendar' | 'moon'; accent?: string; hint: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-mv-border bg-mv-darker p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-mv-violet/30 hover:shadow-card-hover">
      <div className="pointer-events-none absolute -right-4 -top-6 h-16 w-16 rounded-full bg-mv-accent/10 blur-2xl" />
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">{label}</p>
        <Icon name={icon} size={13} className="text-mv-text-dim" />
      </div>
      <p className={cn('mt-1.5 text-2xl font-bold tracking-tight', accent || 'text-white')}>{value}</p>
      <p className="mt-0.5 text-[10px] text-mv-text-dim">{hint}</p>
    </div>
  );
}

export function StatsSection({ stats, className }: { stats: AnalyticsData; className?: string }) {
  // 365-day heatmap: oldest → newest, rendered as weeks.
  const heatWeeks: { date: string; read: boolean; count: number }[][] = [];
  for (let i = 0; i < stats.readingCalendar.length; i += 7) {
    heatWeeks.push(stats.readingCalendar.slice(i, i + 7));
  }

  const maxMonth = Math.max(...stats.readingByMonth.map((m) => m.chapters), 1);
  const maxGenre = Math.max(...stats.genreDistribution.map((g) => g.count), 1);
  const maxAuthor = Math.max(...stats.favoriteAuthors.map((a) => a.chapters), 1);
  const maxArtist = Math.max(...stats.favoriteArtists.map((a) => a.chapters), 1);

  return (
    <div className={cn('space-y-5', className)}>
      {/* ─── Narrative tiles ────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Hours Exploring" value={formatHours(stats.hoursRead)} icon="clock" accent="text-mv-violet" hint="estimated from pages read" />
        <StatTile label="Pages Turned" value={stats.pagesRead.toLocaleString()} icon="book" hint="across every series" />
        <StatTile label="Chapters Read" value={stats.totalChapters.toLocaleString()} icon="compass" hint={`${stats.totalSeries} series explored`} />
        <StatTile label="Series Completed" value={stats.seriesCompleted} icon="check" accent="text-mv-success" hint={`${stats.completionRate}% completion rate`} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Best Streak" value={stats.bestStreak} icon="flame" accent="text-mv-orange" hint="days in a row" />
        <StatTile label="Avg. Rating Given" value={stats.averageRatingGiven ?? '—'} icon="star" accent="text-mv-gold" hint="out of 10" />
        <StatTile label="Reading Days" value={stats.totalReadingDays.toLocaleString()} icon="calendar" hint="lifetime active days" />
        <StatTile label="Night Owl" value={`${stats.nightShare}%`} icon="moon" accent="text-mv-purple" hint="reading after 10pm" />
      </div>

      {/* ─── Year heatmap ───────────────────────── */}
      <section className="rounded-2xl border border-mv-border bg-mv-darker p-5" aria-label="Yearly reading calendar">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
            <Icon name="calendar" size={13} /> Your year at a glance
          </h3>
          <span className="text-[9px] text-mv-text-dim">{stats.daysActive} active days · last 365</span>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {heatWeeks.map((week, wi) => (
            <div key={wi} className="flex shrink-0 flex-col gap-1">
              {week.map((day) => (
                <div
                  key={day.date}
                  className="h-3 w-3 rounded-[3px] transition-colors"
                  style={{
                    background: day.read
                      ? day.count >= 4 ? '#e94560' : day.count >= 2 ? 'rgba(233,69,96,0.75)' : 'rgba(233,69,96,0.45)'
                      : 'rgba(255,255,255,0.06)',
                  }}
                  title={`${day.date}${day.read ? ` — ${day.count} chapter${day.count === 1 ? '' : 's'}` : ''}`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-2 text-[8px] text-mv-text-dim">
          <span>Less</span>
          {[0.06, 0.45, 0.75, 1].map((o, i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: i === 0 ? 'rgba(255,255,255,0.06)' : `rgba(233,69,96,${o})` }} />
          ))}
          <span>More</span>
        </div>
      </section>

      {/* ─── Monthly rhythm ─────────────────────── */}
      <section className="rounded-2xl border border-mv-border bg-mv-darker p-5" aria-label="Reading by month">
        <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
          <Icon name="trendingUp" size={13} /> Reading rhythm
        </h3>
        <div className="flex h-28 items-end gap-1.5">
          {stats.readingByMonth.map((m) => (
            <div key={m.key} className="group relative flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-mv-purple to-mv-accent transition-all duration-500 group-hover:from-mv-accent group-hover:to-mv-violet"
                style={{ height: `${Math.max(6, (m.chapters / maxMonth) * 100)}%` }}
              />
              <span className="text-[8px] text-mv-text-dim">{m.label}</span>
              <span className="pointer-events-none absolute -top-7 whitespace-nowrap rounded-md border border-mv-border-light bg-mv-darker px-2 py-1 text-[9px] font-medium text-mv-text opacity-0 shadow-modal transition-opacity group-hover:opacity-100">
                {m.chapters} chapters · {Math.round(m.minutes)} min
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ─── Favorite genres ───────────────────── */}
        <section className="rounded-2xl border border-mv-border bg-mv-darker p-5" aria-label="Favorite genres">
          <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
            <Icon name="heart" size={13} /> Favorite genres
          </h3>
          {stats.genreDistribution.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-mv-text-dim">Read a few series to unlock genre analytics.</p>
          ) : (
            <div className="space-y-2.5">
              {stats.genreDistribution.slice(0, 6).map((g) => (
                <div key={g.genre} className="flex items-center gap-3">
                  <Link href={`/genre/${g.genre}`} className="w-28 truncate text-[10px] text-mv-text-secondary transition-colors hover:text-mv-violet">
                    {g.genre.replace(/_/g, ' ')}
                  </Link>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-mv-surface">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(g.count / maxGenre) * 100}%`, backgroundColor: getGenreColor(g.genre) }} />
                  </div>
                  <span className="w-6 text-right text-[10px] tabular-nums text-mv-text-dim">{g.count}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Longest & fastest series ──────────── */}
        <section className="rounded-2xl border border-mv-border bg-mv-darker p-5" aria-label="Standout series">
          <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
            <Icon name="trophy" size={13} /> Standout series
          </h3>
          <div className="space-y-3">
            {stats.longestSeries && (
              <Link href={`/title/${stats.longestSeries.slug}`} className="flex items-center gap-3 rounded-xl border border-mv-border bg-mv-surface/40 px-3.5 py-3 transition-colors hover:border-mv-violet/40">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mv-violet/15 text-mv-violet"><Icon name="book" size={15} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-mv-text-dim">Most read</p>
                  <p className="truncate text-xs font-medium text-mv-text">{stats.longestSeries.title}</p>
                </div>
                <span className="shrink-0 text-[10px] font-semibold text-mv-violet">{stats.longestSeries.chaptersRead} ch</span>
              </Link>
            )}
            {stats.fastestCompletedSeries && (
              <Link href={`/title/${stats.fastestCompletedSeries.slug}`} className="flex items-center gap-3 rounded-xl border border-mv-border bg-mv-surface/40 px-3.5 py-3 transition-colors hover:border-mv-violet/40">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mv-orange/15 text-mv-orange"><Icon name="zap" size={15} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-mv-text-dim">Fastest completed</p>
                  <p className="truncate text-xs font-medium text-mv-text">{stats.fastestCompletedSeries.title}</p>
                </div>
                <span className="shrink-0 text-[10px] font-semibold text-mv-orange">{stats.fastestCompletedSeries.days}d</span>
              </Link>
            )}
            {!stats.longestSeries && !stats.fastestCompletedSeries && (
              <p className="py-4 text-center text-[11px] text-mv-text-dim">Finish a series to crown a champion.</p>
            )}
          </div>
        </section>

        {/* ─── Favorite authors ──────────────────── */}
        <section className="rounded-2xl border border-mv-border bg-mv-darker p-5" aria-label="Favorite authors">
          <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
            <Icon name="users" size={13} /> Favorite authors
          </h3>
          {stats.favoriteAuthors.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-mv-text-dim">Author insights appear after a few series.</p>
          ) : (
            <ul className="space-y-1">
              {stats.favoriteAuthors.map((a, i) => (
                <li key={a.author}>
                  <Link href={`/author/${encodeURIComponent(a.author)}`} className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-mv-surface">
                    <span className="w-4 text-[10px] font-bold text-mv-text-dim">#{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-mv-text-secondary transition-colors hover:text-mv-violet">{a.author}</span>
                    <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-mv-surface sm:block">
                      <div className="h-full rounded-full bg-gradient-to-r from-mv-purple to-mv-accent" style={{ width: `${(a.chapters / maxAuthor) * 100}%` }} />
                    </div>
                    <span className="shrink-0 text-[9px] tabular-nums text-mv-text-dim">{a.chapters} ch</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ─── Favorite artists ──────────────────── */}
        <section className="rounded-2xl border border-mv-border bg-mv-darker p-5" aria-label="Favorite artists">
          <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
            <Icon name="palette" size={13} /> Favorite artists
          </h3>
          {stats.favoriteArtists.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-mv-text-dim">Artist insights appear after a few series.</p>
          ) : (
            <ul className="space-y-1">                {stats.favoriteArtists.map((a, i) => (
                  <li key={a.artist}>
                  <Link href={`/author/${encodeURIComponent(a.artist)}`} className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-mv-surface">
                    <span className="w-4 text-[10px] font-bold text-mv-text-dim">#{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-mv-text-secondary transition-colors hover:text-mv-violet">{a.artist}</span>
                    <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-mv-surface sm:block">
                      <div className="h-full rounded-full bg-gradient-to-r from-mv-accent to-mv-purple" style={{ width: `${(a.chapters / maxArtist) * 100}%` }} />
                    </div>
                    <span className="shrink-0 text-[9px] tabular-nums text-mv-text-dim">{a.chapters} ch</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ─── Completed series shelf ──────────────── */}
      {stats.completedSeries.length > 0 && (
        <section className="rounded-2xl border border-mv-border bg-mv-darker p-5" aria-label="Completed series">
          <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
            <Icon name="check" size={13} /> Stories you finished
          </h3>
          <div className="scrollbar-none -mx-5 flex gap-3 overflow-x-auto px-5 sm:mx-0 sm:px-0">
            {stats.completedSeries.map((s) => (
              <Link key={s.titleId} href={`/title/${s.slug}`} className="group w-24 shrink-0">
                <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-mv-surface transition-transform duration-300 group-hover:scale-[1.03]">
                  {s.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-2xl text-mv-text-dim">📕</span>
                  )}
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-mv-success text-white"><Icon name="check" size={10} strokeWidth={3} /></span>
                </div>
                <p className="mt-1.5 truncate text-[10px] font-medium text-mv-text-secondary transition-colors group-hover:text-white">{s.title}</p>
                <p className="text-[8px] text-mv-text-dim">{s.chaptersRead} ch</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

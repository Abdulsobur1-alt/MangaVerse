'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/store/authStore';
import { useReadingHistory, useReadingStats, getGenreColor, type PerTitleStat } from '@/lib/hooks/useReadingStats';
import { useAchievements } from '@/lib/hooks/useAchievements';
import { useGoals, GOAL_TYPE_META } from '@/lib/hooks/useGoals';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Dashboard — the reader's command center (Phase 7).
   Answers "how much have I read, and what kind of reader am I?":
   • Welcome hero with streak flame + coin chip
   • Stat tiles: chapters / series / streak / active days
   • Calendar heatmap (90 days) · favorite genres & authors
   • Recent activity feed · goals summary · achievements summary
   Everything derives from /reading/stats, /reading/history,
   /achievements and /goals — no new analytics endpoints needed.
   ═══════════════════════════════════════════════════════════════ */

interface HistoryEntry {
  id: string;
  pageNumber: number;
  completed: boolean;
  chapter: { id: string; number: number; title: string | null; series: { slug: string; title: string; coverUrl: string | null } };
  updatedAt: string;
}

function StatCard({ label, value, accent, icon, hint }: { label: string; value: string | number; accent?: string; icon: 'book' | 'compass' | 'flame' | 'calendar'; hint: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-mv-border bg-mv-darker p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-mv-violet/30 hover:shadow-card-hover">
      <div className="pointer-events-none absolute -right-4 -top-6 h-16 w-16 rounded-full bg-mv-accent/10 blur-2xl" />
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">{label}</p>
        <Icon name={icon} size={13} className="text-mv-text-dim" />
      </div>
      <p className={`mt-1.5 text-2xl font-bold tracking-tight ${accent || 'text-white'}`}>{value}</p>
      <p className="mt-0.5 text-[10px] text-mv-text-dim">{hint}</p>
    </div>
  );
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data: stats, isLoading: statsLoading } = useReadingStats();
  const { data: history } = useReadingHistory(1, 8);
  const { data: achievements } = useAchievements();
  const { data: goals } = useGoals();

  const historyItems = (history as unknown as { items: HistoryEntry[] } | undefined)?.items ?? [];

  // Favorite authors — aggregate chapters read per author from per-title stats.
  const topAuthors = useMemo(() => {
    const perTitle: PerTitleStat[] = stats?.perTitle ?? [];
    const byAuthor = new Map<string, { author: string; chapters: number; titles: number }>();
    for (const t of perTitle) {
      if (!t.author) continue;
      const entry = byAuthor.get(t.author) ?? { author: t.author, chapters: 0, titles: 0 };
      entry.chapters += t.chaptersRead;
      entry.titles += 1;
      byAuthor.set(t.author, entry);
    }
    return [...byAuthor.values()].sort((a, b) => b.chapters - a.chapters).slice(0, 5);
  }, [stats]);

  const topGenres = useMemo(() => [...(stats?.genreDistribution ?? [])].sort((a, b) => b.count - a.count).slice(0, 5), [stats]);
  const maxGenreCount = topGenres[0]?.count ?? 1;
  const activeGoals = (goals ?? []).filter((g) => g.active).slice(0, 3);
  const earnedBadges = achievements?.items.filter((b) => b.earned) ?? [];
  // Catalog order ≠ chronological order — sort by earnedAt for a truthful
  // "latest unlock".
  const latestBadge = [...earnedBadges].sort((a, b) => new Date(b.earnedAt!).getTime() - new Date(a.earnedAt!).getTime())[0];

  // Heatmap: 90-day calendar rendered as ~13 week columns × 7 days (GitHub
  // style). readingCalendar arrives newest-first (index 0 = today) — reverse
  // so time flows oldest → newest left to right.
  const heatWeeks = useMemo(() => {
    const ordered = [...(stats?.readingCalendar ?? [])].reverse();
    const weeks: { date: string; read: boolean }[][] = [];
    for (let i = 0; i < ordered.length; i += 7) {
      weeks.push(ordered.slice(i, i + 7));
    }
    return weeks;
  }, [stats]);

  const daysActive = stats?.daysActive ?? 0;

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 md:px-8">
          {/* ─── Welcome hero ───────────────────────── */}
          <header className="relative overflow-hidden rounded-3xl border border-mv-border bg-mv-darker p-6 md:p-8">
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-mv-purple/15 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-mv-accent/10 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="" className="h-14 w-14 rounded-2xl object-cover ring-2 ring-mv-border-light" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-mv-purple to-mv-accent text-xl font-bold text-white shadow-glow-sm">
                    {user?.displayName?.charAt(0)?.toUpperCase() || 'R'}
                  </div>
                )}
                <div>
                  <p className="eyebrow mb-1">Reader Dashboard</p>
                  <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                    Welcome back, {user?.displayName?.split(' ')[0] || 'Reader'}
                  </h1>
                  <p className="mt-1 text-xs text-mv-text-muted">
                    {daysActive > 0 ? `${daysActive} active days in the last 90 · ` : ''}keep the streak alive.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(user?.streakDays ?? 0) > 0 && (
                  <span className="flex items-center gap-1.5 rounded-full border border-mv-orange/30 bg-mv-orange/10 px-3.5 py-1.5 text-xs font-bold text-mv-orange">
                    <Icon name="flame" size={14} className="fill-current" />
                    {user?.streakDays}-day streak
                  </span>
                )}
                <span className="flex items-center gap-1.5 rounded-full border border-mv-border-light bg-mv-surface/60 px-3.5 py-1.5 text-xs font-semibold text-mv-gold">
                  <Icon name="coins" size={14} />
                  {user?.coinBalance ?? 0}
                </span>
              </div>
            </div>
          </header>

          {/* ─── Stat tiles ─────────────────────────── */}
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Chapters Read" value={statsLoading ? '…' : (stats?.totalChapters ?? 0).toLocaleString()} icon="book" hint="completed chapters" />
            <StatCard label="Series Read" value={statsLoading ? '…' : (stats?.totalSeries ?? 0)} accent="text-mv-violet" icon="compass" hint="different titles" />
            <StatCard label="Streak" value={statsLoading ? '…' : (stats?.streakDays ?? 0)} accent="text-mv-orange" icon="flame" hint="days in a row" />
            <StatCard label="Days Active" value={statsLoading ? '…' : daysActive} accent="text-mv-gold" icon="calendar" hint="of the last 90" />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* ─── Heatmap ──────────────────────────── */}
            <section className="rounded-2xl border border-mv-border bg-mv-darker p-5" aria-label="Reading calendar">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
                  <Icon name="calendar" size={13} /> Reading calendar
                </h2>
                <Link href="/history" className="text-[10px] text-mv-text-dim transition-colors hover:text-mv-violet">History →</Link>
              </div>
              {!stats || heatWeeks.length === 0 ? (
                <div className="skeleton h-28 rounded-xl" />
              ) : (
                <>
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {heatWeeks.map((week, wi) => (
                      <div key={wi} className="flex shrink-0 flex-col gap-1">
                        {week.map((day) => (
                          <div
                            key={day.date}
                            className="h-3.5 w-3.5 rounded-[3px] transition-colors"
                            style={{ background: day.read ? '#e94560' : 'rgba(255,255,255,0.06)' }}
                            title={`${day.date}${day.read ? ' — read' : ''}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 text-[8px] text-mv-text-dim">
                    <span>Less</span>
                    {[0.06, 0.25, 0.5, 0.75, 1].map((o) => (
                      <span key={o} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: o === 0.06 ? 'rgba(255,255,255,0.06)' : `rgba(233,69,96,${o})` }} />
                    ))}
                    <span>More</span>
                  </div>
                </>
              )}
            </section>

            {/* ─── Favorite genres ───────────────────── */}
            <section className="rounded-2xl border border-mv-border bg-mv-darker p-5" aria-label="Favorite genres">
              <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
                <Icon name="chart" size={13} /> Favorite genres
              </h2>
              {!stats || topGenres.length === 0 ? (
                <p className="py-6 text-center text-[11px] text-mv-text-dim">
                  {statsLoading ? 'Crunching your data…' : 'Read a few chapters to unlock genre analytics.'}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {topGenres.map((g) => (
                    <div key={g.genre} className="flex items-center gap-3">
                      <Link href={`/genre/${g.genre}`} className="w-24 truncate text-[10px] text-mv-text-secondary transition-colors hover:text-mv-violet">
                        {g.genre.replace(/_/g, ' ')}
                      </Link>
                      <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-mv-surface">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(g.count / maxGenreCount) * 100}%`, backgroundColor: getGenreColor(g.genre) }}
                        />
                      </div>
                      <span className="w-6 text-right text-[10px] text-mv-text-dim">{g.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ─── Favorite authors ──────────────────── */}
            <section className="rounded-2xl border border-mv-border bg-mv-darker p-5" aria-label="Favorite authors">
              <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
                <Icon name="users" size={13} /> Favorite authors
              </h2>
              {topAuthors.length === 0 ? (
                <p className="py-6 text-center text-[11px] text-mv-text-dim">
                  {statsLoading ? 'Crunching your data…' : 'Author insights appear once you read a few series.'}
                </p>
              ) : (
                <ul className="space-y-1">
                  {topAuthors.map((a, i) => (
                    <li key={a.author}>
                      <Link
                        href={`/author/${encodeURIComponent(a.author)}`}
                        className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-mv-surface"
                      >
                        <span className="w-4 text-[10px] font-bold text-mv-text-dim">#{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-xs text-mv-text-secondary transition-colors hover:text-mv-violet">{a.author}</span>
                        <span className="text-[9px] text-mv-text-dim">
                          {a.titles} series · {a.chapters} ch
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ─── Recent activity ───────────────────── */}
            <section className="rounded-2xl border border-mv-border bg-mv-darker p-5" aria-label="Recent activity">
              <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
                <Icon name="history" size={13} /> Recent activity
              </h2>
              {historyItems.length === 0 ? (
                <p className="py-6 text-center text-[11px] text-mv-text-dim">Nothing yet — your reading trail starts here.</p>
              ) : (
                <ul className="space-y-1">
                  {historyItems.slice(0, 5).map((entry) => (
                    <li key={entry.id}>
                      <Link href={`/reader/${entry.chapter.id}`} className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-mv-surface">
                        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px]', entry.completed ? 'bg-mv-success/15 text-mv-success' : 'bg-mv-surface text-mv-text-dim')}>
                          {entry.completed ? <Icon name="check" size={13} /> : <Icon name="book" size={13} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs text-mv-text-secondary">{entry.chapter.series.title}</span>
                          <span className="text-[9px] text-mv-text-dim">Ch. {entry.chapter.number}</span>
                        </span>
                        <span className="shrink-0 text-[9px] text-mv-text-dim">{formatDateShort(entry.updatedAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* ─── Goals + Achievements ───────────────── */}
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Goals summary */}
            <section className="rounded-2xl border border-mv-border bg-mv-darker p-5" aria-label="Goals">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
                  <Icon name="zap" size={13} /> Reading goals
                </h2>
                <Link href="/goals" className="text-[10px] text-mv-text-dim transition-colors hover:text-mv-violet">Manage →</Link>
              </div>
              {activeGoals.length === 0 ? (
                <div className="flex flex-col items-center py-5 text-center">
                  <p className="text-[11px] text-mv-text-dim">No active goals.</p>
                  <Link href="/goals" className="btn-primary mt-3 px-4 py-2 text-[10px]">Set a goal</Link>
                </div>
              ) : (
                <ul className="space-y-3.5">
                  {activeGoals.map((g) => {
                    const meta = GOAL_TYPE_META[g.type];
                    return (
                      <li key={g.id}>
                        <Link href="/goals" className="block rounded-lg px-1 transition-colors hover:bg-mv-surface/60">
                          <div className="flex items-baseline justify-between">
                            <p className="truncate text-xs font-medium text-mv-text-secondary">{g.title}</p>
                            <span className={cn('shrink-0 text-[9px] font-semibold', g.done ? 'text-mv-success' : 'text-mv-text-dim')}>
                              {g.current}/{g.target} {meta.unit}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-mv-surface">
                            <div
                              className={cn('h-full rounded-full transition-all duration-700', g.done ? 'bg-mv-success' : 'bg-gradient-to-r from-mv-purple to-mv-accent')}
                              style={{ width: `${Math.max(g.progress, g.progress > 0 ? 3 : 0)}%` }}
                            />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Achievements summary */}
            <section className="rounded-2xl border border-mv-border bg-mv-darker p-5" aria-label="Achievements">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
                  <Icon name="star" size={13} /> Achievements
                </h2>
                <span className="text-[10px] text-mv-text-dim">
                  {achievements?.earned ?? 0} / {achievements?.total ?? 0} unlocked
                </span>
              </div>
              {!achievements ? (
                <div className="skeleton h-20 rounded-xl" />
              ) : (
                <>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-mv-surface">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-mv-gold to-mv-accent transition-all duration-700"
                      style={{ width: `${achievements.total > 0 ? (achievements.earned / achievements.total) * 100 : 0}%` }}
                    />
                  </div>
                  {latestBadge ? (
                    <div className="mt-4 flex items-center gap-3 rounded-xl border border-mv-gold/20 bg-mv-gold/5 px-3.5 py-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mv-gold/20 text-lg">{latestBadge.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-mv-gold">Latest unlock</p>
                        <p className="truncate text-xs font-medium text-mv-text">{latestBadge.name}</p>
                        <p className="truncate text-[9px] text-mv-text-dim">{latestBadge.description}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-[11px] text-mv-text-dim">
                      Complete chapters, keep streaks, and build your library to earn badges.
                    </p>
                  )}
                </>
              )}
            </section>
          </div>

          {/* ─── Quick links ─────────────────────────── */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/library" className="flex items-center gap-2 rounded-full border border-mv-border-light bg-mv-surface/60 px-4 py-2 text-[11px] font-medium text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet">
              <Icon name="library" size={13} /> My library
            </Link>
            <Link href="/collections" className="flex items-center gap-2 rounded-full border border-mv-border-light bg-mv-surface/60 px-4 py-2 text-[11px] font-medium text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet">
              <Icon name="sparkles" size={13} /> Collections
            </Link>
            <Link href="/history" className="flex items-center gap-2 rounded-full border border-mv-border-light bg-mv-surface/60 px-4 py-2 text-[11px] font-medium text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet">
              <Icon name="history" size={13} /> History
            </Link>
            <span className="ml-auto hidden text-[10px] text-mv-text-dim sm:block">
              Stats computed from your reading data · updated live
            </span>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

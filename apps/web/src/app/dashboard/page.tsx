'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Icon } from '@/components/ui/Icon';
import { JourneyTimeline } from '@/components/profile/JourneyTimeline';
import { StatsSection } from '@/components/profile/StatsSection';
import { AchievementsGrid } from '@/components/profile/AchievementsGrid';
import { PersonalityCard } from '@/components/profile/PersonalityCard';
import { ReputationCard } from '@/components/profile/ReputationCard';
import { useAuthStore } from '@/store/authStore';
import { useOwnIdentity } from '@/lib/hooks/useIdentity';
import { useReadingHistory } from '@/lib/hooks/useReadingStats';
import { useAchievements } from '@/lib/hooks/useAchievements';
import { useGoals, GOAL_TYPE_META } from '@/lib/hooks/useGoals';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Dashboard — the reader's editorial command center (Phase 9).
   Your story, told beautifully: hours exploring, the reading
   journey timeline, reader personality, reputation, statistics,
   and the badge cabinet — plus a Wrapped teaser.
   Tabs: Overview · Journey · Statistics · Achievements
   ═══════════════════════════════════════════════════════════════ */

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'home' as const },
  { key: 'journey', label: 'Journey', icon: 'history' as const },
  { key: 'stats', label: 'Statistics', icon: 'chart' as const },
  { key: 'badges', label: 'Achievements', icon: 'trophy' as const },
];

function formatHours(h: number): string {
  return h >= 1000 ? `${Math.round(h).toLocaleString()}` : `${h}`;
}

interface HistoryEntry {
  id: string;
  completed: boolean;
  chapter: { id: string; number: number; series: { slug: string; title: string; coverUrl: string | null } };
  updatedAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data: identity, isLoading } = useOwnIdentity();
  const { data: achievements } = useAchievements();
  const { data: goals } = useGoals();
  const { data: history } = useReadingHistory(1, 6);
  const [tab, setTab] = useState('overview');

  const historyItems = (history as unknown as { items: HistoryEntry[] } | undefined)?.items ?? [];
  const activeGoals = (goals ?? []).filter((g) => g.active).slice(0, 3);
  const stats = identity?.stats;
  const wrapped = identity?.wrapped;

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
          {/* ─── Welcome hero ───────────────────────── */}
          <header className="relative overflow-hidden rounded-3xl border border-mv-border bg-mv-darker p-6 md:p-8">
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-mv-purple/15 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-mv-accent/10 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-wrap items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <Avatar src={user?.avatarUrl} name={user?.displayName || 'Reader'} size="xl" rounded="2xl" ring className="shadow-glow-sm" />
                <div>
                  <p className="eyebrow mb-1">Your Story</p>
                  <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                    {stats && stats.hoursRead > 0
                      ? `You've spent ${formatHours(stats.hoursRead)} hours exploring stories`
                      : `Welcome, ${user?.displayName?.split(' ')[0] || 'Reader'}`}
                  </h1>
                  <p className="mt-1 text-xs text-mv-text-muted">
                    {identity?.readingLevel ? `${identity.readingLevel.current.emoji} ${identity.readingLevel.current.label} · ` : ''}
                    {identity?.reputation ? `${identity.reputation.tier.emoji} ${identity.reputation.tier.label} · ` : ''}
                    {stats ? `${stats.totalChapters.toLocaleString()} chapters · ${stats.pagesRead.toLocaleString()} pages` : 'Every page counts.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/user/${user?.id}`} className="flex items-center gap-1.5 rounded-full border border-mv-border-light bg-mv-surface/60 px-4 py-2 text-[11px] font-medium text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet">
                  <Icon name="dashboard" size={13} /> View public profile
                </Link>
                <Link href="/wrapped" className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-mv-purple to-mv-accent px-4 py-2 text-[11px] font-semibold text-white transition-all hover:brightness-110">
                  <Icon name="gift" size={13} /> Wrapped
                </Link>
              </div>
            </div>
          </header>

          {/* ─── Narrative strip ───────────────────── */}
          {stats && (
            <div className="mt-4 grid grid-cols-2 gap-2.5 md:mt-5 md:grid-cols-4 md:gap-3">
              <NarrativeTile icon="book" label="Pages read" value={stats.pagesRead.toLocaleString()} sub="across every series" />
              <NarrativeTile icon="check" label="Series completed" value={String(stats.seriesCompleted)} sub={`${stats.completionRate}% completion`} />
              <NarrativeTile icon="flame" label="Best streak" value={`${stats.bestStreak} days`} sub="in a row" accent="text-mv-orange" />
              <NarrativeTile icon="moon" label="Night owl" value={`${stats.nightShare}%`} sub="reading after 10pm" accent="text-mv-purple" />
            </div>
          )}

          {/* ─── Tabs — segmented control; scrollable + snap on phones ── */}
          <div className="scrollbar-none -mx-4 mt-6 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Dashboard sections">
            <div className="grid min-w-max grid-cols-4 gap-1 rounded-2xl border border-mv-border bg-mv-darker p-1 sm:w-full sm:min-w-0">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[10px] font-medium transition-all sm:px-2 sm:text-[11px]',
                    tab === t.key ? 'bg-gradient-to-r from-mv-purple to-mv-accent text-white shadow-glow-sm' : 'text-mv-text-secondary hover:bg-white/5 hover:text-mv-text',
                  )}
                >
                  <Icon name={t.icon} size={13} className="hidden sm:block" /> {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Overview tab ──────────────────────── */}
          {tab === 'overview' && (
            <div className="mt-5 space-y-4 md:mt-6 md:space-y-5">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {/* Journey preview */}
                <section className="rounded-2xl border border-mv-border bg-mv-darker p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
                      <Icon name="history" size={13} /> Reading journey
                    </h2>
                    <button onClick={() => setTab('journey')} className="text-[10px] text-mv-text-dim transition-colors hover:text-mv-violet">View all →</button>
                  </div>
                  <JourneyTimeline items={identity?.journey.items ?? []} limit={5} />
                </section>

                {/* Personality + reputation */}
                <div className="space-y-5">
                  {identity?.personality && (
                    <PersonalityCard
                      primary={identity.personality.primary}
                      secondary={identity.personality.secondary}
                      all={identity.personality.all}
                    />
                  )}
                  {identity?.reputation && <ReputationCard reputation={identity.reputation} detailed />}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {/* Recent activity */}
                <section className="rounded-2xl border border-mv-border bg-mv-darker p-5" aria-label="Recent activity">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
                      <Icon name="book" size={13} /> Recent activity
                    </h2>
                    <Link href="/history" className="text-[10px] text-mv-text-dim transition-colors hover:text-mv-violet">History →</Link>
                  </div>
                  {historyItems.length === 0 ? (
                    <p className="py-6 text-center text-[11px] text-mv-text-dim">Nothing yet — your reading trail starts here.</p>
                  ) : (
                    <ul className="space-y-1">
                      {historyItems.slice(0, 5).map((entry) => (
                        <li key={entry.id}>
                          <Link href={`/reader/${entry.chapter.id}`} className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-mv-surface">
                            <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', entry.completed ? 'bg-mv-success/15 text-mv-success' : 'bg-mv-surface text-mv-text-dim')}>
                              <Icon name={entry.completed ? 'check' : 'book'} size={13} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs text-mv-text-secondary">{entry.chapter.series.title}</span>
                              <span className="text-[9px] text-mv-text-dim">Ch. {entry.chapter.number}</span>
                            </span>
                            <span className="shrink-0 text-[9px] text-mv-text-dim">{timeAgo(entry.updatedAt)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Goals */}
                <section className="rounded-2xl border border-mv-border bg-mv-darker p-5" aria-label="Goals">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
                      <Icon name="zap" size={13} /> Reading goals
                    </h2>
                    <Link href="/goals" className="text-[10px] text-mv-text-dim transition-colors hover:text-mv-violet">Manage →</Link>
                  </div>
                  {activeGoals.length === 0 ? (
                    <div className="flex flex-col items-center py-6 text-center">
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
              </div>

              {/* Wrapped teaser */}
              <Link
                href="/wrapped"
                className="group relative block overflow-hidden rounded-3xl border border-mv-border bg-gradient-to-r from-mv-purple/20 via-mv-accent/10 to-mv-darker p-6 transition-all hover:border-mv-violet/40 hover:shadow-card-hover"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-mv-purple to-mv-accent text-xl shadow-glow-sm" aria-hidden="true">🎁</span>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {wrapped ? `Your ${wrapped.year} Wrapped: ${wrapped.chaptersRead} chapters, ${wrapped.hoursRead} hours` : 'Your annual Wrapped is waiting'}
                      </p>
                      <p className="mt-0.5 text-[10px] text-mv-text-muted">
                        {wrapped
                          ? `Reading mood: ${wrapped.mood.emoji} ${wrapped.mood.label} · ${wrapped.totalSeries} series · ${wrapped.achievementsEarned} badges`
                          : 'A shareable year-in-review of every page, streak, and badge.'}
                      </p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-mv-violet transition-transform group-hover:translate-x-0.5">
                    {wrapped ? 'Revisit' : 'Generate'} <Icon name="arrowRight" size={13} />
                  </span>
                </div>
              </Link>
            </div>
          )}

          {/* ─── Journey tab ───────────────────────── */}
          {tab === 'journey' && (
            <div className="mt-6">
              <section className="rounded-2xl border border-mv-border bg-mv-darker p-6">
                <h2 className="mb-1 text-sm font-semibold text-white">Your reading journey</h2>
                <p className="mb-6 text-[10px] text-mv-text-muted">
                  {identity?.journey.count ? `${identity.journey.count} milestones since ${new Date(identity.journey.startedAt ?? '').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.` : 'Milestones appear as you read, review, and connect.'}
                </p>
                <JourneyTimeline items={identity?.journey.items ?? []} />
              </section>
            </div>
          )}

          {/* ─── Statistics tab ────────────────────── */}
          {tab === 'stats' && (
            <div className="mt-6">
              {stats ? (
                <StatsSection stats={stats} />
              ) : (
                <div className="skeleton h-96 rounded-2xl" />
              )}
            </div>
          )}

          {/* ─── Achievements tab ──────────────────── */}
          {tab === 'badges' && (
            <div className="mt-6">
              {achievements ? (
                <AchievementsGrid achievements={achievements} />
              ) : (
                <div className="skeleton h-96 rounded-2xl" />
              )}
            </div>
          )}

          {isLoading && tab === 'overview' && (
            <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="skeleton h-72 rounded-2xl" />
              <div className="skeleton h-72 rounded-2xl" />
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function NarrativeTile({ icon, label, value, sub, accent }: { icon: 'book' | 'check' | 'flame' | 'moon'; label: string; value: string; sub: string; accent?: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-mv-border bg-mv-darker p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-mv-violet/30 hover:shadow-card-hover">
      <div className="pointer-events-none absolute -right-4 -top-6 h-16 w-16 rounded-full bg-mv-accent/10 blur-2xl" />
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">{label}</p>
        <Icon name={icon} size={13} className="text-mv-text-dim" />
      </div>
      <p className={cn('mt-1.5 text-xl font-bold tracking-tight md:text-2xl', accent || 'text-white')}>{value}</p>
      <p className="mt-0.5 text-[10px] text-mv-text-dim">{sub}</p>
    </div>
  );
}

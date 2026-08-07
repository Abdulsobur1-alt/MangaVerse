'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { CoverImage } from '@/components/CoverImage';
import { useReadingHistory, useReadingStats, type HistoryItem } from '@/lib/hooks/useReadingStats';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Reading History — the journey, visualized (Phase 7).
   • Recently Finished rail: series you wrapped, newest first
   • Day-grouped timeline: Today / Yesterday / dated sections
   • Compact stat strip + pagination for long trails
   ═══════════════════════════════════════════════════════════════ */

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const today = new Date();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function timeLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function MiniStat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl border border-mv-border bg-mv-darker px-4 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold tracking-tight ${accent || 'text-white'}`}>{value}</p>
    </div>
  );
}

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const { data: history, isLoading: historyLoading } = useReadingHistory(page, 30);
  const { data: stats } = useReadingStats();

  const totalPages = history ? Math.ceil(history.total / history.limit) : 0;
  const items = history?.items ?? [];

  // Recently finished: completed entries, newest per series.
  const recentlyFinished = useMemo(() => {
    const bySeries = new Map<string, HistoryItem>();
    for (const item of items) {
      if (!item.completed) continue;
      const seriesId = item.chapter.series.slug;
      const existing = bySeries.get(seriesId);
      if (!existing || new Date(item.updatedAt) > new Date(existing.updatedAt)) bySeries.set(seriesId, item);
    }
    return [...bySeries.values()].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 10);
  }, [items]);

  // Day-grouped timeline (page-local).
  const groups = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    for (const item of items) {
      const key = item.updatedAt.split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return [...map.entries()].map(([date, list]) => ({ date, list }));
  }, [items]);

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
          <div className="mb-8">
            <p className="eyebrow mb-2">Reading Journey</p>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
                Reading <span className="text-gradient">History</span>
              </h1>
              {history && !historyLoading && (
                <span className="rounded-full border border-mv-border-light bg-mv-surface/60 px-3 py-1 text-[11px] text-mv-text-secondary">
                  {history.total} entries
                </span>
              )}
            </div>
          </div>

          {/* ─── Stat strip ─────────────────────────── */}
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniStat label="Chapters Read" value={stats ? stats.totalChapters.toLocaleString() : '…'} />
            <MiniStat label="Series Read" value={stats ? stats.totalSeries : '…'} accent="text-mv-violet" />
            <MiniStat label="Day Streak" value={stats ? stats.streakDays : '…'} accent="text-mv-orange" />
            <MiniStat label="Days Active" value={stats ? stats.daysActive : '…'} accent="text-mv-gold" />
          </div>

          {/* ─── Recently finished ──────────────────── */}
          {recentlyFinished.length > 0 && (
            <section aria-label="Recently finished" className="mb-8">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Icon name="check" size={15} className="text-mv-success" />
                Recently Finished
              </h2>
              <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                {recentlyFinished.map((entry) => (
                  <Link
                    key={entry.id}
                    href={`/title/${entry.chapter.series.slug}`}
                    className="group/rail relative w-28 shrink-0 overflow-hidden rounded-xl border border-mv-border bg-mv-darker transition-all duration-300 hover:-translate-y-0.5 hover:border-mv-success/40 hover:shadow-card-hover"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden bg-mv-surface">
                      <CoverImage src={entry.chapter.series.coverUrl} title={entry.chapter.series.title} type="" className="h-full w-full transition-transform duration-500 group-hover/rail:scale-105" />
                      <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-mv-success/90 text-white">
                        <Icon name="check" size={11} />
                      </span>
                    </div>
                    <div className="p-2">
                      <p className="truncate text-[10px] font-medium text-mv-text-secondary transition-colors group-hover/rail:text-white">
                        {entry.chapter.series.title}
                      </p>
                      <p className="mt-0.5 text-[8px] text-mv-text-dim">
                        Finished · Ch. {entry.chapter.number}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ─── Timeline ───────────────────────────── */}
          <section aria-label="History timeline">
            {historyLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-mv-darker p-3.5">
                    <div className="skeleton h-12 w-9 rounded" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3 w-48 rounded" />
                      <div className="skeleton h-2 w-24 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !history || items.length === 0 ? (
              <EmptyState
                icon="history"
                title="No reading history yet"
                body="Every chapter you read becomes a moment on this timeline. Start reading to build it."
                action={
                  <Link href="/browse" className="btn-primary px-5 py-2.5 text-xs">
                    <Icon name="search" size={13} className="mr-1.5 inline" />
                    Browse Titles
                  </Link>
                }
              />
            ) : (
              <div className="relative space-y-8">
                {/* Vertical spine */}
                <div aria-hidden="true" className="absolute bottom-4 left-[13px] top-2 w-px bg-mv-border" />
                {groups.map((group) => (
                  <div key={group.date} className="relative pl-9">
                    {/* Dot */}
                    <span aria-hidden="true" className="absolute left-[7px] top-1 h-3.5 w-3.5 rounded-full border-2 border-mv-violet bg-mv-darker" />
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">{dayLabel(group.date)}</p>
                    <div className="overflow-hidden rounded-2xl border border-mv-border bg-mv-darker">
                      {group.list.map((entry, idx) => (
                        <Link
                          key={entry.id}
                          href={`/reader/${entry.chapter.id}`}
                          className={cn(
                            'group flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-mv-surface',
                            idx > 0 && 'border-t border-mv-border/60',
                          )}
                        >
                          <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md bg-mv-surface">
                            <CoverImage src={entry.chapter.series.coverUrl} title={entry.chapter.series.title} type="" className="h-full w-full" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-mv-text transition-colors group-hover:text-mv-violet">
                              {entry.chapter.series.title}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-mv-text-muted">
                              <span className="rounded bg-white/5 px-1.5 py-0.5 font-medium">Ch. {entry.chapter.number}</span>
                              {entry.chapter.title && <span className="truncate">{entry.chapter.title}</span>}
                              <span className={cn('flex items-center gap-0.5', entry.completed ? 'text-mv-success' : 'text-mv-violet')}>
                                <Icon name={entry.completed ? 'check' : 'book'} size={10} />
                                {entry.completed ? 'Finished' : 'Read'}
                              </span>
                            </span>
                          </span>
                          <span className="shrink-0 text-[9px] text-mv-text-dim">{timeLabel(entry.updatedAt)}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="flex items-center gap-1 rounded-lg border border-mv-border-light bg-mv-surface px-3.5 py-2 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text disabled:opacity-30"
                    >
                      <Icon name="chevronLeft" size={12} /> Prev
                    </button>
                    <span className="text-[10px] text-mv-text-muted">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!history?.hasMore}
                      className="flex items-center gap-1 rounded-lg border border-mv-border-light bg-mv-surface px-3.5 py-2 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text disabled:opacity-30"
                    >
                      Next <Icon name="chevronRight" size={12} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

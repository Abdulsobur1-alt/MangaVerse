'use client';

import Link from 'next/link';
import { useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useReadingHistory, useReadingStats, getGenreColor } from '@/lib/hooks/useReadingStats';

function formatDate(dateStr: string): string {
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

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const { data: history, isLoading: historyLoading } = useReadingHistory(page, 30);
  const { data: stats, isLoading: statsLoading } = useReadingStats();

  const totalPages = history ? Math.ceil(history.total / history.limit) : 0;

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-mv-dark">
        <TopBar />
        <div className="mx-auto max-w-5xl p-6">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-white">Reading History</h1>
            <p className="text-xs text-mv-text-muted mt-0.5">Your reading journey at a glance</p>
          </div>

          {/* ─── Overview Stats ──────────────────── */}
          {statsLoading ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-8 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-mv-darker border border-mv-border" />
              ))}
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
                <div className="rounded-xl border border-mv-border bg-mv-darker p-4">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted mb-1">Chapters Read</p>
                  <p className="text-2xl font-bold text-white">{stats.totalChapters.toLocaleString()}</p>
                  <p className="text-[9px] text-mv-text-muted mt-1">total completed</p>
                </div>
                <div className="rounded-xl border border-mv-border bg-mv-darker p-4">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted mb-1">Series Read</p>
                  <p className="text-2xl font-bold text-mv-purple">{stats.totalSeries}</p>
                  <p className="text-[9px] text-mv-text-muted mt-1">different titles</p>
                </div>
                <div className="rounded-xl border border-mv-border bg-mv-darker p-4">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted mb-1">Day Streak</p>
                  <p className="text-2xl font-bold text-mv-accent">{stats.streakDays}</p>
                  <p className="text-[9px] text-mv-text-muted mt-1">current streak</p>
                </div>
                <div className="rounded-xl border border-mv-border bg-mv-darker p-4">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted mb-1">Days Active</p>
                  <p className="text-2xl font-bold text-mv-gold">{stats.daysActive}</p>
                  <p className="text-[9px] text-mv-text-muted mt-1">out of last 90</p>
                </div>
              </div>

              {/* ─── Genre Distribution ────────────── */}
              {stats.genreDistribution.length > 0 && (
                <div className="mb-6 rounded-xl border border-mv-border bg-mv-darker p-5">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">
                    Genre Distribution
                  </p>
                  <div className="space-y-2">
                    {stats.genreDistribution.slice(0, 8).map((item) => {
                      const maxCount = stats.genreDistribution[0]?.count || 1;
                      const pct = Math.round((item.count / maxCount) * 100);
                      return (
                        <div key={item.genre} className="flex items-center gap-3">
                          <span className="w-20 text-[10px] text-mv-text-secondary truncate shrink-0">
                            {item.genre.replace(/_/g, ' ')}
                          </span>
                          <div className="flex-1 h-4 rounded-full bg-mv-surface overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: getGenreColor(item.genre) }}
                            />
                          </div>
                          <span className="w-8 text-right text-[10px] text-mv-text-dim shrink-0">{item.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ─── Per-Title Stats ───────────────── */}
              {stats.perTitle.length > 0 && (
                <div className="mb-6 rounded-xl border border-mv-border bg-mv-darker p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">
                      Most Read Titles
                    </p>
                  </div>
                  <div className="space-y-1">
                    {stats.perTitle.map((item, idx) => (
                      <Link
                        key={item.titleId}
                        href={`/title/${item.slug}`}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-mv-surface transition-colors"
                      >
                        <span className="w-5 text-[10px] font-bold text-mv-text-dim shrink-0">#{idx + 1}</span>
                        <div className="h-9 w-7 rounded bg-mv-surface flex items-center justify-center text-[9px] shrink-0">
                          {item.type === 'MANHWA' ? '🇰🇷' : item.type === 'MANHUA' ? '🇨🇳' : '📖'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-mv-text truncate">{item.title}</p>
                          <p className="text-[9px] text-mv-text-dim">{item.chaptersRead} chapter{item.chaptersRead !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="h-2 w-16 rounded-full bg-mv-surface overflow-hidden">
                            <div
                              className="h-full rounded-full bg-mv-accent"
                              style={{ width: `${Math.min(100, (item.chaptersRead / (stats.perTitle[0]?.chaptersRead || 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-mv-text-dim w-8 text-right">{item.chaptersRead}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── Reading Calendar ─────────────── */}
              <div className="mb-6 rounded-xl border border-mv-border bg-mv-darker p-5">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">
                  Reading Calendar (Last 90 Days)
                </p>
                <div className="flex flex-wrap gap-1">
                  {stats.readingCalendar.map((day) => (
                    <div
                      key={day.date}
                      className="h-3 w-3 rounded-[2px] transition-colors"
                      style={{ background: day.read ? '#e94560' : '#1a1a2e' }}
                      title={`${day.date}${day.read ? ' — Read' : ''}`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-[2px] bg-[#1a1a2e]" />
                    <span className="text-[8px] text-mv-text-dim">No reading</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-[2px] bg-mv-accent" />
                    <span className="text-[8px] text-mv-text-dim">Read</span>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {/* ─── History Timeline ─────────────────── */}
          <div className="rounded-xl border border-mv-border bg-mv-darker p-5">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">
              History
              {history && <span className="ml-2 text-mv-text-dim font-normal">({history.total} total)</span>}
            </p>

            {historyLoading ? (
              <div className="space-y-2 animate-pulse">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg bg-mv-surface p-3">
                    <div className="h-10 w-8 rounded bg-mv-border-light" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-48 rounded bg-mv-border-light" />
                      <div className="h-2 w-24 rounded bg-mv-border-light" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !history || history.items.length === 0 ? (
              <div className="py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-mv-surface">
                  <svg className="h-6 w-6 text-mv-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <p className="text-xs text-mv-text-muted">No reading history yet.</p>
                <p className="text-[10px] text-mv-text-dim mt-1">Start reading to build your history!</p>
                <Link
                  href="/browse"
                  className="mt-4 inline-flex rounded-lg bg-mv-accent px-4 py-2 text-[10px] font-medium text-white transition-colors hover:bg-red-500"
                >
                  Browse Titles
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  {history.items.map((entry) => (
                    <Link
                      key={entry.id}
                      href={`/reader/${entry.chapter.id}`}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-mv-surface transition-colors"
                    >
                      <div className="flex h-10 w-8 items-center justify-center rounded bg-mv-surface text-[10px] shrink-0">
                        {entry.chapter.series.title.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-mv-text truncate">
                          {entry.chapter.series.title}
                        </p>
                        <p className="text-[10px] text-mv-text-muted">
                          Ch. {entry.chapter.number}
                          {entry.chapter.title ? ` — ${entry.chapter.title}` : ''}
                          {entry.completed ? ' ✅' : ' 📖'}
                        </p>
                      </div>
                      <span className="text-[9px] text-mv-text-dim shrink-0">
                        {formatDate(entry.updatedAt)}
                      </span>
                    </Link>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-5 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="rounded-lg border border-mv-border-light bg-mv-surface px-3 py-1.5 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ← Prev
                    </button>
                    <span className="text-[10px] text-mv-text-muted">Page {page} of {totalPages}</span>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={!history.hasMore}
                      className="rounded-lg border border-mv-border-light bg-mv-surface px-3 py-1.5 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}

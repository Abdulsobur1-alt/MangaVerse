'use client';

import { timeAgo } from '@mangaverse/shared';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { TopBar } from '@/components/TopBar';
import { useAuthStore } from '@/store/authStore';
import { useUserStats } from '@/lib/hooks/useAuth';
import { useReadingHistory } from '@/lib/hooks/useReading';
import { useMyReviews } from '@/lib/hooks/useReviews';
import { useAchievements } from '@/lib/hooks/useAchievements';

const CATEGORY_COLORS: Record<string, string> = {
  reading: '#e94560',
  streak: '#f59e0b',
  exploration: '#7b2fbe',
  social: '#0066ff',
  library: '#1b5e3d',
  coins: '#d4a017',
  community: '#a05bdf',
};

const GENRE_COLORS: Record<string, string> = {
  action: '#e94560',
  fantasy: '#7b2fbe',
  romance: '#e94560',
  horror: '#7b2fbe',
  scifi: '#0066ff',
  adventure: '#1b5e3d',
  comedy: '#d4a017',
  drama: '#5e1b3a',
  thriller: '#2d1b69',
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data: stats } = useUserStats();
  const { data: history } = useReadingHistory();
  const { data: myReviews } = useMyReviews();
  const { data: achievements } = useAchievements();

  const readingData = history as {
    id: string;
    pageNumber: number;
    completed: boolean;
    chapter: { number: number; title: string | null; series: { slug: string; title: string; coverUrl: string | null } };
    updatedAt: string;
  }[] | undefined;

  const s = stats as {
    chaptersRead: number;
    totalBookmarks: number;
    totalReviews: number;
    totalAchievements: number;
    streakDays: number;
    readingCalendar: { date: string; read: boolean }[];
  } | undefined;

  const recentActivity = readingData?.slice(0, 5) || [];
  const calendarDays = s?.readingCalendar || [];
  const recentReviews = myReviews?.slice(0, 3) || [];

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-mv-dark">
        <TopBar />
        <div className="mx-auto max-w-7xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-white">Dashboard</h1>
              <p className="text-xs text-mv-text-muted mt-0.5">
                Welcome back, {user?.displayName || 'Reader'}
              </p>
            </div>
            {user && (
              <div className="flex items-center gap-2 rounded-full border border-mv-border-light bg-mv-surface px-3 py-1.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-mv-accent text-[10px] font-semibold text-white">
                  {user.displayName?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span className="text-xs text-mv-text-secondary">{user.email}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Stats Cards */}
            <div className="rounded-xl bg-mv-darker border border-mv-border p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted mb-1">Chapters Read</p>
              <p className="text-2xl font-bold text-white">
                {s?.chaptersRead?.toLocaleString() || '0'}
              </p>
              {s?.streakDays && s.streakDays > 0 && (
                <p className="text-[10px] text-mv-text-muted mt-1">🔥 {s.streakDays}-day streak</p>
              )}
            </div>
            <div className="rounded-xl bg-mv-darker border border-mv-border p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted mb-1">Reading Streak</p>
              <p className="text-2xl font-bold text-white">
                🔥 <span className="text-mv-accent">{s?.streakDays || 0}</span>
              </p>
              <p className="text-[10px] text-mv-text-muted mt-1">days in a row</p>
            </div>
            <div className="rounded-xl bg-mv-darker border border-mv-border p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted mb-1">Coin Balance</p>
              <p className="text-2xl font-bold text-mv-gold">{user?.coinBalance || 0}</p>
              <p className="text-[10px] text-mv-text-muted mt-1">
                {user?.subscriptionTier === 'premium' ? '⭐ Premium member' : 'Free tier'}
              </p>
            </div>

            {/* Library Stats */}
            <div className="rounded-xl bg-mv-darker border border-mv-border p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted mb-1">Library</p>
              <p className="text-2xl font-bold text-white">
                <span className="text-mv-purple">{s?.totalBookmarks || 0}</span>
              </p>
              <p className="text-[10px] text-mv-text-muted mt-1">books in library</p>
            </div>
            <div className="rounded-xl bg-mv-darker border border-mv-border p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted mb-1">Reviews Written</p>
              <p className="text-2xl font-bold text-white">
                <span className="text-mv-gold">{s?.totalReviews || 0}</span>
              </p>
              <p className="text-[10px] text-mv-text-muted mt-1">contributions</p>
            </div>
            <div className="rounded-xl bg-mv-darker border border-mv-border p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted mb-1">Achievements</p>
              <p className="text-2xl font-bold text-white">
                🏆 {s?.totalAchievements || 0}
              </p>
              <p className="text-[10px] text-mv-text-muted mt-1">badges earned</p>
            </div>

            {/* Achievements */}
            <div className="rounded-xl bg-mv-darker border border-mv-border p-5 md:col-span-3">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Achievements</p>
                <span className="text-[10px] text-mv-text-secondary">
                  🏆 {achievements?.earned || 0} / {achievements?.total || 0} unlocked
                </span>
              </div>

              {!achievements ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-mv-accent border-t-transparent" />
                </div>
              ) : (
                <>
                  {/* Progress bar */}
                  <div className="mb-5">
                    <div className="h-1.5 w-full rounded-full bg-mv-surface overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-mv-accent to-mv-purple transition-all duration-500"
                        style={{ width: `${achievements.total > 0 ? (achievements.earned / achievements.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Badge grid grouped by category */}
                  <div className="space-y-5">
                    {achievements.categories.map((cat) => {
                      const badges = achievements.items.filter((b) => b.category === cat.key);
                      if (badges.length === 0) return null;
                      return (
                        <div key={cat.key}>
                          <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider" style={{ color: CATEGORY_COLORS[cat.key] || '#888' }}>
                            {cat.label}
                          </p>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
                            {badges.map((badge) => (
                              <div
                                key={badge.id}
                                className={`rounded-lg border p-3 text-center transition-all ${
                                  badge.earned
                                    ? 'border-mv-gold/30 bg-mv-gold/5 hover:border-mv-gold/60'
                                    : 'border-mv-border bg-mv-surface/40 opacity-70'
                                }`}
                                title={`${badge.description}${badge.earned ? ` · Earned ${new Date(badge.earnedAt!).toLocaleDateString()}` : ''}`}
                              >
                                <div className={`mx-auto mb-1.5 flex h-10 w-10 items-center justify-center rounded-full text-lg ${
                                  badge.earned ? 'bg-mv-gold/20' : 'bg-mv-surface grayscale opacity-60'
                                }`}>
                                  {badge.emoji}
                                </div>
                                <p className={`text-[10px] font-medium leading-tight ${badge.earned ? 'text-mv-text' : 'text-mv-text-dim'}`}>
                                  {badge.name}
                                </p>
                                {!badge.earned && (
                                  <p className="mt-1 text-[8px] text-mv-text-dim">
                                    {badge.current} / {badge.target}
                                  </p>
                                )}
                                {badge.earned && (
                                  <p className="mt-1 text-[8px] text-mv-gold">Earned ✓</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Streak Calendar */}
            <div className="rounded-xl bg-mv-darker border border-mv-border p-5 md:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted mb-3">
                Reading Calendar (Last 28 Days)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {calendarDays.length > 0 ? (
                  calendarDays.map((day) => (
                    <div
                      key={day.date}
                      className="h-4 w-4 rounded-[3px] transition-colors"
                      style={{ background: day.read ? '#2d1040' : '#1a1a2e' }}
                      title={day.date}
                    />
                  ))
                ) : (
                  Array.from({ length: 28 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-4 w-4 rounded-[3px] bg-mv-surface"
                    />
                  ))
                )}
              </div>
              <p className="text-[9px] text-mv-text-muted mt-2">Purple = reading day</p>
            </div>

            {/* Quick Links */}
            <div className="rounded-xl bg-mv-darker border border-mv-border p-5 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted mb-1">Quick Links</p>
              <a href="/library" className="flex items-center gap-2 rounded-lg bg-mv-surface px-3 py-2 text-xs text-mv-text-secondary hover:text-mv-accent transition-colors">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                My Library
              </a>
              <a href="/browse" className="flex items-center gap-2 rounded-lg bg-mv-surface px-3 py-2 text-xs text-mv-text-secondary hover:text-mv-accent transition-colors">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                Browse Titles
              </a>
              <a href="/history" className="flex items-center gap-2 rounded-lg bg-mv-surface px-3 py-2 text-xs text-mv-text-secondary hover:text-mv-accent transition-colors">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                Reading History
              </a>
            </div>

            {/* Recent Activity */}
            {/* Recent Reviews */}
            {recentReviews.length > 0 && (
              <div className="rounded-xl bg-mv-darker border border-mv-border p-5 md:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Recent Reviews</p>
                  <a href="/reviews" className="text-[9px] text-mv-accent hover:underline">View all</a>
                </div>
                <div className="space-y-2">
                  {recentReviews.map((rev) => (
                    <a
                      key={rev.id}
                      href={`/title/${rev.title.slug}`}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-mv-surface transition-colors"
                    >
                      <div className="flex h-9 w-7 items-center justify-center rounded bg-mv-surface text-[9px]">
                        {rev.title.type === 'MANHWA' ? '🇰🇷' : rev.title.type === 'MANHUA' ? '🇨🇳' : '📖'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-mv-text truncate">{rev.title.title}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[9px] text-mv-gold">{'★'.repeat(rev.rating)}{'☆'.repeat(10 - rev.rating)}</span>
                          <span className="text-[9px] text-mv-text-dim">{rev.rating}/10</span>
                        </div>
                      </div>
                      <svg className="h-3 w-3 text-mv-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl bg-mv-darker border border-mv-border p-5 md:col-span-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted mb-4">Recent Reading Activity</p>

              {recentActivity.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-xs text-mv-text-muted">No reading activity yet.</p>
                  <p className="text-[10px] text-mv-text-muted mt-1">Start reading to see your history here.</p>
                </div>
              )}

              <div className="space-y-1">
                {recentActivity.map((entry) => (
                  <a
                    key={entry.id}
                    href={`/reader/${entry.id}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-mv-surface transition-colors cursor-pointer"
                  >
                    <div className="h-10 w-8 rounded bg-mv-surface flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-mv-text">{entry.chapter.series.title}</p>
                      <p className="text-[10px] text-mv-text-muted">
                        Ch. {entry.chapter.number} {entry.chapter.title ? `— ${entry.chapter.title}` : ''}
                        {entry.completed ? ' ✅ Completed' : ''}
                      </p>
                    </div>
                    <span className="text-[9px] text-mv-text-dim flex-shrink-0">
                      {timeAgo(entry.updatedAt)}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}



'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TopBar } from '@/components/TopBar';
import { useTrendingTitles, useTitles, useRecentlyUpdated } from '@/lib/hooks/useTitles';
import { useReadingProgress } from '@/lib/hooks/useReading';
import { useAuthStore } from '@/store/authStore';

const GENRE_EMOJIS: Record<string, string> = {
  action: '⚔️', adventure: '🏔️', comedy: '😂', drama: '🎭', fantasy: '🧙',
  horror: '👻', isekai: '🌌', mecha: '🤖', mystery: '🔍', romance: '💕',
  'sci-fi': '🚀', 'slice of life': '☕', sports: '🏀', supernatural: '👁️', thriller: '🔪',
};

export default function HomePage() {
  const { token } = useAuthStore();
  const { data: trending } = useTrendingTitles();
  const { data: latest } = useTitles({ sort: 'newest', limit: 12 });
  const { data: recentlyUpdated, isLoading: updatesLoading } = useRecentlyUpdated();
  // Only fetch reading progress for authenticated users — prevents 401s
  const { data: readingData } = useReadingProgress(!!token);
  const [heroIndex, setHeroIndex] = useState(0);

  const trendingList = trending?.slice(0, 10) || [];
  const heroTitles = trendingList.slice(0, 5);

  // Auto-rotate hero carousel
  useEffect(() => {
    if (heroTitles.length < 2) return;
    const interval = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroTitles.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroTitles.length]);

  // Continue reading from reading progress
  const continueReading = token && readingData
    ? (readingData as any[])
        .filter((e: any) => !e.completed)
        .slice(0, 8)
    : [];

  return (
    <main className="min-h-screen bg-mv-dark">
      <TopBar />

      {/* ─── Hero Carousel ───────────────────────────── */}
      <section className="relative h-[340px] overflow-hidden">
        {heroTitles.map((item, idx) => (
          <div
            key={item.slug}
            className={`absolute inset-0 transition-opacity duration-700 ${
              idx === heroIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#0f0820] via-[#1a0535] to-[#0d1040]" />
            <div className="absolute inset-0 bg-gradient-to-t from-mv-dark via-transparent to-transparent" />
            {item.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.coverUrl}
                alt=""
                className="absolute right-0 top-0 h-full w-1/2 object-cover opacity-20 mask-gradient-to-l"
              />
            )}
            <div className="relative z-10 flex h-full items-end">
              <div className="w-full max-w-2xl p-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="rounded-full bg-mv-accent px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                    🔥 Trending #{idx + 1}
                  </span>
                  <span className="rounded-full bg-mv-surface/80 px-2.5 py-0.5 text-[9px] text-mv-text-muted">
                    {item.type === 'MANHWA' ? '🇰🇷 Manhwa' : item.type === 'MANHUA' ? '🇨🇳 Manhua' : item.type?.replace(/_/g, ' ')}
                  </span>
                </div>
                <h1 className="text-2xl font-bold leading-tight text-white md:text-3xl">
                  {item.title}
                </h1>
                <p className="mt-1.5 text-xs text-gray-500">
                  {item.genres?.slice(0, 3).map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(' · ') || ''}
                </p>
                <div className="mt-4 flex gap-3">
                  <Link
                    href={`/title/${item.slug}`}
                    className="rounded-md bg-mv-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
                  >
                    Read Now
                  </Link>
                  <Link
                    href={`/title/${item.slug}`}
                    className="rounded-md border border-gray-700 bg-transparent px-5 py-2 text-sm text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-300"
                  >
                    Details →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Carousel dots */}
        {heroTitles.length > 1 && (
          <div className="absolute bottom-4 right-8 z-20 flex gap-1.5">
            {heroTitles.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setHeroIndex(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  idx === heroIndex ? 'w-6 bg-mv-accent' : 'w-1.5 bg-mv-text-dim hover:bg-mv-text-muted'
                }`}
              />
            ))}
          </div>
        )}
      </section>

      <div className="mx-auto max-w-7xl space-y-12 p-6">
        {/* ─── Continue Reading ────────────────────────── */}
        {continueReading.length > 0 && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-medium text-white flex items-center gap-2">
                <svg className="h-4 w-4 text-mv-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Continue Reading
              </h2>
              <Link href="/library" className="text-xs text-mv-accent hover:underline">View all</Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {continueReading.map((entry: any) => (
                <Link
                  key={entry.id}
                  href={`/reader/${entry.chapter.id}`}
                  className="w-[180px] shrink-0 group"
                >
                  <div className="relative h-[100px] rounded-lg bg-gradient-to-br from-mv-surface to-mv-darker overflow-hidden">
                    {entry.chapter.series.coverUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={entry.chapter.series.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-mv-dark/90 via-transparent to-transparent" />
                    <div className="absolute bottom-2 left-3 right-3">
                      <p className="text-xs font-medium text-white truncate">{entry.chapter.series.title}</p>
                      <p className="text-[10px] text-mv-text-muted">Ch. {entry.chapter.number} · {entry.pageNumber ? `${Math.round(entry.pageNumber / (entry.chapter.pageCount || 20) * 100)}%` : 'Continue'}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ─── Trending Now ─────────────────────────────── */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-medium text-white">🔥 Trending Now</h2>
            <Link href="/browse?sort=trending" className="text-xs text-mv-accent hover:underline">View all</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {trendingList.map((item, idx) => (
              <Link key={item.id} href={`/title/${item.slug}`} className="w-[110px] shrink-0 group">
                <div className="relative h-[150px] rounded-lg bg-mv-darker overflow-hidden transition-transform group-hover:-translate-y-1">
                  {item.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-[10px] text-mv-text-muted text-center px-2">{item.title}</span>
                    </div>
                  )}
                  <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white font-medium">
                    #{idx + 1}
                  </span>
                  {item.rating && (
                    <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1 py-0.5 text-[9px] text-mv-gold">
                      ⭐{item.rating.toFixed(1)}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-gray-400 line-clamp-2 group-hover:text-white transition-colors">
                  {item.title}
                </p>
                <p className="text-[9px] text-mv-text-muted mt-0.5">
                  {item.type === 'LIGHT_NOVEL' ? 'LN' : item.type?.charAt(0).toUpperCase() + item.type?.slice(1).toLowerCase()} · {item.totalChapters || '?'} ch
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* ─── New Updates ────────────────────────────── */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-medium text-white">🆕 New Updates</h2>
            <Link href="/browse?sort=newest" className="text-xs text-mv-accent hover:underline">View all</Link>
          </div>
          {updatesLoading ? (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="w-[150px] shrink-0 animate-pulse">
                  <div className="h-[100px] rounded-lg bg-mv-surface" />
                  <div className="mt-1.5 h-3 w-3/4 rounded bg-mv-surface" />
                  <div className="mt-1 h-2 w-1/2 rounded bg-mv-surface" />
                </div>
              ))}
            </div>
          ) : recentlyUpdated && recentlyUpdated.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {recentlyUpdated.map((item) => {
                const timeAgo = item.latestChapter ? formatTimeAgo(item.latestChapter.createdAt) : '';
                return (
                  <Link key={item.id} href={`/title/${item.slug}`} className="w-[150px] shrink-0 group">
                    <div className="relative h-[100px] rounded-lg bg-mv-darker overflow-hidden transition-transform group-hover:-translate-y-1">
                      {item.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.coverUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-[10px] text-mv-text-muted text-center px-2">{item.title}</span>
                        </div>
                      )}
                      {item.latestChapter && (
                        <span className="absolute right-1.5 top-1.5 rounded bg-mv-accent/90 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                          Ch. {item.latestChapter.number}
                        </span>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-mv-dark/80 via-transparent to-transparent" />
                    </div>
                    <p className="mt-1.5 text-xs text-gray-400 line-clamp-2 group-hover:text-white transition-colors">
                      {item.title}
                    </p>
                    {timeAgo && (
                      <p className="mt-0.5 text-[9px] text-green-400">▲ {timeAgo}</p>
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-mv-border bg-mv-darker p-8 text-center">
              <p className="text-sm text-mv-text-muted">No recent updates yet</p>
              <p className="text-xs text-mv-text-dim mt-1">Check back soon for new chapters</p>
            </div>
          )}
        </section>

        {/* ─── New Releases ──────────────────────────── */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-medium text-white">🆕 New Releases</h2>
            <Link href="/browse?sort=newest" className="text-xs text-mv-accent hover:underline">View all</Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {latest?.items?.slice(0, 12).map((item) => (
              <Link key={item.id} href={`/title/${item.slug}`} className="group cursor-pointer">
                <div className="aspect-[3/4] w-full rounded-lg bg-mv-darker overflow-hidden transition-transform group-hover:scale-[1.02]">
                  {item.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-xs text-mv-text-muted text-center px-2">{item.title}</span>
                    </div>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-gray-400 line-clamp-2 group-hover:text-white transition-colors">
                  {item.title}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded bg-mv-surface px-1.5 py-0.5 text-[8px] text-mv-text-secondary uppercase">
                    {item.type === 'LIGHT_NOVEL' ? 'LN' : item.type?.slice(0, 2)}
                  </span>
                  {item.rating && (
                    <span className="text-[9px] text-mv-gold">⭐ {item.rating.toFixed(1)}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ─── Browse by Genre ─────────────────────────── */}
        <section>
          <h2 className="mb-4 text-base font-medium text-white">Browse by Genre</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(GENRE_EMOJIS).map(([genre, emoji]) => (
              <Link
                key={genre}
                href={`/browse?genres=${genre}`}
                className="group rounded-full border border-mv-border-light bg-mv-surface px-4 py-2 text-xs text-mv-text-secondary transition-all hover:border-mv-accent/50 hover:bg-mv-accent/5 hover:text-mv-accent"
              >
                <span className="mr-1.5">{emoji}</span>
                {genre.replace(/\b\w/g, c => c.toUpperCase())}
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* ─── App Download CTA ────────────────────────── */}
      <section className="mt-12 py-16">
        <div className="mx-auto max-w-4xl rounded-2xl border border-mv-border-light bg-gradient-to-br from-mv-purple/10 via-mv-darker to-mv-accent/5 p-8 text-center md:p-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-mv-purple/30 bg-mv-purple/10 px-4 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
            <span className="text-[10px] font-medium text-green-400">Android APK Available</span>
          </div>
          <h2 className="text-2xl font-bold text-white md:text-3xl">
            Take MangaVerse <span className="text-mv-accent">Everywhere</span>
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-mv-text-secondary">
            Get the native Android app for offline reading, push notifications, and a silky-smooth touch experience. Your library syncs automatically.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/download"
              className="group flex items-center gap-3 rounded-xl bg-mv-accent px-6 py-3 text-sm font-medium text-white transition-all hover:bg-red-500 hover:scale-105"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download for Android
              <span className="text-[10px] text-white/60">v0.1.0 · 18 MB</span>
            </Link>
            <Link
              href="/browse"
              className="rounded-xl border border-mv-border-light bg-mv-surface px-6 py-3 text-sm text-mv-text-secondary transition-colors hover:border-mv-accent/50 hover:text-mv-text"
            >
              Browse Online Instead
            </Link>
          </div>
          <div className="mt-6 flex items-center justify-center gap-6 text-[10px] text-mv-text-dim">
            <span className="flex items-center gap-1">📖 Offline reading</span>
            <span className="flex items-center gap-1">🔔 Push notifications</span>
            <span className="flex items-center gap-1">🔄 Auto sync</span>
            <span className="flex items-center gap-1">⚡ Native speed</span>
          </div>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────── */}
      <footer className="border-t border-mv-border bg-mv-darker py-8">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="text-center sm:text-left">
              <p className="text-xs text-mv-text-muted">
                MangaVerse © {new Date().getFullYear()} — The Ultimate Reading Ecosystem
              </p>
              <p className="mt-1 text-[10px] text-mv-text-dim">
                Read manga, manhwa, manhua & light novels online or on the go.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/download"
                className="flex items-center gap-1.5 rounded-lg border border-mv-purple/30 bg-mv-purple/10 px-3 py-1.5 text-[10px] text-mv-purple transition-all hover:bg-mv-purple/20 hover:border-mv-purple/50"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download APK
              </Link>
              <Link href="/browse" className="text-[10px] text-mv-text-muted hover:text-mv-text transition-colors">Browse</Link>
              <Link href="/community" className="text-[10px] text-mv-text-muted hover:text-mv-text transition-colors">Community</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function formatTimeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

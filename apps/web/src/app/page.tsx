'use client';

import { useState, useEffect, type CSSProperties } from 'react';
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

function SectionHeader({ title, emoji, href }: { title: string; emoji: string; href: string }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <h2 className="flex items-center gap-2.5 text-base font-bold text-white md:text-lg">
        <span className="h-5 w-1 rounded-full bg-gradient-to-b from-mv-accent to-mv-purple" />
        <span>{emoji}</span>
        <span className="bg-gradient-to-r from-white to-mv-text-secondary bg-clip-text text-transparent">{title}</span>
      </h2>
      <Link
        href={href}
        className="group flex items-center gap-1 rounded-full border border-mv-border-light bg-mv-surface/50 px-3 py-1 text-[10px] text-mv-text-secondary transition-all hover:border-mv-accent/40 hover:text-mv-accent"
      >
        View all
        <svg className="h-3 w-3 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

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
      <section className="relative h-[360px] overflow-hidden md:h-[420px]">
        {/* Ambient aurora */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f0820] via-[#1a0535] to-[#0d1040]" />
        <div className="animate-aurora absolute -left-24 top-0 h-80 w-80 rounded-full bg-mv-purple/40 blur-3xl" />
        <div className="animate-aurora absolute right-0 top-10 h-96 w-96 rounded-full bg-mv-accent/25 blur-3xl" style={{ animationDelay: '-6s' }} />
        <div className="absolute inset-0 bg-grid opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-mv-dark via-transparent to-transparent" />

        {heroTitles.map((item, idx) => (
          <div
            key={item.slug}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              idx === heroIndex ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            {item.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.coverUrl}
                alt=""
                className={`mask-gradient-to-l absolute right-0 top-0 h-full w-1/2 object-cover opacity-25 transition-transform duration-[2500ms] ease-out ${
                  idx === heroIndex ? 'scale-105' : 'scale-100'
                }`}
              />
            )}
            <div className="relative z-10 flex h-full items-end">
              <div className="w-full max-w-2xl p-8 md:p-12">
                <div className="mb-4 flex items-center gap-2">
                  <span className="animate-fade-up rounded-full bg-gradient-to-r from-mv-accent to-mv-purple px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg shadow-mv-accent/30">
                    🔥 Trending #{idx + 1}
                  </span>
                  <span
                    className="animate-fade-up glass rounded-full px-2.5 py-1 text-[9px] text-mv-text-secondary"
                    style={{ animationDelay: '80ms' }}
                  >
                    {item.type === 'MANHWA' ? '🇰🇷 Manhwa' : item.type === 'MANHUA' ? '🇨🇳 Manhua' : item.type?.replace(/_/g, ' ')}
                  </span>
                </div>
                <h1 className="animate-fade-up text-2xl font-black leading-tight text-white drop-shadow-lg md:text-4xl" style={{ animationDelay: '140ms' }}>
                  {item.title}
                </h1>
                <p className="animate-fade-up mt-2 text-xs text-mv-text-secondary" style={{ animationDelay: '200ms' }}>
                  {item.genres?.slice(0, 3).map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(' · ') || ''}
                </p>
                <div className="animate-fade-up mt-5 flex gap-3" style={{ animationDelay: '260ms' }}>
                  <Link href={`/title/${item.slug}`} className="btn-primary px-6 py-2.5 text-sm">
                    Read Now
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
                    </svg>
                  </Link>
                  <Link href={`/title/${item.slug}`} className="btn-ghost px-6 py-2.5 text-sm">
                    Details
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Carousel dots */}
        {heroTitles.length > 1 && (
          <div className="absolute bottom-5 right-8 z-20 flex gap-2">
            {heroTitles.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setHeroIndex(idx)}
                aria-label={`Slide ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === heroIndex
                    ? 'w-7 bg-gradient-to-r from-mv-accent to-mv-purple shadow-lg shadow-mv-accent/40'
                    : 'w-2 bg-white/20 hover:bg-white/40'
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
            <SectionHeader title="Continue Reading" emoji="📖" href="/library" />
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
              {continueReading.map((entry: any) => {
                const total = entry.chapter.pageCount || 20;
                const pct = entry.pageNumber ? Math.min(100, Math.round((entry.pageNumber / total) * 100)) : 0;
                return (
                  <Link key={entry.id} href={`/reader/${entry.chapter.id}`} className="group w-[200px] shrink-0">
                    <div className="img-zoom card-lift relative h-[110px] rounded-xl border border-white/5 bg-gradient-to-br from-mv-surface to-mv-darker">
                      {entry.chapter.series.coverUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={entry.chapter.series.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-mv-dark/95 via-transparent to-transparent" />
                      <div className="absolute bottom-2 left-3 right-3">
                        <p className="truncate text-xs font-semibold text-white">{entry.chapter.series.title}</p>
                        <p className="text-[10px] text-mv-text-muted">
                          Ch. {entry.chapter.number} · {entry.pageNumber ? `${pct}%` : 'Continue'}
                        </p>
                      </div>
                      {/* Progress bar */}
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
                        <div
                          className="h-full bg-gradient-to-r from-mv-accent to-mv-purple transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── Trending Now ─────────────────────────────── */}
        <section>
          <SectionHeader title="Trending Now" emoji="🔥" href="/browse?sort=trending" />
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {trendingList.map((item, idx) => (
              <Link key={item.id} href={`/title/${item.slug}`} className="group w-[110px] shrink-0">
                <div className="img-zoom card-lift relative h-[150px] rounded-xl bg-mv-darker">
                  {item.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="px-2 text-center text-[10px] text-mv-text-muted">{item.title}</span>
                    </div>
                  )}
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-gradient-to-r from-mv-accent to-mv-purple px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md shadow-black/40">
                    #{idx + 1}
                  </span>
                  {item.rating && (
                    <span className="glass absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-medium text-mv-gold">
                      ⭐ {item.rating.toFixed(1)}
                    </span>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-mv-text-secondary transition-colors group-hover:text-white">
                  {item.title}
                </p>
                <p className="mt-0.5 text-[9px] text-mv-text-muted">
                  {item.type === 'LIGHT_NOVEL' ? 'LN' : item.type?.charAt(0).toUpperCase() + item.type?.slice(1).toLowerCase()} · {item.totalChapters || '?'} ch
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* ─── New Updates ────────────────────────────── */}
        <section>
          <SectionHeader title="New Updates" emoji="🆕" href="/browse?sort=newest" />
          {updatesLoading ? (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="w-[150px] shrink-0">
                  <div className="skeleton h-[100px] rounded-xl" />
                  <div className="skeleton mt-2 h-3 w-3/4 rounded" />
                  <div className="skeleton mt-1.5 h-2 w-1/2 rounded" />
                </div>
              ))}
            </div>
          ) : recentlyUpdated && recentlyUpdated.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {recentlyUpdated.map((item) => {
                const timeAgo = item.latestChapter ? formatTimeAgo(item.latestChapter.createdAt) : '';
                return (
                  <Link key={item.id} href={`/title/${item.slug}`} className="group w-[150px] shrink-0">
                    <div className="img-zoom card-lift relative h-[100px] rounded-xl bg-mv-darker">
                      {item.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <span className="px-2 text-center text-[10px] text-mv-text-muted">{item.title}</span>
                        </div>
                      )}
                      {item.latestChapter && (
                        <span className="absolute right-1.5 top-1.5 rounded-md bg-gradient-to-r from-mv-accent to-mv-purple px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md shadow-black/40">
                          Ch. {item.latestChapter.number}
                        </span>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-mv-dark/80 via-transparent to-transparent" />
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-mv-text-secondary transition-colors group-hover:text-white">
                      {item.title}
                    </p>
                    {timeAgo && (
                      <p className="mt-0.5 flex items-center gap-1 text-[9px] font-medium text-green-400">
                        <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                        {timeAgo}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-mv-border bg-mv-darker p-8 text-center">
              <p className="text-sm text-mv-text-muted">No recent updates yet</p>
              <p className="mt-1 text-xs text-mv-text-dim">Check back soon for new chapters</p>
            </div>
          )}
        </section>

        {/* ─── New Releases ──────────────────────────── */}
        <section>
          <SectionHeader title="New Releases" emoji="✨" href="/browse?sort=newest" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {latest?.items?.slice(0, 12).map((item) => (
              <Link key={item.id} href={`/title/${item.slug}`} className="group cursor-pointer">
                <div className="img-zoom card-lift relative aspect-[3/4] w-full rounded-xl bg-mv-darker">
                  {item.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="px-2 text-center text-xs text-mv-text-muted">{item.title}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  {item.rating && (
                    <span className="glass absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[9px] font-medium text-mv-gold">
                      ⭐ {item.rating.toFixed(1)}
                    </span>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-mv-text-secondary transition-colors group-hover:text-white">
                  {item.title}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[8px] font-medium uppercase text-mv-text-secondary">
                    {item.type === 'LIGHT_NOVEL' ? 'LN' : item.type?.slice(0, 2)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ─── Browse by Genre ─────────────────────────── */}
        <section>
          <SectionHeader title="Browse by Genre" emoji="🎨" href="/browse" />
          <div className="flex flex-wrap gap-2">
            {Object.entries(GENRE_EMOJIS).map(([genre, emoji]) => (
              <Link
                key={genre}
                href={`/browse?genres=${genre}`}
                className="group rounded-full border border-mv-border-light bg-mv-surface/60 px-4 py-2 text-xs text-mv-text-secondary transition-all duration-200 hover:-translate-y-0.5 hover:border-mv-accent/50 hover:bg-mv-accent/5 hover:text-mv-accent hover:shadow-lg hover:shadow-mv-accent/10"
              >
                <span className="mr-1.5 transition-transform group-hover:scale-110 inline-block">{emoji}</span>
                {genre.replace(/\b\w/g, c => c.toUpperCase())}
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* ─── App Download CTA ────────────────────────── */}
      <section className="mt-12 px-6 py-16">
        <div className="relative mx-auto max-w-4xl rounded-3xl bg-gradient-to-r from-mv-purple via-mv-accent to-mv-gold p-[1.5px] shadow-2xl shadow-mv-purple/25">
          {/* Floating emojis */}
          <span className="animate-float absolute -left-4 -top-4 hidden text-2xl sm:block" style={{ '--float-rot': '-8deg' } as CSSProperties}>📖</span>
          <span className="animate-float-slow absolute -bottom-4 -right-4 hidden text-2xl sm:block" style={{ '--float-rot': '10deg' } as CSSProperties}>🔔</span>
          <span className="animate-float absolute -right-8 top-8 hidden text-xl sm:block" style={{ animationDelay: '-3s', '--float-rot': '6deg' } as CSSProperties}>⚡</span>

          <div className="relative overflow-hidden rounded-[calc(1.5rem-1.5px)] bg-[#0d0d1e]/95 px-8 py-12 text-center backdrop-blur-xl md:p-14">
            <div className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-mv-purple/30 blur-3xl" />
            <div className="pointer-events-none absolute -right-20 bottom-0 h-56 w-56 rounded-full bg-mv-accent/20 blur-3xl" />

            <div className="relative mb-5 inline-flex items-center gap-2 rounded-full border border-green-400/30 bg-green-400/10 px-4 py-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
              <span className="text-[10px] font-medium text-green-400">Android APK Available</span>
            </div>
            <h2 className="relative text-2xl font-black text-white md:text-4xl">
              Take MangaVerse <span className="text-gradient">Everywhere</span>
            </h2>
            <p className="relative mx-auto mt-4 max-w-lg text-sm text-mv-text-secondary">
              Get the native Android app for offline reading, push notifications, and a silky-smooth touch experience. Your library syncs automatically.
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/download" className="btn-primary px-7 py-3.5 text-sm">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download for Android
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">v0.1.0</span>
              </Link>
              <Link href="/browse" className="btn-ghost px-7 py-3.5 text-sm">
                Browse Online Instead
              </Link>
            </div>
            <div className="relative mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] text-mv-text-dim">
              <span>📖 Offline reading</span>
              <span>🔔 Push notifications</span>
              <span>🔄 Auto sync</span>
              <span>⚡ Native speed</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-mv-darker/60 py-10 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-6 h-px w-full bg-gradient-to-r from-transparent via-mv-purple/50 to-transparent" />
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-between">
            <div className="text-center sm:text-left">
              <p className="text-sm font-bold">
                <span className="bg-gradient-to-r from-mv-accent to-mv-purple bg-clip-text text-transparent">Manga</span>
                <span className="text-white">Verse</span>
                <span className="ml-2 text-[10px] font-normal text-mv-text-muted">© {new Date().getFullYear()}</span>
              </p>
              <p className="mt-1 text-[10px] text-mv-text-dim">
                Read manga, manhwa, manhua & light novels online or on the go.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/download"
                className="flex items-center gap-1.5 rounded-lg border border-mv-purple/30 bg-mv-purple/10 px-3 py-1.5 text-[10px] text-mv-purple transition-all hover:border-mv-purple/60 hover:bg-mv-purple/20 hover:shadow-lg hover:shadow-mv-purple/20"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download APK
              </Link>
              <Link href="/browse" className="text-[10px] text-mv-text-muted transition-colors hover:text-mv-text">Browse</Link>
              <Link href="/community" className="text-[10px] text-mv-text-muted transition-colors hover:text-mv-text">Community</Link>
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

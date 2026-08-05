'use client';

import { useState, useEffect, useRef, type CSSProperties } from 'react';
import Link from 'next/link';
import { TopBar } from '@/components/TopBar';
import { Reveal } from '@/components/Reveal';
import { CoverImage } from '@/components/CoverImage';
import { useTrendingTitles, useTitles, useRecentlyUpdated } from '@/lib/hooks/useTitles';
import { useReadingProgress } from '@/lib/hooks/useReading';
import { useAuthStore } from '@/store/authStore';
import { formatTimeAgo, statusColors, formatType, formatTypeFull } from '@/lib/format';

const GENRE_EMOJIS: Record<string, string> = {
  action: '⚔️', adventure: '🏔️', comedy: '😂', drama: '🎭', fantasy: '🧙',
  horror: '👻', isekai: '🌌', mecha: '🤖', mystery: '🔍', romance: '💕',
  'sci-fi': '🚀', slice_of_life: '☕', sports: '🏀', supernatural: '👁️', thriller: '🔪',
};

const CATEGORY_RAILS = [
  { key: 'manga', label: 'Manga', emoji: '🇯🇵', desc: 'Page-flip comics', href: '/browse?format=manga', color: 'from-mv-accent to-mv-purple' },
  { key: 'manhwa', label: 'Manhwa', emoji: '🇰🇷', desc: 'Vertical webtoons', href: '/browse?format=manhwa', color: 'from-mv-purple to-mv-accent' },
  { key: 'manhua', label: 'Manhua', emoji: '🇨🇳', desc: 'Long-form Chinese webtoons', href: '/browse?format=manhua', color: 'from-mv-accent to-mv-gold' },
  { key: 'light_novel', label: 'Light Novels', emoji: '📕', desc: 'Prose, not pages', href: '/browse?format=light_novel', color: 'from-mv-purple to-mv-gold' },
];

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

/* Magnetic wrapper — pulls the child toward the cursor on desktop */
function Magnetic({ children, strength = 0.25 }: { children: React.ReactNode; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
  };

  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = 'translate(0, 0)';
  };

  return (
    <div ref={ref} className="magnetic" onMouseMove={onMove} onMouseLeave={onLeave}>
      {children}
    </div>
  );
}

/* Spotlight card — cursor-following radial glow via CSS vars */
function Spotlight({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  };
  return (
    <div ref={ref} onMouseMove={onMove} className={`spotlight-card ${className}`}>
      {children}
    </div>
  );
}

/* Tilt card — pointer-tracked 3D rotation */
function Tilt({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${px * 7}deg) rotateX(${-py * 7}deg)`;
  };

  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg)';
  };

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={`tilt-card ${className}`}>
      {children}
    </div>
  );
}

/* Hero title with word-by-word stagger */
function HeroTitle({ text }: { text: string }) {
  const words = text.split(' ');
  return (
    <h1 className="text-2xl font-black leading-tight text-white drop-shadow-lg md:text-4xl">
      {words.map((word, i) => (
        <span key={i} className="hero-word" style={{ animationDelay: `${220 + i * 70}ms` }}>
          {word}{' '}
        </span>
      ))}
    </h1>
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
      {/* Film grain overlay */}
      <div className="grain-overlay" aria-hidden="true" />
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
                    {formatTypeFull(item.type)}
                  </span>
                </div>
                {/* Animated word-stagger title, re-keyed per slide */}
                <div key={idx === heroIndex ? item.slug : 'static'}>
                  <HeroTitle text={item.title} />
                </div>
                <p className="animate-fade-up mt-2 text-xs text-mv-text-secondary" style={{ animationDelay: '200ms' }}>
                  {item.genres?.slice(0, 3).map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(' · ') || ''}
                </p>
                <div className="animate-fade-up mt-5 flex gap-3" style={{ animationDelay: '260ms' }}>
                  <Magnetic>
                    <Link href={`/title/${item.slug}`} className="btn-primary px-6 py-2.5 text-sm">
                      Read Now
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
                      </svg>
                    </Link>
                  </Magnetic>
                  <Magnetic>
                    <Link href={`/title/${item.slug}`} className="btn-ghost px-6 py-2.5 text-sm">
                      Details
                    </Link>
                  </Magnetic>
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

      {/* ─── Hot this week marquee ───────────────────── */}
      {trendingList.length > 0 && (
        <div className="relative overflow-hidden border-y border-white/5 bg-mv-darker/60 py-2.5 backdrop-blur-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-mv-darker to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-mv-darker to-transparent" />
          <div className="marquee">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex shrink-0 items-center">
                {trendingList.map((item, idx) => (
                  <Link
                    key={`${dup}-${item.id}`}
                    href={`/title/${item.slug}`}
                    className="flex items-center gap-2 px-5 text-[11px] text-mv-text-secondary transition-colors hover:text-mv-accent"
                  >
                    <span className="text-[9px] font-bold text-mv-accent">#{idx + 1}</span>
                    <span className="max-w-[180px] truncate">{item.title}</span>
                    {item.latestChapter && (
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-mv-text-muted">
                        Ch. {item.latestChapter.number}
                      </span>
                    )}
                    <span className="text-mv-text-dim">·</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl space-y-12 p-6">
        {/* ─── Continue Reading ────────────────────────── */}
        {continueReading.length > 0 && (
          <Reveal>
            <section>
              <SectionHeader title="Continue Reading" emoji="📖" href="/library" />
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
                {continueReading.map((entry: any) => {
                  const total = entry.chapter.pageCount || 20;
                  const pct = entry.pageNumber ? Math.min(100, Math.round((entry.pageNumber / total) * 100)) : 0;
                  return (
                    <Link key={entry.id} href={`/reader/${entry.chapter.id}`} className="group w-[200px] shrink-0">
                      <div className="img-zoom card-lift relative h-[110px] rounded-xl border border-white/5 bg-gradient-to-br from-mv-surface to-mv-darker">
                        {entry.chapter.series.coverUrl ? (
                          <CoverImage
                            src={entry.chapter.series.coverUrl}
                            title={entry.chapter.series.title}
                            type={entry.chapter.series.type}
                            className="absolute inset-0 h-full w-full opacity-40"
                          />
                        ) : null}
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
          </Reveal>
        )}

        {/* ─── Trending Now ─────────────────────────────── */}
        <Reveal>
          <section>
            <SectionHeader title="Trending Now" emoji="🔥" href="/browse?sort=trending" />
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {trendingList.map((item, idx) => (
                <Link key={item.id} href={`/title/${item.slug}`} className="group w-[110px] shrink-0">
                  <Spotlight className="rounded-xl">
                    <div className="img-zoom card-lift relative h-[150px] rounded-xl bg-mv-darker">
                      <CoverImage
                        src={item.coverUrl}
                        title={item.title}
                        type={item.type}
                        className="h-full w-full"
                      />
                      <span className="absolute left-1.5 top-1.5 rounded-md bg-gradient-to-r from-mv-accent to-mv-purple px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md shadow-black/40">
                        #{idx + 1}
                      </span>
                      {item.rating && (
                        <span className="glass absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-medium text-mv-gold">
                          ⭐ {item.rating.toFixed(1)}
                        </span>
                      )}
                      {/* Status banner */}
                      {item.status && (
                        <span className={`absolute bottom-1.5 left-1.5 rounded-md border px-1.5 py-0.5 text-[8px] font-semibold backdrop-blur-sm ${statusColors(item.status).className}`}>
                          {statusColors(item.status).label}
                        </span>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    </div>
                  </Spotlight>
                  <p className="mt-2 line-clamp-2 text-xs text-mv-text-secondary transition-colors group-hover:text-white">
                    {item.title}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[9px] text-mv-text-muted">
                    {formatType(item.type)} · {item.totalChapters || '?'} ch
                  </p>
                  {/* Recency badge (extends New Updates pattern to Trending) */}
                  {item.latestChapter && (
                    <p className="mt-0.5 flex items-center gap-1 text-[9px] font-medium text-green-400">
                      <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      </svg>
                      up to Ch. {item.latestChapter.number} · {formatTimeAgo(item.latestChapter.createdAt)}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ─── New Updates ────────────────────────────── */}
        <Reveal>
          <section>
            <SectionHeader title="New Updates" emoji="🆕" href="/browse?sort=updated" />
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
                        <CoverImage src={item.coverUrl} title={item.title} type={item.type} className="h-full w-full" />
                        {item.latestChapter && (
                          <span className="absolute right-1.5 top-1.5 rounded-md bg-gradient-to-r from-mv-accent to-mv-purple px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md shadow-black/40">
                            Ch. {item.latestChapter.number}
                          </span>
                        )}
                        {/* Status banner */}
                        {item.status && (
                          <span className={`absolute bottom-1.5 left-1.5 rounded-md border px-1.5 py-0.5 text-[8px] font-semibold backdrop-blur-sm ${statusColors(item.status).className}`}>
                            {statusColors(item.status).label}
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
        </Reveal>

        {/* ─── Category Rails (format deep-links) ──────── */}
        <Reveal>
          <section>
            <SectionHeader title="Browse by Format" emoji="🗂️" href="/browse" />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {CATEGORY_RAILS.map((cat) => (
                <Link
                  key={cat.key}
                  href={cat.href}
                  className="group relative overflow-hidden rounded-2xl border border-mv-border-light bg-mv-surface/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-mv-accent/40 hover:shadow-xl hover:shadow-mv-purple/10"
                >
                  <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${cat.color} opacity-15 blur-2xl transition-opacity duration-300 group-hover:opacity-30`} />
                  <div className="text-2xl transition-transform duration-300 group-hover:scale-110">{cat.emoji}</div>
                  <p className="mt-3 text-sm font-bold text-white">{cat.label}</p>
                  <p className="mt-0.5 text-[10px] text-mv-text-muted">{cat.desc}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[10px] text-mv-accent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    Explore
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
                    </svg>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ─── New Releases ──────────────────────────── */}
        <Reveal>
          <section>
            <SectionHeader title="New Releases" emoji="✨" href="/browse?sort=newest" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {latest?.items?.slice(0, 12).map((item) => (
                <Link key={item.id} href={`/title/${item.slug}`} className="group cursor-pointer">
                  <Tilt>
                    <div className="img-zoom card-lift relative aspect-[3/4] w-full rounded-xl bg-mv-darker">
                      <CoverImage src={item.coverUrl} title={item.title} type={item.type} className="h-full w-full" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      {item.rating && (
                        <span className="glass absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[9px] font-medium text-mv-gold">
                          ⭐ {item.rating.toFixed(1)}
                        </span>
                      )}
                      {/* Status banner */}
                      {item.status && (
                        <span className={`absolute bottom-2 left-2 rounded-md border px-1.5 py-0.5 text-[8px] font-semibold backdrop-blur-sm ${statusColors(item.status).className}`}>
                          {statusColors(item.status).label}
                        </span>
                      )}
                      {/* Latest chapter badge */}
                      {item.latestChapter && (
                        <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[8px] font-medium text-mv-text-secondary backdrop-blur-sm">
                          up to Ch. {item.latestChapter.number}
                        </span>
                      )}
                    </div>
                  </Tilt>
                  <p className="mt-2 line-clamp-2 text-xs text-mv-text-secondary transition-colors group-hover:text-white">
                    {item.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[8px] font-medium uppercase text-mv-text-secondary">
                      {formatType(item.type)}
                    </span>
                    {item.latestChapter && (
                      <span className="flex items-center gap-0.5 text-[8px] text-green-400/90">
                        <svg className="h-2 w-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                        {formatTimeAgo(item.latestChapter.createdAt)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ─── Browse by Genre ─────────────────────────── */}
        <Reveal>
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
                  {genre.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </Link>
              ))}
            </div>
          </section>
        </Reveal>
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
              <Magnetic>
                <Link href="/download" className="btn-primary px-7 py-3.5 text-sm">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download for Android
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">v0.1.0</span>
                </Link>
              </Magnetic>
              <Magnetic>
                <Link href="/browse" className="btn-ghost px-7 py-3.5 text-sm">
                  Browse Online Instead
                </Link>
              </Magnetic>
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

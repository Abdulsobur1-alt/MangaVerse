'use client';

import { useState, useEffect, useRef, type CSSProperties } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
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
  { key: 'manga', label: 'Manga', emoji: '🇯🇵', desc: 'Page-flip comics', href: '/browse?format=manga', accent: 'from-mv-purple to-mv-accent' },
  { key: 'manhwa', label: 'Manhwa', emoji: '🇰🇷', desc: 'Vertical webtoons', href: '/browse?format=manhwa', accent: 'from-mv-violet to-mv-purple' },
  { key: 'manhua', label: 'Manhua', emoji: '🇨🇳', desc: 'Long-form webtoons', href: '/browse?format=manhua', accent: 'from-mv-accent to-mv-violet' },
  { key: 'light_novel', label: 'Light Novels', emoji: '📕', desc: 'Prose, not pages', href: '/browse?format=light_novel', accent: 'from-mv-purple to-mv-violet' },
];

/* ─── Section header ─────────────────────────────────────────── */
function SectionHeader({ title, href, sub }: { title: string; href: string; sub?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between">
      <div>
        <h2 className="flex items-center gap-2.5 text-lg font-bold text-white md:text-xl">
          <span className="h-5 w-1 rounded-full bg-gradient-to-b from-mv-purple to-mv-accent" />
          <span>{title}</span>
        </h2>
        {sub && <p className="mt-1 pl-3.5 text-[11px] text-mv-text-muted">{sub}</p>}
      </div>
      <Link
        href={href}
        className="group flex items-center gap-1 rounded-full border border-mv-border-light bg-mv-surface/50 px-3.5 py-1.5 text-[11px] text-mv-text-secondary transition-all hover:border-mv-violet/40 hover:text-mv-violet"
      >
        View all
        <svg className="h-3 w-3 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

/* ─── Micro-interaction helpers (kept from the original app) ─── */
function Magnetic({ children, strength = 0.25 }: { children: React.ReactNode; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.transform = `translate(${(e.clientX - (rect.left + rect.width / 2)) * strength}px, ${(e.clientY - (rect.top + rect.height / 2)) * strength}px)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = 'translate(0, 0)';
  };
  return (
    <div ref={ref} className="magnetic" onMouseMove={onMove} onMouseLeave={onLeave}>
      {children}
    </div>
  );
}

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

function Tilt({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${px * 6}deg) rotateX(${-py * 6}deg)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg)';
  };
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={`tilt-card ${className}`}>
      {children}
    </div>
  );
}

function HeroTitle({ text }: { text: string }) {
  const words = text.split(' ');
  return (
    <h1 className="text-3xl font-bold leading-[1.08] tracking-tight text-white drop-shadow-lg md:text-5xl">
      {words.map((word, i) => (
        <span key={i} className="hero-word" style={{ animationDelay: `${220 + i * 60}ms` }}>
          {word}{' '}
        </span>
      ))}
    </h1>
  );
}

interface TitleLike {
  id: string;
  slug: string;
  title: string;
  type?: string;
  coverUrl?: string | null;
  rating?: number | null;
  status?: string | null;
  genres?: string[];
  totalChapters?: number;
  latestChapter?: { number: number; createdAt: string } | null;
}

/* ─── Cover card used across sections ────────────────────────── */
function TitleCard({ item, rank }: { item: TitleLike; rank?: number }) {
  return (
    <Link href={`/title/${item.slug}`} className="group w-[130px] shrink-0 sm:w-[140px]">
      <Spotlight className="rounded-xl">
        <div className="img-zoom card-lift relative aspect-[3/4] overflow-hidden rounded-xl bg-mv-surface">
          <CoverImage src={item.coverUrl} title={item.title} type={item.type} className="h-full w-full" />
          {typeof rank === 'number' && (
            <span className="absolute left-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-md bg-gradient-to-br from-mv-purple to-mv-accent px-1.5 text-[11px] font-bold text-white shadow-glow-sm">
              {rank}
            </span>
          )}
          {item.rating ? (
            <span className="glass absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-medium text-mv-gold">
              ★ {item.rating.toFixed(1)}
            </span>
          ) : null}
          {item.status && (
            <span className={`status-pill absolute bottom-1.5 left-1.5 ${statusColors(item.status).className}`}>
              {statusColors(item.status).label}
            </span>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </div>
      </Spotlight>
      <p className="mt-2 line-clamp-2 text-xs text-mv-text-secondary transition-colors group-hover:text-white">{item.title}</p>
      <p className="mt-0.5 flex items-center gap-1 text-[9px] text-mv-text-muted">
        {formatType(item.type)} · {item.totalChapters || '?'} ch
      </p>
      {item.latestChapter && (
        <p className="mt-0.5 flex items-center gap-1 text-[9px] font-medium text-mv-success/90">
          <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
          up to Ch. {item.latestChapter.number} · {formatTimeAgo(item.latestChapter.createdAt)}
        </p>
      )}
    </Link>
  );
}

export default function HomePage() {
  const { token } = useAuthStore();
  const { data: trending } = useTrendingTitles();
  const { data: latest } = useTitles({ sort: 'newest', limit: 12 });
  const { data: editorsPicks } = useTitles({ sort: 'rating', limit: 12 });
  const { data: recentlyUpdated, isLoading: updatesLoading } = useRecentlyUpdated();
  const { data: readingData } = useReadingProgress(!!token);
  const [heroIndex, setHeroIndex] = useState(0);

  const trendingList = trending?.slice(0, 10) || [];
  const heroTitles = trendingList.slice(0, 5);
  const picks = editorsPicks?.items?.slice(0, 8) || [];

  useEffect(() => {
    if (heroTitles.length < 2) return;
    const interval = setInterval(() => setHeroIndex((prev) => (prev + 1) % heroTitles.length), 6000);
    return () => clearInterval(interval);
  }, [heroTitles.length]);

  const continueReading = token && readingData ? (readingData as any[]).filter((e: any) => !e.completed).slice(0, 8) : [];

  return (
    <AppShell>
      {/* ─── Hero ──────────────────────────────────────────── */}
      <section className="relative h-[440px] overflow-hidden md:h-[520px]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#150b2e] via-[#1a0f38] to-[#0d0d12]" />
        <div className="animate-aurora absolute -left-24 top-0 h-96 w-96 rounded-full bg-mv-accent/30 blur-3xl" />
        <div className="animate-aurora absolute right-0 top-10 h-[28rem] w-[28rem] rounded-full bg-mv-purple/25 blur-3xl" style={{ animationDelay: '-7s' }} />
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-mv-dark via-transparent to-transparent" />

        {heroTitles.map((item, idx) => (
          <div
            key={item.slug}
            className={`absolute inset-0 transition-opacity duration-1000 ${idx === heroIndex ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          >
            {item.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.coverUrl}
                alt=""
                className={`mask-gradient-to-l absolute -right-10 top-0 h-full w-[60%] object-cover opacity-30 transition-transform duration-[2500ms] ease-out md:right-0 md:w-1/2 ${
                  idx === heroIndex ? 'scale-105' : 'scale-100'
                }`}
              />
            )}
            <div className="relative z-10 mx-auto flex h-full w-full max-w-7xl items-end px-5 pb-10 sm:px-6 md:px-8 md:pb-14">
              <div className="w-full max-w-2xl">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="animate-fade-up rounded-full bg-gradient-to-r from-mv-purple to-mv-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-glow-sm">
                    🔥 Trending #{idx + 1}
                  </span>
                  <span className="animate-fade-up glass rounded-full px-2.5 py-1 text-[10px] text-mv-text-secondary" style={{ animationDelay: '80ms' }}>
                    {formatTypeFull(item.type)}
                  </span>
                  <span className="animate-fade-up rounded-full border border-mv-border-light bg-black/30 px-2.5 py-1 text-[10px] text-mv-text-muted" style={{ animationDelay: '140ms' }}>
                    {item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : ''}
                  </span>
                </div>
                <div key={idx === heroIndex ? item.slug : 'static'}>
                  <HeroTitle text={item.title} />
                </div>
                <p className="animate-fade-up mt-3 text-xs text-mv-text-secondary md:text-sm" style={{ animationDelay: '200ms' }}>
                  {item.genres?.slice(0, 4).map((g) => g.charAt(0).toUpperCase() + g.slice(1)).join(' · ') || ''}
                </p>
                <div className="animate-fade-up mt-6 flex flex-wrap gap-3" style={{ animationDelay: '280ms' }}>
                  <Magnetic>
                    <Link href={`/title/${item.slug}`} className="btn-primary px-6 py-3 text-sm">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Read Now
                    </Link>
                  </Magnetic>
                  <Magnetic>
                    <Link href={`/title/${item.slug}`} className="btn-ghost px-6 py-3 text-sm">
                      Details
                    </Link>
                  </Magnetic>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Carousel controls */}
        {heroTitles.length > 1 && (
          <div className="absolute bottom-6 right-6 z-20 flex items-center gap-3 md:right-10">
            <button
              onClick={() => setHeroIndex((heroIndex - 1 + heroTitles.length) % heroTitles.length)}
              aria-label="Previous slide"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/30 text-mv-text-secondary backdrop-blur-sm transition-all hover:border-mv-violet/40 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex gap-2">
              {heroTitles.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setHeroIndex(idx)}
                  aria-label={`Slide ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === heroIndex ? 'w-7 bg-gradient-to-r from-mv-purple to-mv-accent' : 'w-2 bg-white/20 hover:bg-white/40'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => setHeroIndex((heroIndex + 1) % heroTitles.length)}
              aria-label="Next slide"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/30 text-mv-text-secondary backdrop-blur-sm transition-all hover:border-mv-violet/40 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        )}
      </section>

      {/* ─── Hot this week marquee ─────────────────────────── */}
      {trendingList.length > 0 && (
        <div className="relative overflow-hidden border-y border-mv-border/60 bg-mv-darker/60 py-2.5">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-mv-darker to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-mv-darker to-transparent" />
          <div className="marquee">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex shrink-0 items-center">
                {trendingList.map((item, idx) => (
                  <Link
                    key={`${dup}-${item.id}`}
                    href={`/title/${item.slug}`}
                    className="flex items-center gap-2 px-5 text-[11px] text-mv-text-secondary transition-colors hover:text-mv-violet"
                  >
                    <span className="text-[9px] font-bold text-mv-violet">#{idx + 1}</span>
                    <span className="max-w-[180px] truncate">{item.title}</span>
                    {item.latestChapter && (
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-mv-text-muted">Ch. {item.latestChapter.number}</span>
                    )}
                    <span className="text-mv-text-dim">·</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl space-y-14 px-5 py-10 sm:px-6 md:px-8">
        {/* ─── Continue Reading ─────────────────────────────── */}
        {continueReading.length > 0 && (
          <Reveal>
            <section>
              <SectionHeader title="Continue Reading" href="/library" sub="Pick up where you left off" />
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
                {continueReading.map((entry: any) => {
                  const total = entry.chapter.pageCount || 20;
                  const pct = entry.pageNumber ? Math.min(100, Math.round((entry.pageNumber / total) * 100)) : 0;
                  return (
                    <Link key={entry.id} href={`/reader/${entry.chapter.id}`} className="group w-[220px] shrink-0">
                      <div className="img-zoom card-lift relative h-[120px] overflow-hidden rounded-xl border border-mv-border bg-mv-surface">
                        {entry.chapter.series.coverUrl ? (
                          <CoverImage src={entry.chapter.series.coverUrl} title={entry.chapter.series.title} type={entry.chapter.series.type} className="absolute inset-0 h-full w-full opacity-45" />
                        ) : null}
                        <div className="absolute inset-0 bg-gradient-to-t from-mv-dark/95 via-mv-dark/20 to-transparent" />
                        <div className="absolute bottom-2.5 left-3 right-3">
                          <p className="truncate text-xs font-semibold text-white">{entry.chapter.series.title}</p>
                          <p className="text-[10px] text-mv-text-muted">
                            Ch. {entry.chapter.number} · {entry.pageNumber ? `${pct}%` : 'Continue'}
                          </p>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
                          <div className="h-full bg-gradient-to-r from-mv-purple to-mv-accent transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="absolute right-2 top-2 rounded-md bg-black/50 px-2 py-1 text-[9px] font-medium text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                          Continue →
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          </Reveal>
        )}

        {/* ─── Trending Now ──────────────────────────────────── */}
        <Reveal>
          <section>
            <SectionHeader title="Trending Now" href="/browse?sort=trending" sub="What everyone is reading this week" />
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {trendingList.map((item, idx) => (
                <TitleCard key={item.id} item={item as TitleLike} rank={idx + 1} />
              ))}
            </div>
          </section>
        </Reveal>

        {/* ─── Editor's Picks ─────────────────────────────────── */}
        {picks.length > 0 && (
          <Reveal>
            <section>
              <SectionHeader title="Editor's Picks" href="/browse?sort=rating" sub="Hand-picked, top-rated series" />
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-8">
                {picks.map((item) => (
                  <Link key={item.id} href={`/title/${item.slug}`} className="group">
                    <Tilt>
                      <div className="img-zoom relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-mv-surface">
                        <CoverImage src={item.coverUrl} title={item.title} type={item.type} className="h-full w-full" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          <p className="truncate text-[9px] font-medium text-white">{item.title}</p>
                        </div>
                      </div>
                    </Tilt>
                  </Link>
                ))}
              </div>
            </section>
          </Reveal>
        )}

        {/* ─── Recently Updated ─────────────────────────────── */}
        <Reveal>
          <section>
            <SectionHeader title="Recently Updated" href="/browse?sort=updated" sub="Fresh chapters, just dropped" />
            {updatesLoading ? (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="w-[150px] shrink-0">
                    <div className="skeleton aspect-[3/4] rounded-xl" />
                    <div className="skeleton mt-2 h-3 w-3/4 rounded" />
                    <div className="skeleton mt-1.5 h-2 w-1/2 rounded" />
                  </div>
                ))}
              </div>
            ) : recentlyUpdated && recentlyUpdated.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {recentlyUpdated.slice(0, 12).map((item) => (
                  <Link key={item.id} href={`/title/${item.slug}`} className="group">
                    <div className="img-zoom card-lift relative aspect-[3/4] overflow-hidden rounded-xl bg-mv-surface">
                      <CoverImage src={item.coverUrl} title={item.title} type={item.type} className="h-full w-full" />
                      {item.latestChapter && (
                        <span className="absolute right-1.5 top-1.5 rounded-md bg-gradient-to-r from-mv-purple to-mv-accent px-1.5 py-0.5 text-[9px] font-bold text-white shadow-glow-sm">
                          Ch. {item.latestChapter.number}
                        </span>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-mv-dark/85 via-transparent to-transparent" />
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-mv-text-secondary transition-colors group-hover:text-white">{item.title}</p>
                    {item.latestChapter && (
                      <p className="mt-0.5 flex items-center gap-1 text-[9px] font-medium text-mv-success/90">
                        <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                        {formatTimeAgo(item.latestChapter.createdAt)}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="card rounded-2xl p-10 text-center">
                <p className="text-sm text-mv-text-muted">No recent updates yet</p>
                <p className="mt-1 text-xs text-mv-text-dim">Check back soon for new chapters</p>
              </div>
            )}
          </section>
        </Reveal>

        {/* ─── Browse by Format ──────────────────────────────── */}
        <Reveal>
          <section>
            <SectionHeader title="Browse by Format" href="/browse" sub="Four ways to read" />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {CATEGORY_RAILS.map((cat) => (
                <Link
                  key={cat.key}
                  href={cat.href}
                  className="group relative overflow-hidden rounded-2xl border border-mv-border-light bg-mv-surface/50 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-mv-violet/40 hover:shadow-card-hover"
                >
                  <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${cat.accent} opacity-15 blur-2xl transition-opacity duration-300 group-hover:opacity-30`} />
                  <div className="text-2xl transition-transform duration-300 group-hover:scale-110">{cat.emoji}</div>
                  <p className="mt-3 text-sm font-bold text-white">{cat.label}</p>
                  <p className="mt-0.5 text-[10px] text-mv-text-muted">{cat.desc}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-medium text-mv-violet opacity-0 transition-opacity duration-300 group-hover:opacity-100">
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

        {/* ─── New Releases ───────────────────────────────────── */}
        <Reveal>
          <section>
            <SectionHeader title="New Releases" href="/browse?sort=newest" sub="Fresh on the shelf" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {latest?.items?.slice(0, 12).map((item) => (
                <Link key={item.id} href={`/title/${item.slug}`} className="group cursor-pointer">
                  <Tilt>
                    <div className="img-zoom card-lift relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-mv-surface">
                      <CoverImage src={item.coverUrl} title={item.title} type={item.type} className="h-full w-full" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      {item.rating && (
                        <span className="glass absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[9px] font-medium text-mv-gold">★ {item.rating.toFixed(1)}</span>
                      )}
                      {item.status && (
                        <span className={`status-pill absolute bottom-2 left-2 ${statusColors(item.status).className}`}>{statusColors(item.status).label}</span>
                      )}
                      {item.latestChapter && (
                        <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[8px] font-medium text-mv-text-secondary backdrop-blur-sm">
                          up to Ch. {item.latestChapter.number}
                        </span>
                      )}
                    </div>
                  </Tilt>
                  <p className="mt-2 line-clamp-2 text-xs text-mv-text-secondary transition-colors group-hover:text-white">{item.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[8px] font-medium uppercase text-mv-text-secondary">{formatType(item.type)}</span>
                    {item.latestChapter && (
                      <span className="flex items-center gap-0.5 text-[8px] text-mv-success/90">
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

        {/* ─── Browse by Genre ────────────────────────────────── */}
        <Reveal>
          <section>
            <SectionHeader title="Browse by Genre" href="/browse" sub="Find your next obsession" />
            <div className="flex flex-wrap gap-2">
              {Object.entries(GENRE_EMOJIS).map(([genre, emoji]) => (
                <Link
                  key={genre}
                  href={`/browse?genres=${genre}`}
                  className="group rounded-full border border-mv-border-light bg-mv-surface/60 px-4 py-2 text-xs text-mv-text-secondary transition-all duration-200 hover:-translate-y-0.5 hover:border-mv-violet/50 hover:bg-mv-accent/10 hover:text-mv-violet hover:shadow-glow-sm"
                >
                  <span className="mr-1.5 inline-block transition-transform group-hover:scale-110">{emoji}</span>
                  {genre.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </Link>
              ))}
            </div>
          </section>
        </Reveal>
      </div>

      {/* ─── App Download CTA ───────────────────────────────── */}
      <section className="px-5 py-16 sm:px-6 md:px-8">
        <div className="relative mx-auto max-w-4xl rounded-3xl bg-gradient-to-r from-mv-accent via-mv-purple to-mv-violet p-[1.5px] shadow-glow">
          <span className="animate-float absolute -left-4 -top-4 hidden text-2xl sm:block" style={{ '--float-rot': '-8deg' } as CSSProperties}>📖</span>
          <span className="animate-float absolute -bottom-4 -right-4 hidden text-2xl sm:block" style={{ '--float-rot': '10deg', animationDelay: '-3s' } as CSSProperties}>🔔</span>

          <div className="relative overflow-hidden rounded-[calc(1.5rem-1.5px)] bg-mv-darker/95 px-8 py-12 text-center backdrop-blur-xl md:p-14">
            <div className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-mv-accent/25 blur-3xl" />
            <div className="pointer-events-none absolute -right-20 bottom-0 h-56 w-56 rounded-full bg-mv-purple/20 blur-3xl" />

            <div className="relative mb-5 inline-flex items-center gap-2 rounded-full border border-mv-success/30 bg-mv-success/10 px-4 py-1.5">
              <span className="animate-pulse-dot h-2 w-2 rounded-full bg-mv-success" />
              <span className="text-[10px] font-medium text-mv-success">Android APK Available</span>
            </div>
            <h2 className="relative text-3xl font-bold tracking-tight text-white md:text-4xl">
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
                <Link href="/browse" className="btn-ghost px-7 py-3.5 text-sm">Browse Online Instead</Link>
              </Magnetic>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-mv-border/60 bg-mv-darker/50 py-12 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-6 h-px w-full bg-gradient-to-r from-transparent via-mv-accent/40 to-transparent" />
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <div className="text-center sm:text-left">
              <p className="text-sm font-bold">
                <span className="bg-gradient-to-r from-mv-violet to-mv-purple bg-clip-text text-transparent">Manga</span>
                <span className="text-white">Verse</span>
                <span className="ml-2 text-[10px] font-normal text-mv-text-muted">© {new Date().getFullYear()}</span>
              </p>
              <p className="mt-1 text-[10px] text-mv-text-dim">Read manga, manhwa, manhua & light novels online or on the go.</p>
            </div>
            <div className="flex items-center gap-5">
              <Link href="/download" className="flex items-center gap-1.5 rounded-lg border border-mv-violet/25 bg-mv-violet/10 px-3 py-1.5 text-[10px] text-mv-violet transition-all hover:border-mv-violet/50 hover:bg-mv-violet/20">
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
    </AppShell>
  );
}

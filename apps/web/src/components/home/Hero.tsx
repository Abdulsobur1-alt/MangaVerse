'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CoverImage } from '@/components/CoverImage';
import { BookmarkButton } from './BookmarkButton';
import { Magnetic } from './primitives';
import { useTitle } from '@/lib/hooks/useTitles';
import { formatTypeFull, statusColors } from '@/lib/format';
import type { HomeTitle, ResumeInfo } from './types';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Hero — the editorial showcase.
   • Rotating featured titles with ken-burns artwork + aurora wash
   • Genre tags, rating, status, editorial synopsis (live-fetched)
   • Progress-aware CTA: Continue → reader, else Read Now → details
   • Save CTA, manual prev/next + progress dots, autoplay
   • Keyboard: ←/→ navigate, region role + live label · touch swipe
   • Autoplay pauses on hover / focus / reduced motion
   ═══════════════════════════════════════════════════════════════ */

const AUTOPLAY_MS = 8000;

export function Hero({
  titles,
  resume,
}: {
  titles: HomeTitle[];
  /** Resume map keyed by series id (for progress-aware CTAs). */
  resume: Map<string, ResumeInfo>;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touchX, setTouchX] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const count = titles.length;
  const active = titles[index];
  const activeResume = active ? resume.get(active.id) : undefined;

  // Editorial detail for the active slide: synopsis, author, banner artwork.
  const { data: detail } = useTitle(active?.slug ?? '', undefined, undefined);

  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + count) % count);

  // Autoplay — paused on hover/focus and under reduced motion.
  useEffect(() => {
    if (count < 2 || paused || reducedMotion) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [count, paused, reducedMotion, index]);

  // Keyboard navigation when the region has focus.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
  };

  // Touch swipe.
  const onTouchStart = (e: React.TouchEvent) => setTouchX(e.touches[0]?.clientX ?? null);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchX) - touchX;
    if (Math.abs(dx) > 48) go(dx > 0 ? -1 : 1);
    setTouchX(null);
  };

  if (count === 0) return null;

  const synopsis = detail?.synopsis;
  const heroBg = detail?.bannerUrl ?? active.coverUrl;
  const status = statusColors(active.status);

  return (
    <section
      ref={sectionRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured titles"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        // Resume autoplay only when focus leaves the whole carousel
        // (focus-within semantics — moving between internal controls
        // keeps it paused).
        if (!sectionRef.current?.contains(e.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
      className="group relative h-[440px] overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-mv-violet/60 sm:h-[500px] md:h-[560px]"
    >
      {/* ── Background layers ── */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#150b2e] via-[#1a0f38] to-[#0d0d12]" />
      <div className="animate-aurora absolute -left-24 top-0 h-96 w-96 rounded-full bg-mv-accent/30 blur-3xl" />
      <div className="animate-aurora absolute right-0 top-10 h-[28rem] w-[28rem] rounded-full bg-mv-purple/25 blur-3xl" style={{ animationDelay: '-7s' }} />
      <div className="absolute inset-0 bg-grid opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-t from-mv-dark via-transparent to-transparent" />

      {/* Artwork — ken-burns on the active slide */}
      <div key={`art-${active.slug}`} className="absolute inset-0" aria-hidden="true">
        {heroBg ? (
          <div className="absolute -right-16 top-0 h-full w-[70%] md:w-[55%]">
            <div className="ken-burns h-full w-full">
              <CoverImage src={heroBg} title={active.title} type={active.type} className="h-full w-full" />
            </div>
            <div className="mask-gradient-to-l absolute inset-0" />
          </div>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-mv-dark/95 via-mv-dark/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-mv-dark via-transparent to-mv-dark/20" />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 mx-auto flex h-full w-full max-w-7xl items-end px-5 pb-14 sm:px-6 md:px-8 md:pb-16">
        <div key={active.slug} className="w-full max-w-2xl">
          {/* Eyebrow row */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="animate-fade-up rounded-full bg-gradient-to-r from-mv-purple to-mv-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-glow-sm">
              🔥 Trending #{index + 1}
            </span>
            <span className="animate-fade-up glass rounded-full px-2.5 py-1 text-[10px] text-mv-text-secondary" style={{ animationDelay: '60ms' }}>
              {formatTypeFull(active.type)}
            </span>
            <span className={cn('animate-fade-up status-pill', status.className)} style={{ animationDelay: '100ms' }}>
              {status.label}
            </span>
            {active.rating != null && (
              <span className="animate-fade-up flex items-center gap-1 rounded-full border border-mv-gold/25 bg-mv-gold/10 px-2.5 py-1 text-[10px] font-medium text-mv-gold" style={{ animationDelay: '140ms' }}>
                ★ {active.rating.toFixed(1)}
              </span>
            )}
          </div>

          {/* Title — word stagger (30–34px mobile → 48px desktop) */}
          <h1 className="text-[1.875rem] font-bold leading-[1.12] tracking-tight text-white drop-shadow-lg sm:text-4xl md:text-6xl md:leading-[1.06]">
            {active.title.split(' ').map((word, i) => (
              <span key={i} className="hero-word inline-block" style={{ animationDelay: `${180 + i * 55}ms` }}>
                {word}{' '}
              </span>
            ))}
          </h1>

          {/* Editorial description */}
          <div className="mt-4 min-h-[2.5rem]">
            {synopsis ? (
              <p className="animate-fade-up line-clamp-2 max-w-xl text-sm leading-relaxed text-mv-text-secondary md:text-[15px]" style={{ animationDelay: '420ms' }}>
                {synopsis}
              </p>
            ) : (
              <p className="animate-fade-up flex flex-wrap items-center gap-1.5 text-xs text-mv-text-muted" style={{ animationDelay: '420ms' }}>
                {active.genres?.slice(0, 5).map((g) => (
                  <Link
                    key={g}
                    href={`/browse?genres=${g}`}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-mv-text-secondary transition-colors hover:border-mv-violet/50 hover:text-mv-violet"
                  >
                    {g.replace(/_/g, ' ')}
                  </Link>
                ))}
              </p>
            )}
          </div>

          {/* Genre tags (always available as quick filters) */}
          {synopsis && active.genres && active.genres.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {active.genres.slice(0, 4).map((g) => (
                <Link
                  key={g}
                  href={`/browse?genres=${g}`}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-mv-text-secondary transition-colors hover:border-mv-violet/50 hover:text-mv-violet"
                >
                  {g.replace(/_/g, ' ')}
                </Link>
              ))}
            </div>
          )}

          {/* Reading progress (if applicable) */}
          {activeResume && (
            <div className="animate-fade-up mt-4 max-w-md" style={{ animationDelay: '480ms' }}>
              <div className="flex items-center justify-between text-[10px] text-mv-text-muted">
                <span>
                  {activeResume.completed ? 'Completed' : `Chapter ${activeResume.chapterNumber}`} · {activeResume.pct}%
                </span>
                {!activeResume.completed && (
                  <span className="flex items-center gap-1 text-mv-violet">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
                    {activeResume.completed ? '' : `resume Ch. ${activeResume.chapterNumber}`}
                  </span>
                )}
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', activeResume.completed ? 'bg-mv-success' : 'bg-gradient-to-r from-mv-purple to-mv-accent')}
                  style={{ width: `${activeResume.pct}%` }}
                />
              </div>
            </div>
          )}

          {/* CTAs */}
          <div className="animate-fade-up mt-6 flex flex-wrap items-center gap-3" style={{ animationDelay: '540ms' }}>
            <Magnetic>
              <Link
                href={activeResume && !activeResume.completed ? `/reader/${activeResume.chapterId}` : `/title/${active.slug}`}
                className="btn-primary px-6 py-3 text-sm"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  {activeResume && !activeResume.completed ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  )}
                </svg>
                {activeResume && !activeResume.completed ? `Continue · Ch. ${activeResume.chapterNumber}` : 'Read Now'}
              </Link>
            </Magnetic>
            <Magnetic>
              <BookmarkButton titleId={active.id} title={active.title} variant="pill" />
            </Magnetic>
            <Magnetic>
              <Link href={`/title/${active.slug}`} className="btn-ghost px-6 py-3 text-sm">
                Details
              </Link>
            </Magnetic>
          </div>
        </div>
      </div>

      {/* ── Controls: prev / dots / next ── */}
      {count > 1 && (
        <div className="absolute bottom-6 right-6 z-20 flex items-center gap-3 md:right-10">
          <button
            onClick={() => go(-1)}
            aria-label="Previous slide"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/30 text-mv-text-secondary backdrop-blur-sm transition-all hover:border-mv-violet/40 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Slides">
            {titles.map((t, idx) => (
              <button
                key={t.id}
                onClick={() => setIndex(idx)}
                role="tab"
                aria-selected={idx === index}
                aria-label={`Slide ${idx + 1}: ${t.title}`}
                className={cn(
                  'relative h-1.5 overflow-hidden rounded-full transition-all duration-300',
                  idx === index ? 'w-9 bg-white/25' : 'w-2.5 bg-white/15 hover:bg-white/40',
                )}
              >
                {idx === index && !paused && !reducedMotion && (
                  <span key={`p-${index}-${paused}`} className="hero-autoplay absolute inset-0 rounded-full bg-gradient-to-r from-mv-purple to-mv-accent" />
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => go(1)}
            aria-label="Next slide"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/30 text-mv-text-secondary backdrop-blur-sm transition-all hover:border-mv-violet/40 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      )}

      {/* Slide counter */}
      <div className="absolute bottom-7 left-5 z-20 text-[10px] font-medium tracking-widest text-mv-text-muted sm:left-6 md:left-8" aria-live="polite">
        {String(index + 1).padStart(2, '0')} <span className="mx-1 text-mv-text-dim">/</span> {String(count).padStart(2, '0')}
      </div>
    </section>
  );
}

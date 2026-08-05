'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { CoverImage } from '@/components/CoverImage';
import { Icon } from '@/components/ui/Icon';
import { useAdaptiveColors } from './useAdaptiveColors';
import { ReadingCta, type ReadingState } from './ReadingCta';
import { CollectionMenu } from './CollectionMenu';
import { formatTypeFull, formatTimeAgo, statusColors } from '@/lib/format';
import type { TitleDetail } from '@/lib/hooks/useTitles';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   TitleHero — cinematic above-the-fold.
   Backdrop colours are extracted live from the cover art, so every
   title gets its own identity. Glass chips carry the metadata the
   old "hero" crammed into the sidebar — rating, views, bookmarks,
   chapters, last updated, ETA. The CTA row is state-aware.
   ═══════════════════════════════════════════════════════════════ */

interface TitleHeroProps {
  title: TitleDetail;
  reading: ReadingState;
  chaptersTotal: number;
  estMinutes: number | null;
  views: number;
  onShare: () => void;
}

export function TitleHero({ title, reading, chaptersTotal, estMinutes, views, onShare }: TitleHeroProps) {
  const palette = useAdaptiveColors(title.coverUrl, title.bannerUrl);
  const status = statusColors(title.status);
  const hasResume = !!reading.resumeChapterId && reading.progressPct > 0 && reading.progressPct < 100;

  const stats = useMemo(
    () => [
      { icon: 'star' as const, label: 'Rating', value: title.rating ? title.rating.toFixed(1) : '—', accent: 'text-mv-gold' },
      { icon: 'eye' as const, label: 'Views', value: views.toLocaleString(), accent: 'text-mv-text' },
      { icon: 'bookmark' as const, label: 'Saved', value: (title._count?.bookmarks ?? 0).toLocaleString(), accent: 'text-mv-text' },
      { icon: 'book' as const, label: 'Chapters', value: chaptersTotal.toLocaleString(), accent: 'text-mv-text' },
    ],
    [title, views, chaptersTotal],
  );

  return (
    <section className="relative overflow-hidden" aria-label={`${title.title} overview`}>
      {/* ── Adaptive backdrop ── */}
      <div className="absolute inset-0 transition-colors duration-1000" style={{ background: `radial-gradient(1200px 620px at 78% -10%, ${palette.accent}33, transparent 62%), radial-gradient(900px 500px at 12% 110%, ${palette.soft}22, transparent 60%), linear-gradient(160deg, ${palette.base}, #0d0d12 78%)` }} />
      {title.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={title.bannerUrl ?? title.coverUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-3xl" />
      )}
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-t from-mv-dark via-transparent to-mv-dark/30" />

      {/* Cover shine sweep */}
      <div className="pointer-events-none absolute -inset-x-40 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" aria-hidden="true" />

      <div className="relative mx-auto max-w-6xl px-5 pb-10 pt-8 sm:px-6 md:px-8 md:pb-14 md:pt-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start">
          {/* ── Cover ── */}
          <div className="mx-auto w-48 shrink-0 md:mx-0 md:w-[250px]">
            <div className="group/cover relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 shadow-modal transition-transform duration-500 [transform:perspective(1100px)_rotateY(-3deg)] hover:[transform:perspective(1100px)_rotateY(0deg)]">
              <CoverImage src={title.coverUrl} title={title.title} type={title.type} emojiFallback className="h-full w-full transition-transform duration-700 group-hover/cover:scale-105" />
              {/* Shine sweep */}
              <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover/cover:translate-x-full" aria-hidden="true" />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
              {hasResume && (
                <span className="absolute bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-3 py-1 text-[9px] font-semibold text-white backdrop-blur-sm">
                  {reading.progressPct}% read
                </span>
              )}
            </div>
          </div>

          {/* ── Meta ── */}
          <div className="min-w-0 flex-1 text-center md:text-left">
            {/* Eyebrow chips */}
            <div className="mb-3 flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <span className="rounded-full bg-gradient-to-r from-mv-purple to-mv-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-glow-sm">
                {formatTypeFull(title.type)}
              </span>
              <span className={cn('status-pill', status.className)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', title.status === 'ongoing' ? 'animate-pulse-dot bg-mv-success' : 'bg-current')} />
                {status.label}
              </span>
              {title.releaseYear && (
                <span className="rounded-full border border-mv-border-light bg-black/30 px-2.5 py-1 text-[10px] text-mv-text-secondary">{title.releaseYear}</span>
              )}
              {title.updatedAt && (
                <span className="flex items-center gap-1.5 rounded-full border border-mv-border-light bg-black/30 px-2.5 py-1 text-[10px] text-mv-text-secondary">
                  <Icon name="zap" size={10} className="text-mv-violet" />
                  Updated {formatTimeAgo(title.updatedAt)}
                </span>
              )}
            </div>

            {/* Title + alt */}
            <h1 className="text-3xl font-bold leading-[1.08] tracking-tight text-white drop-shadow-lg md:text-5xl">{title.title}</h1>
            {title.alternativeTitles && (
              <p className="mt-2 text-xs italic text-mv-text-muted" aria-label="Alternative titles">{title.alternativeTitles}</p>
            )}

            {/* Credits */}
            {(title.author || title.artist) && (
              <p className="mt-3 text-[11px] text-mv-text-secondary">
                {title.author && <span>By <span className="font-medium text-mv-text">{title.author}</span></span>}
                {title.artist && title.artist !== title.author && <span className="ml-2">Art by <span className="font-medium text-mv-text">{title.artist}</span></span>}
              </p>
            )}

            {/* Stats glass row */}
            <div className="mt-4 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="glass flex items-center gap-2 rounded-xl px-3 py-2">
                  <Icon name={s.icon} size={14} className={s.accent} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-white">{s.value}</p>
                    <p className="text-[8px] uppercase tracking-wider text-mv-text-muted">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ETA chip */}
            <p className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[10px] text-mv-text-muted md:justify-start">
              <span className="flex items-center gap-1"><Icon name="clock" size={11} className="text-mv-violet" /> {estMinutes ? `≈ ${estMinutes} min to finish` : 'Length unknown'}</span>
              <span aria-hidden="true">·</span>
              <span>Reading direction: {title.type === 'manga' ? 'Right to left' : 'Top to bottom'}</span>
            </p>

            {/* Genres + tags */}
            {title.genres && title.genres.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-1.5 md:justify-start">
                {title.genres.map((genre) => (
                  <Link
                    key={genre}
                    href={`/browse?genres=${genre}`}
                    className="rounded-full border border-mv-border-light bg-black/30 px-3 py-1 text-[10px] text-mv-text-secondary transition-colors hover:border-mv-violet/50 hover:text-mv-violet"
                  >
                    {genre.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Link>
                ))}
              </div>
            )}

            {/* ── CTA row ── */}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3 md:justify-start">
              <ReadingCta state={reading} />
              <CollectionMenu titleId={title.id} title={title.title} />
              <button
                onClick={onShare}
                aria-label="Share this title"
                className="btn-ghost flex items-center gap-2 px-5 py-2.5 text-xs"
              >
                <Icon name="link" size={14} />
                Share
              </button>
              <Link href="/download" className="btn-ghost flex items-center gap-2 px-5 py-2.5 text-xs" aria-label="Read offline with the app">
                <Icon name="download" size={14} />
                Read Offline
              </Link>
            </div>

            {/* ── Reading progress bar ── */}
            {reading.progressPct > 0 && (
              <div className="mx-auto mt-6 max-w-md md:mx-0 md:max-w-sm">
                <div className="mb-1.5 flex items-center justify-between text-[10px]">
                  <span className="text-mv-text-muted">
                    {reading.resumeChapterNumber ? `Through Ch. ${reading.resumeChapterNumber}` : 'In progress'}
                  </span>
                  <span className="font-semibold text-mv-violet">{Math.round(reading.progressPct)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', reading.progressPct >= 100 ? 'bg-mv-success' : 'bg-gradient-to-r from-mv-purple to-mv-accent')}
                    style={{ width: `${reading.progressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import type { WrappedData } from '@/lib/hooks/useIdentity';

/* ═══════════════════════════════════════════════════════════════
   WrappedCard — the annual MangaVerse Wrapped (Phase 9).
   A story-first, shareable snapshot: opener, big numbers, reading
   mood, top series, achievements, growth, community — plus a copy-
   to-clipboard share line.
   ═══════════════════════════════════════════════════════════════ */

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-center backdrop-blur-sm">
      <p className={cn('text-xl font-bold tracking-tight md:text-2xl', accent || 'text-white')}>{value}</p>
      <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-white/60">{label}</p>
    </div>
  );
}

export function WrappedCard({ data, username, className }: { data: WrappedData; username?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const shareText = `My ${data.year} @ MangaVerse: ${data.chaptersRead} chapters, ${data.hoursRead} hours, ${data.totalSeries} series, mood: ${data.mood.emoji} ${data.mood.label}!`;

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <article className={cn('overflow-hidden rounded-3xl border border-mv-border bg-mv-darker shadow-modal', className)}>
      {/* ─── Header band ─────────────────────────── */}
      <div className="relative bg-gradient-to-br from-mv-purple via-mv-accent to-mv-orange p-7 md:p-9">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 left-1/4 h-48 w-48 rounded-full bg-black/20 blur-3xl" aria-hidden="true" />
        <p className="relative text-[10px] font-semibold uppercase tracking-[0.25em] text-white/80">MangaVerse Wrapped</p>
        <h1 className="relative mt-1 text-3xl font-black tracking-tight text-white md:text-5xl">{data.year}</h1>
        <p className="relative mt-3 max-w-xl text-xs leading-relaxed text-white/90 md:text-sm">{data.opener}</p>
        <div className="relative mt-6 grid grid-cols-3 gap-2.5 md:max-w-lg">
          <Stat label="Chapters" value={data.chaptersRead.toLocaleString()} />
          <Stat label="Hours" value={data.hoursRead} accent="text-mv-orange" />
          <Stat label="Pages" value={data.pagesRead.toLocaleString()} />
        </div>
        {data.growth && (
          <p className="relative mt-3 flex items-center gap-1.5 text-[11px] font-medium text-white/90">
            <Icon name="trendingUp" size={12} className={data.growth.pct >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
            {data.growth.pct >= 0 ? '+' : ''}{data.growth.pct}% vs {data.year - 1} ({data.growth.chaptersThisYear} vs {data.growth.chaptersLastYear} chapters)
          </p>
        )}
      </div>

      <div className="space-y-7 p-7 md:p-9">
        {/* ─── Mood + favorites ───────────────────── */}
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-mv-border bg-mv-surface/40 p-5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-mv-text-dim">Reading mood</p>
            <p className="mt-2 flex items-center gap-2 text-lg font-bold text-white"><span aria-hidden="true">{data.mood.emoji}</span> {data.mood.label}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-mv-text-muted">{data.mood.description}</p>
          </div>
          <div className="rounded-2xl border border-mv-border bg-mv-surface/40 p-5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-mv-text-dim">Year highlights</p>
            <ul className="mt-2 space-y-1.5 text-[11px] text-mv-text-secondary">
              <li className="flex items-center justify-between"><span>Longest streak</span><span className="font-semibold text-mv-orange">🔥 {data.longestStreak} days</span></li>
              <li className="flex items-center justify-between"><span>Active days</span><span className="font-semibold text-white">{data.daysActive}</span></li>
              <li className="flex items-center justify-between"><span>Genres explored</span><span className="font-semibold text-white">{data.genresTried}</span></li>
              <li className="flex items-center justify-between"><span>Average rating given</span><span className="font-semibold text-mv-gold">{data.averageRatingGiven ?? '—'}/10</span></li>
              <li className="flex items-center justify-between"><span>Favorite genre</span><span className="font-semibold text-mv-violet">{data.favoriteGenre ? data.favoriteGenre.genre.replace(/_/g, ' ') : '—'}</span></li>
            </ul>
          </div>
        </div>

        {/* ─── Top series ─────────────────────────── */}
        {data.topSeries.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">Most-read series</h2>
            <div className="scrollbar-none -mx-1 flex gap-3 overflow-x-auto px-1">
              {data.topSeries.map((s, i) => (
                <Link key={s.slug} href={`/title/${s.slug}`} className="group w-24 shrink-0">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-mv-surface transition-transform duration-300 group-hover:scale-[1.04]">
                    {s.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.coverUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-2xl text-mv-text-dim">📕</span>
                    )}
                    <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[9px] font-bold text-white">{i + 1}</span>
                  </div>
                  <p className="mt-1.5 truncate text-[10px] font-medium text-mv-text-secondary transition-colors group-hover:text-white">{s.title}</p>
                  <p className="text-[8px] text-mv-text-dim">{s.chapters} chapters</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ─── Achievements + community ───────────── */}
        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border border-mv-border bg-mv-surface/40 p-5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-mv-text-dim">Badges earned in {data.year}</p>
            {data.achievements.length === 0 ? (
              <p className="mt-3 text-[11px] text-mv-text-muted">No new badges this year — next year's cabinet is waiting.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.achievements.slice(0, 10).map((a) => (
                  <span key={a.badgeId} title={a.name} className="flex items-center gap-1.5 rounded-full border border-mv-gold/25 bg-mv-gold/10 px-2.5 py-1 text-[10px] font-medium text-mv-gold">
                    <span aria-hidden="true">{a.emoji}</span> {a.name}
                  </span>
                ))}
              </div>
            )}
          </section>
          <section className="rounded-2xl border border-mv-border bg-mv-surface/40 p-5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-mv-text-dim">Community in {data.year}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-mv-text-secondary">
              <span>📝 {data.community.reviews} reviews</span>
              <span>📣 {data.community.posts} posts</span>
              <span>💬 {data.community.comments} replies</span>
              <span>👥 {data.community.followersGained} new followers</span>
            </div>
          </section>
        </div>

        {/* ─── Closer + share ─────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-mv-border pt-5">
          <p className="text-xs italic text-mv-text-muted">{data.closer}</p>
          <button
            onClick={copyShare}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-mv-purple to-mv-accent px-4 py-2 text-[10px] font-semibold text-white transition-all hover:brightness-110"
          >
            <Icon name={copied ? 'check' : 'link'} size={12} /> {copied ? 'Copied!' : 'Copy share line'}
          </button>
        </div>
      </div>
    </article>
  );
}

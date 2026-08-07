'use client';

import Link from 'next/link';
import { CoverImage } from '@/components/CoverImage';
import { SectionHeader } from './primitives';
import { estimateMinutesLeft, formatMinutes, type ResumeInfo } from './types';
import { formatTimeAgo, formatType } from '@/lib/format';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   ContinueRail — the premium resume experience.
   Wide landscape cards: blurred cover backdrop + editorial copy,
   current chapter, progress bar, last-read date, estimated time
   left, and a one-click resume button into the reader.
   ═══════════════════════════════════════════════════════════════ */

export function ContinueRail({
  entries,
  headline = 'Continue Reading',
  href = '/library',
  sub = 'Pick up where you left off',
  showStreak,
}: {
  entries: ResumeInfo[];
  headline?: string;
  href?: string;
  sub?: string;
  /** Show a 🔥 streak chip in the header. */
  showStreak?: number;
}) {
  if (entries.length === 0) return null;

  return (
    <section aria-label={headline}>
      <SectionHeader
        title={headline}
        href={href}
        sub={sub}
        icon={
          typeof showStreak === 'number' && showStreak > 1 ? (
            <span className="flex items-center gap-1 rounded-full border border-mv-warning/30 bg-mv-warning/10 px-2 py-0.5 text-[10px] font-semibold text-mv-warning">
              🔥 {showStreak}-day streak
            </span>
          ) : undefined
        }
      />
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none sm:gap-4" role="list">
        {entries.map((entry) => {
          const minutes = estimateMinutesLeft(entry);
          const completed = entry.completed || entry.pct >= 100;
          return (
            <div
              key={entry.seriesId}
              role="listitem"
              className="group relative w-[272px] shrink-0 overflow-hidden rounded-2xl border border-mv-border bg-mv-darker transition-all duration-300 hover:-translate-y-1 hover:border-mv-violet/40 hover:shadow-card-hover sm:w-[300px]"
            >
              {/* Backdrop artwork */}
              <div className="absolute inset-0" aria-hidden="true">
                <CoverImage src={entry.coverUrl} title={entry.title} type={entry.type} className="h-full w-full opacity-30 blur-[1px]" />
                <div className="absolute inset-0 bg-gradient-to-r from-mv-darker/95 via-mv-darker/80 to-mv-darker/40" />
              </div>

              <div className="relative flex gap-3 p-3.5">
                {/* Cover */}
                <Link href={`/title/${entry.slug}`} className="block h-24 w-[62px] shrink-0 overflow-hidden rounded-lg border border-white/10 shadow-lg transition-transform duration-300 group-hover:scale-[1.03]">
                  <CoverImage src={entry.coverUrl} title={entry.title} type={entry.type} className="h-full w-full" />
                </Link>

                {/* Copy */}
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link href={`/title/${entry.slug}`} className="line-clamp-1 text-xs font-semibold text-white transition-colors group-hover:text-mv-violet">
                    {entry.title}
                  </Link>
                  <p className="mt-0.5 text-[9px] text-mv-text-muted">
                    Ch. {entry.chapterNumber} · {completed ? 'Finished' : `${entry.pct}%`}
                    {entry.lastReadAt ? ` · ${formatTimeAgo(entry.lastReadAt)}` : ''}
                  </p>

                  {/* Progress bar */}
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', completed ? 'bg-mv-success' : 'bg-gradient-to-r from-mv-purple to-mv-accent')}
                      style={{ width: `${entry.pct}%` }}
                    />
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
                    <span className="text-[9px] text-mv-text-dim">
                      {completed ? 'Read again' : minutes != null ? formatMinutes(minutes) + ' left' : 'Ready'}
                    </span>
                    <Link
                      href={`/reader/${entry.chapterId}`}
                      className="flex items-center gap-1 rounded-full bg-gradient-to-r from-mv-accent to-mv-purple px-3 py-1.5 text-[10px] font-semibold text-white shadow-md shadow-mv-accent/25 transition-all hover:brightness-110"
                    >
                      <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72c0 .8.87 1.3 1.56.9l11-6.86a1.05 1.05 0 000-1.8l-11-6.86A1.05 1.05 0 008 5.14z" /></svg>
                      {completed ? 'Re-read' : 'Resume'}
                    </Link>
                  </div>
                </div>
              </div>

              {/* Format chip */}
              {entry.type && (
                <span className="absolute right-2.5 top-2.5 rounded-md bg-black/45 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wide text-mv-text-muted backdrop-blur-sm">
                  {formatType(entry.type)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Skeleton while reading progress loads. */
export function ContinueRailSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="w-[272px] shrink-0 rounded-2xl border border-mv-border bg-mv-darker p-3.5 sm:w-[300px]">
          <div className="flex gap-3">
            <div className="skeleton h-24 w-[62px] rounded-lg" />
            <div className="flex-1 space-y-2 py-1">
              <div className="skeleton h-3 w-3/4 rounded" />
              <div className="skeleton h-2 w-1/2 rounded" />
              <div className="skeleton mt-4 h-1 w-full rounded-full" />
              <div className="skeleton mt-3 h-5 w-20 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

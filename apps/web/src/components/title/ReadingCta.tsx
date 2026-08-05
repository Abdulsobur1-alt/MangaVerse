'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   ReadingCta — the highest-converting element, made intelligent.
   Given the user's reading state for THIS title, it picks the one
   correct primary action:
     • nothing read        → Start Reading (first chapter)
     • in progress         → Continue · Ch. X (with progress ring)
     • everything done     → Re-read / Read Latest
   Secondary “Read Latest” appears when there's a newer chapter.
   ═══════════════════════════════════════════════════════════════ */

export interface ReadingState {
  /** Chapter to resume (in progress). */
  resumeChapterId?: string;
  resumeChapterNumber?: number;
  /** 0–100 across the title. */
  progressPct: number;
  firstChapterId?: string;
  latestChapterId?: string;
  hasChapters: boolean;
}

export function ReadingCta({ state }: { state: ReadingState }) {
  const { resumeChapterId, resumeChapterNumber, progressPct, firstChapterId, latestChapterId, hasChapters } = state;

  if (!hasChapters) {
    return (
      <button disabled className="btn-primary pointer-events-none px-7 py-3 text-sm opacity-60">
        <Icon name="book" size={16} />
        No chapters yet
      </button>
    );
  }

  const inProgress = !!resumeChapterId && progressPct > 0 && progressPct < 100;
  const primaryHref = inProgress ? `/reader/${resumeChapterId}` : `/reader/${firstChapterId}`;
  const primaryLabel = inProgress
    ? `Continue · Ch. ${resumeChapterNumber}`
    : progressPct >= 100
      ? 'Re-read'
      : 'Start Reading';

  const showLatest = latestChapterId && latestChapterId !== (inProgress ? resumeChapterId : firstChapterId);

  // Progress ring (SVG stroke-dasharray on a circle)
  const R = 15.5;
  const C = 2 * Math.PI * R;
  const ring = C - (Math.min(100, Math.max(0, progressPct)) / 100) * C;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Primary */}
      <Link href={primaryHref} className="btn-primary group/cta px-7 py-3 text-sm">
        <Icon name="play" size={16} strokeWidth={2.2} className="transition-transform group-hover/cta:scale-110" />
        {primaryLabel}
      </Link>

      {/* Progress ring chip (when reading) */}
      {inProgress && (
        <div
          className="relative flex h-11 w-11 items-center justify-center"
          role="img"
          aria-label={`${progressPct}% read`}
          title={`${progressPct}% read`}
        >
          <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90">
            <circle cx="20" cy="20" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
            <circle
              cx="20" cy="20" r={R} fill="none"
              stroke="url(#cta-grad)" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={ring}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
            <defs>
              <linearGradient id="cta-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
          </svg>
          <span className="absolute text-[9px] font-bold text-white">{Math.round(progressPct)}%</span>
        </div>
      )}

      {/* Read latest */}
      {showLatest && (
        <Link href={`/reader/${latestChapterId}`} className="btn-ghost px-5 py-3 text-xs">
          <Icon name="zap" size={13} className="text-mv-violet" />
          Read Latest
        </Link>
      )}

      {/* Locked hint (any chapter coin-locked) */}
      {progressPct === 0 && !inProgress && (
        <span className={cn('text-[10px] text-mv-text-dim')}>
          <Icon name="lock" size={11} className="mr-1 inline text-mv-warning" />
          Some chapters are coin-locked
        </span>
      )}
    </div>
  );
}

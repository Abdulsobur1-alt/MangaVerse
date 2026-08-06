'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import type { AchievementsData } from '@/lib/hooks/useAchievements';

/* ═══════════════════════════════════════════════════════════════
   AchievementsGrid — the badge cabinet (Phase 9 redesign).
   • Category chips with live counts
   • Earned badges: premium cards with a staggered unlock animation
   • Locked badges: dimmed with a progress ring toward the threshold
   • Hidden badges (community surprises) show as "???" until earned
   ═══════════════════════════════════════════════════════════════ */

/** Badges that stay secret until earned — the community surprises. */
const HIDDEN_BADGE_IDS = new Set(['first_win', 'sharpshooter_5', 'wiki_editor', 'wiki_scribe_5', 'club_member_1', 'club_hopper_5']);

const CATEGORY_ORDER = ['reading', 'streak', 'exploration', 'social', 'library', 'coins', 'community'];

function formatEarned(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  return d.toLocaleDateString('en-US', d.getFullYear() === now.getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}

/** SVG progress ring (accessible: role="img" + text label). */
function ProgressRing({ pct, size = 44 }: { pct: number; size?: number }) {
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${pct}% progress`}
      className="-rotate-90"
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (pct / 100) * c}
        className="transition-all duration-700"
      />
    </svg>
  );
}

export function AchievementsGrid({ achievements, className, limit }: { achievements: AchievementsData; className?: string; limit?: number }) {
  const [category, setCategory] = useState<string>('');

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of achievements.items) {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }
    return [
      { key: '', label: 'All', count: achievements.total },
      ...CATEGORY_ORDER.filter((k) => counts.has(k)).map((k) => ({ key: k, label: achievements.categories.find((c) => c.key === k)?.label ?? k, count: counts.get(k) ?? 0 })),
    ];
  }, [achievements]);

  const filtered = achievements.items.filter((i) => !category || i.category === category);
  const shown = limit ? filtered.slice(0, limit) : filtered;
  const earnedCount = achievements.items.filter((i) => i.earned).length;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Progress summary */}
      <div className="flex items-center gap-3 rounded-2xl border border-mv-border bg-mv-darker px-5 py-4">
        <span className="text-2xl" aria-hidden="true">🏆</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-mv-text">{earnedCount} of {achievements.total} badges earned</p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-mv-surface">
            <div
              className="h-full rounded-full bg-gradient-to-r from-mv-gold to-mv-accent transition-all duration-700"
              style={{ width: `${achievements.total > 0 ? (earnedCount / achievements.total) * 100 : 0}%` }}
            />
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-semibold tabular-nums text-mv-gold">{achievements.total > 0 ? Math.round((earnedCount / achievements.total) * 100) : 0}%</span>
      </div>

      {/* Category chips */}
      <div className="scrollbar-none -mx-5 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:px-0" role="group" aria-label="Filter achievements by category">
        {categoryOptions.map((c) => {
          const active = category === c.key;
          return (
            <button
              key={c.key || 'all'}
              onClick={() => setCategory(c.key)}
              aria-pressed={active}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-all duration-200',
                active
                  ? 'bg-gradient-to-r from-mv-purple to-mv-accent text-white shadow-glow-sm'
                  : 'border border-mv-border-light bg-mv-surface/60 text-mv-text-secondary hover:border-mv-violet/40 hover:text-mv-text',
              )}
            >
              {c.label}
              <span className={cn('text-[9px] tabular-nums', active ? 'text-white/80' : 'text-mv-text-dim')}>{c.count}</span>
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {shown.length === 0 ? (
        <p className="py-8 text-center text-[11px] text-mv-text-dim">No badges in this category yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((badge, i) => {
            const hidden = HIDDEN_BADGE_IDS.has(badge.id) && !badge.earned;
            return (
              <div
                key={badge.id}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border p-4 text-center transition-all duration-300',
                  badge.earned
                    ? 'border-mv-gold/25 bg-gradient-to-b from-mv-gold/10 to-mv-darker hover:-translate-y-0.5 hover:border-mv-gold/50 hover:shadow-card-hover'
                    : 'border-mv-border bg-mv-darker/60 opacity-70',
                )}
                style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
                title={hidden ? 'Hidden achievement — keep exploring to uncover it' : `${badge.name}: ${badge.description}`}
              >
                {badge.earned && (
                  <span className="pointer-events-none absolute -right-5 -top-5 h-14 w-14 rounded-full bg-mv-gold/20 blur-2xl" aria-hidden="true" />
                )}
                <div className={cn('relative flex justify-center', badge.earned && 'animate-scale-in')}>
                  {badge.earned ? (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-mv-gold/25 to-mv-accent/15 text-2xl shadow-glow-sm" aria-hidden="true">
                      {hidden ? '🎁' : badge.emoji}
                    </span>
                  ) : (
                    <span className="relative flex h-12 w-12 items-center justify-center text-mv-text-dim/70">
                      {hidden ? (
                        <span className="text-xl" aria-hidden="true">❓</span>
                      ) : (
                        <>
                          <span className="absolute inset-0 text-xl opacity-40" aria-hidden="true">{badge.emoji}</span>
                          <span className="relative text-mv-text-muted"><ProgressRing pct={badge.progress} /></span>
                        </>
                      )}
                    </span>
                  )}
                </div>
                <p className={cn('mt-2.5 truncate text-[11px] font-semibold', badge.earned ? 'text-white' : 'text-mv-text-muted')}>
                  {hidden ? 'Hidden badge' : badge.name}
                </p>
                <p className="mt-1 line-clamp-2 min-h-[2em] text-[9px] leading-snug text-mv-text-dim">
                  {hidden ? 'Unlocked by surprising, helpful acts. Keep contributing.' : badge.description}
                </p>
                {badge.earned ? (
                  <p className="mt-2 text-[8px] font-semibold uppercase tracking-wider text-mv-gold">Earned {formatEarned(badge.earnedAt!)}</p>
                ) : !hidden && (
                  <p className="mt-2 text-[8px] font-semibold tabular-nums text-mv-text-dim">
                    {badge.current.toLocaleString()} / {badge.target.toLocaleString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

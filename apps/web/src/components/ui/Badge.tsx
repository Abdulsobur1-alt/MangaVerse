'use client';

import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Badge — compact status/label chip built on the .status-pill base.
   Tones: neutral · accent · success · warning · danger · gold · info
   Optional `dot` renders a live-status indicator.
   ═══════════════════════════════════════════════════════════════ */

export const badgeTones = {
  neutral: 'border-white/15 bg-white/5 text-mv-text-secondary',
  accent: 'border-mv-violet/30 bg-mv-violet/10 text-mv-violet',
  success: 'border-mv-success/30 bg-mv-success/10 text-mv-success',
  warning: 'border-mv-warning/30 bg-mv-warning/10 text-mv-warning',
  danger: 'border-mv-danger/30 bg-mv-danger/10 text-mv-danger',
  gold: 'border-mv-gold/30 bg-mv-gold/10 text-mv-gold',
  info: 'border-blue-400/30 bg-blue-400/10 text-blue-400',
} as const;

const dotColors: Record<keyof typeof badgeTones, string> = {
  neutral: 'bg-mv-text-muted',
  accent: 'bg-mv-violet',
  success: 'bg-mv-success',
  warning: 'bg-mv-warning',
  danger: 'bg-mv-danger',
  gold: 'bg-mv-gold',
  info: 'bg-blue-400',
};

export interface BadgeProps {
  tone?: keyof typeof badgeTones;
  /** Live-status indicator dot. */
  dot?: boolean;
  /** Animate the dot (pulse) — use for "online"/"live" states. */
  pulse?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Badge({ tone = 'neutral', dot = false, pulse = false, className, children }: BadgeProps) {
  return (
    <span className={cn('status-pill', badgeTones[tone], className)}>
      {dot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full', dotColors[tone], pulse && 'animate-pulse-dot')}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

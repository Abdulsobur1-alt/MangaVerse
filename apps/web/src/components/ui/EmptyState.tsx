'use client';

import { Icon, type IconName } from './Icon';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   EmptyState — the shared "nothing here yet" surface.
   Glowing icon tile + editorial copy + optional action(s).
   Used by Library, Bookmarks, History, Collections, Reviews,
   Downloads, Notifications, Search and more — so every empty page
   feels intentional instead of accidental.
   ═══════════════════════════════════════════════════════════════ */

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  body?: string;
  /** Optional CTA(s) — buttons or links rendered below the copy. */
  action?: React.ReactNode;
  /** Small decorative emoji floating on the icon tile. */
  emoji?: string;
  className?: string;
}

export function EmptyState({ icon, title, body, action, emoji, className }: EmptyStateProps) {
  return (
    <div className={cn('card flex flex-col items-center rounded-3xl px-6 py-16 text-center', className)}>
      {/* Glowing icon tile — glow sits in flow after the card bg (no -z,
          which would paint it behind the card's opaque background) */}
      <div className="relative mb-5">
        <div
          aria-hidden="true"
          className="animate-glow-pulse pointer-events-none absolute -inset-3 rounded-full bg-mv-accent/20 blur-2xl"
        />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-mv-violet/25 bg-gradient-to-br from-mv-purple/25 to-mv-accent/10 shadow-glow-sm">
          <Icon name={icon} size={26} strokeWidth={1.7} className="text-mv-violet" />
          {emoji && (
            <span aria-hidden="true" className="absolute -right-1 -top-1 text-base">
              {emoji}
            </span>
          )}
        </div>
      </div>
      <p className="text-sm font-semibold tracking-tight text-mv-text">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-mv-text-muted">{body}</p>}
      {action && <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

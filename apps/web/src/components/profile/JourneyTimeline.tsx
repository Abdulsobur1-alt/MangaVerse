'use client';

import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import type { JourneyMilestone } from '@/lib/hooks/useIdentity';

/* ═══════════════════════════════════════════════════════════════
   JourneyTimeline — the reader's life story (Phase 9).
   Milestones read oldest → newest: joined, first chapter, first
   review, 100 chapters, first completed series… Each dot is a memory;
   the thread that runs through them is the reader's own journey.
   ═══════════════════════════════════════════════════════════════ */

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}

export function JourneyTimeline({ items, className, limit }: { items: JourneyMilestone[]; className?: string; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items;
  const hasMore = limit ? items.length > limit : false;

  if (items.length === 0) {
    return (
      <div className={cn('rounded-2xl border border-mv-border bg-mv-darker p-8 text-center', className)}>
        <p className="text-xs text-mv-text-muted">The journey hasn't started yet — read your first chapter to begin the timeline.</p>
      </div>
    );
  }

  return (
    <div className={cn('relative pl-9', className)}>
      <div aria-hidden="true" className="absolute bottom-3 left-[15px] top-3 w-px bg-gradient-to-b from-mv-violet/60 via-mv-accent/30 to-transparent" />
      <ol className="space-y-4">
        {shown.map((m, i) => (
          <li key={m.id} className="relative animate-fade-in" style={{ animationDelay: `${Math.min(i * 60, 600)}ms` }}>
            <span
              aria-hidden="true"
              className="absolute -left-9 top-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-mv-darker bg-mv-surface text-sm shadow-modal"
            >
              {m.emoji}
            </span>
            <div className="rounded-xl border border-mv-border bg-mv-darker px-4 py-3 transition-colors hover:border-mv-violet/40">
              <p className="text-xs font-medium text-mv-text">{m.title}</p>
              {m.detail && <p className="mt-0.5 text-[10px] text-mv-text-dim">{m.detail}</p>}
              <p className="mt-1.5 flex items-center gap-1 text-[9px] uppercase tracking-wider text-mv-text-dim/80">
                <Icon name="calendar" size={9} /> {formatDate(m.achievedAt)}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {hasMore && (
        <p className="mt-3 pl-1 text-[9px] text-mv-text-dim">
          +{items.length - (limit ?? 0)} more milestones…
        </p>
      )}
    </div>
  );
}

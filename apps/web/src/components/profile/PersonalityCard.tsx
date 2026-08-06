'use client';

import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   PersonalityCard — the Reader Profile (Phase 9).
   A hero archetype card (The Explorer, The Night Owl…) with a
   secondary runner-up. The owner's own view additionally shows the
   full scoring breakdown; public profiles see only the primary pick.
   ═══════════════════════════════════════════════════════════════ */

interface ArchetypeView {
  key: string;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  gradient: string;
  score?: number;
}

interface PersonalityCardProps {
  primary: ArchetypeView;
  secondary?: ArchetypeView | null;
  /** Full scoring breakdown (own view only). */
  all?: ArchetypeView[];
  className?: string;
}

export function PersonalityCard({ primary, secondary, all, className }: PersonalityCardProps) {
  const ranked = all ? [...all].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5) : [];
  const maxScore = Math.max(...ranked.map((a) => a.score ?? 0), 1);

  return (
    <section className={cn('rounded-2xl border border-mv-border bg-mv-darker p-5', className)} aria-label="Reader personality">
      <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
        <Icon name="sparkles" size={13} /> Reader Profile
      </h2>

      {/* Primary archetype */}
      <div className={cn('relative overflow-hidden rounded-2xl border border-mv-border-light bg-gradient-to-br p-5', primary.gradient)}>
        <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/5 blur-2xl" aria-hidden="true" />
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-black/20 text-3xl" aria-hidden="true">
            {primary.emoji}
          </span>
          <div className="min-w-0">
            <p className="text-base font-bold tracking-tight text-white">{primary.name}</p>
            <p className="text-[10px] font-medium text-white/70">{primary.tagline}</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-white/80">{primary.description}</p>
      </div>

      {/* Secondary */}
      {secondary && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-mv-border bg-mv-surface/50 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/15 text-lg" aria-hidden="true">{secondary.emoji}</span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-dim">Also a bit of a</p>
            <p className="truncate text-xs font-medium text-mv-text-secondary">{secondary.name} <span className="text-mv-text-dim">— {secondary.tagline}</span></p>
          </div>
        </div>
      )}

      {/* Scoring breakdown (own view) */}
      {ranked.length > 1 && (
        <div className="mt-4 space-y-2">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-mv-text-dim">How it's measured</p>
          {ranked.map((a) => (
            <div key={a.key} className="flex items-center gap-2.5">
              <span className="w-28 shrink-0 truncate text-[10px] text-mv-text-secondary">{a.emoji} {a.name.replace('The ', '')}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-mv-surface">
                <div className="h-full rounded-full bg-gradient-to-r from-mv-purple to-mv-accent transition-all duration-700" style={{ width: `${Math.max(3, ((a.score ?? 0) / maxScore) * 100)}%` }} />
              </div>
              <span className="w-7 text-right text-[9px] tabular-nums text-mv-text-dim">{a.score}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

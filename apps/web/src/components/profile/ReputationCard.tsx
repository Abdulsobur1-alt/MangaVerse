'use client';

import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   ReputationCard — the trust system (Phase 9).
   Public profiles show the tier + tier ladder; the owner's own view
   additionally breaks down the opaque score into weighted signals
   (helpful reviews, curation, verified reports…). Raw score is never
   shown to visitors.
   ═══════════════════════════════════════════════════════════════ */

export interface ReputationView {
  score: number;
  tier: { key: string; label: string; emoji: string; min: number; description: string };
  signals?: { key: string; label: string; points: number; weight: number }[];
}

export function ReputationCard({ reputation, detailed, className }: { reputation: ReputationView; detailed?: boolean; className?: string }) {
  const { tier, score, signals } = reputation;
  const earned = [...REPUTATION_LADDER].sort((a, b) => b.min - a.min);
  const currentIndex = earned.findIndex((t) => t.min <= score);
  const nextTier = earned[currentIndex - 1] ?? null;

  return (
    <section className={cn('rounded-2xl border border-mv-border bg-mv-darker p-5', className)} aria-label="Reputation">
      <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
        <Icon name="trophy" size={13} /> Reputation
      </h2>

      {/* Tier hero */}
      <div className="flex items-center gap-4 rounded-2xl border border-mv-gold/25 bg-gradient-to-br from-mv-gold/10 to-transparent p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mv-gold/15 text-2xl" aria-hidden="true">{tier.emoji}</span>
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-tight text-white">{tier.label}</p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-mv-text-muted">{tier.description}</p>
        </div>
      </div>

      {/* Tier ladder */}
      <div className="mt-4 flex items-center gap-1">
        {earned.map((t) => (
          <span
            key={t.key}
            title={`${t.label} (${t.min}+)`}
            className={cn(
              'flex h-7 flex-1 items-center justify-center rounded-md text-sm transition-all',
              t.min <= score ? 'bg-mv-gold/20' : 'bg-mv-surface text-mv-text-dim/60',
            )}
            aria-hidden="true"
          >
            {t.emoji}
          </span>
        ))}
      </div>
      {detailed && (
        <p className="mt-2 text-[9px] text-mv-text-dim">
          {nextTier ? `${score} points · ${nextTier.min - score} to reach ${nextTier.label}` : 'Top of the ladder — every page counts.'}
        </p>
      )}

      {/* Signals (own view) */}
      {detailed && signals && signals.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-mv-text-dim">What builds trust</p>
          {signals
            .filter((s) => s.points > 0)
            .sort((a, b) => b.points - a.points)
            .slice(0, 6)
            .map((s) => (
              <div key={s.key} className="flex items-center justify-between rounded-lg bg-mv-surface/40 px-3 py-1.5">
                <span className="text-[10px] text-mv-text-secondary">{s.label}</span>
                <span className="text-[10px] font-semibold tabular-nums text-mv-gold">+{s.points}</span>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}

const REPUTATION_LADDER: { key: string; label: string; emoji: string; min: number }[] = [
  { key: 'newcomer', label: 'Newcomer', emoji: '🌱', min: 0 },
  { key: 'reader', label: 'Regular Reader', emoji: '📖', min: 25 },
  { key: 'trusted', label: 'Trusted Reader', emoji: '⭐', min: 100 },
  { key: 'esteemed', label: 'Esteemed Reader', emoji: '🏅', min: 250 },
  { key: 'veteran', label: 'Veteran Reader', emoji: '💎', min: 500 },
  { key: 'legend', label: 'Legendary Reader', emoji: '👑', min: 1000 },
];

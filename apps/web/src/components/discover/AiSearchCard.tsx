'use client';

import { useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useDialog } from './useDialog';

/* ═══════════════════════════════════════════════════════════════
   AiSearchCard — the future-ready AI discovery entry point.
   The API doesn't do semantic discovery yet, so this card is an
   honest teaser: a gorgeous "describe what you want" surface with
   example prompts and a modal explaining exactly what's coming and
   what already works today. No fake results, no dead-ends.
   ═══════════════════════════════════════════════════════════════ */

const EXAMPLES = [
  'OP protagonist, kingdom building, no romance',
  'mind-bending thriller with a cold female lead',
  'cozy slice of life about food and found family',
  'villainess isekai with excellent tea etiquette',
];

export function AiSearchCard() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialog(dialogRef, open, () => setOpen(false));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group relative block w-full overflow-hidden rounded-3xl border border-mv-violet/25 bg-gradient-to-br from-mv-darker via-mv-surface to-mv-darker p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-mv-violet/50 hover:shadow-glow md:p-8"
        aria-haspopup="dialog"
      >
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-mv-purple/20 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
        <div className="pointer-events-none absolute -bottom-12 -right-8 h-44 w-44 rounded-full bg-mv-accent/20 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />

        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-mv-purple to-mv-accent shadow-glow-sm">
              <Icon name="sparkles" size={18} className="text-white" />
            </span>
            <span className="rounded-full border border-mv-violet/30 bg-mv-violet/10 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-mv-violet">
              Coming soon
            </span>
          </div>
          <h3 className="mt-4 text-lg font-bold text-white md:text-xl">Describe what you want to read</h3>
          <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-mv-text-secondary">
            Mood, tropes, character types, artwork — tell us in plain language and we'll surface
            the perfect series. We're wiring up story-graph embeddings right now.
          </p>

          {/* Fake prompt bar */}
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-mv-border-light bg-mv-darker/80 px-4 py-3 backdrop-blur-sm transition-colors group-hover:border-mv-violet/40">
            <Icon name="search" size={16} className="shrink-0 text-mv-text-muted" />
            <span className="min-w-0 flex-1 truncate text-xs text-mv-text-dim">
              {draft || '“slow-burn romance where the FL is secretly overpowered…”'}
            </span>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-mv-violet/15 px-3 py-1 text-[10px] font-medium text-mv-violet transition-colors group-hover:bg-mv-violet/25">
              Ask AI
              <Icon name="arrowRight" size={11} />
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <span
                key={ex}
                onClick={(e) => {
                  e.stopPropagation();
                  setDraft(ex);
                  setOpen(true);
                }}
                className="cursor-pointer rounded-full border border-mv-border-light bg-mv-surface/60 px-3 py-1 text-[10px] text-mv-text-muted transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
              >
                {ex}
              </span>
            ))}
          </div>
        </div>
      </button>

      {/* ── Honest modal ── */}
      {open && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-3xl border border-mv-violet/25 bg-mv-darker p-7 shadow-modal animate-scale-in"
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full p-1.5 text-mv-text-muted transition-colors hover:bg-white/5 hover:text-white"
            >
              <Icon name="close" size={16} />
            </button>
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-mv-purple to-mv-accent shadow-glow-sm">
              <Icon name="sparkles" size={22} className="text-white" />
            </div>
            <h3 id="ai-modal-title" className="text-lg font-bold text-white">AI Discovery is coming soon</h3>
            <p className="mt-2 text-xs leading-relaxed text-mv-text-secondary">
              {draft ? (
                <>You asked: <span className="italic text-mv-violet">“{draft}”</span> — we'd love to answer that.</>
              ) : (
                'We\'re wiring up story-graph embeddings so you can describe what you want in plain language.'
              )}{' '}
              Mood, tropes, character types, recommended-by-artwork, recommended-by-story — all coming to this
              exact spot.
            </p>
            <div className="mt-4 space-y-1.5">
              {EXAMPLES.map((ex) => (
                <p key={ex} className="rounded-lg border border-mv-border bg-mv-surface/60 px-3 py-2 text-[11px] italic text-mv-text-muted">
                  {ex}
                </p>
              ))}
            </div>
            <p className="mt-4 rounded-xl border border-mv-success/25 bg-mv-success/10 px-3 py-2 text-[10px] leading-relaxed text-mv-success">
              Meanwhile, keyword search, genre pages, author pages, and the curated collections are live right now — give them a spin.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

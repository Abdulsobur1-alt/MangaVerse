'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   StoryPreview — editorial description block.
   • First paragraph becomes a pull-quote styled intro
   • Expandable long synopsis with smooth reveal
   • Spoiler guard toggle (blurs the body until confirmed)
   • Editorial highlights (derived genre prompts)
   ═══════════════════════════════════════════════════════════════ */

const HIGHLIGHT_PROMPTS: Record<string, string> = {
  action: 'Relentless, high-octane pacing.',
  romance: 'A slow burn that pays off beautifully.',
  isekai: 'A fresh twist on other-world storytelling.',
  fantasy: 'Worldbuilding that pulls you in deep.',
  thriller: 'Twists layered on twists.',
  horror: 'Atmosphere that lingers after you close it.',
  comedy: 'Sharp, character-driven humor.',
  drama: 'Emotional stakes that hit hard.',
  mystery: 'Clues, red herrings, and a satisfying reveal.',
  slice_of_life: 'Warm, quiet, and quietly profound.',
  sci_fi: 'Big ideas told through small moments.',
};

export function StoryPreview({ synopsis, genres }: { synopsis: string; genres?: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const [spoilerOk, setSpoilerOk] = useState(false);

  if (!synopsis) return null;

  const long = synopsis.length > 320;
  const visible = expanded || !long;
  const paragraph = synopsis.trim();
  // Split on the first sentence boundary (manual scan — lookbehind regex
  // breaks on Safari <16.4).
  const m = paragraph.match(/^.*?[.!?](?:\s|$)/);
  const firstSentence = m ? m[0].trim() : paragraph;
  const rest = m ? paragraph.slice(m[0].length) : '';
  const highlights = (genres ?? []).map((g) => HIGHLIGHT_PROMPTS[g]).filter(Boolean).slice(0, 2);

  return (
    <section aria-label="Story preview" className="relative overflow-hidden rounded-2xl border border-mv-border bg-mv-darker">
      <div className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-mv-accent/10 blur-3xl" aria-hidden="true" />
      <div className="relative p-6 md:p-8">
        <p className="eyebrow mb-4 flex items-center gap-2">
          <Icon name="book" size={12} className="text-mv-violet" />
          The Story
        </p>

        {/* Pull quote intro */}
        <blockquote className="relative border-l-2 border-mv-violet/50 pl-4">
          <p className="font-display text-lg font-medium leading-snug text-white md:text-xl">{firstSentence}</p>
        </blockquote>

        {/* Spoiler guard */}
        {rest && long && !spoilerOk && (
          <div className="mt-3 flex items-center gap-2 text-[10px] text-mv-text-muted">
            <span className="flex items-center gap-1">
              <Icon name="alert" size={11} className="text-mv-warning" />
              The rest may contain spoilers
            </span>
            <button
              onClick={() => setSpoilerOk(true)}
              className="rounded-full border border-mv-border-light bg-mv-surface px-2.5 py-0.5 text-[9px] text-mv-violet transition-colors hover:border-mv-violet/50"
            >
              Reveal
            </button>
          </div>
        )}

        {/* Body (only when there's more than the quote) */}
        {rest && (
          <div
            className={cn(
              'relative mt-3 transition-all duration-500',
              long && !spoilerOk && 'pointer-events-none select-none blur-sm',
              !visible && 'overflow-hidden',
            )}
            style={{ maxHeight: visible ? 'none' : '6.5rem' }}
            aria-hidden={long && !spoilerOk}
          >
            <p className="text-sm leading-relaxed text-mv-text-secondary">{rest}</p>
          </div>
        )}

        {/* Expand */}
        {long && spoilerOk && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-mv-violet transition-colors hover:text-mv-violet/80"
            aria-expanded={expanded}
          >
            {expanded ? 'Show less' : 'Read the full synopsis'}
            <Icon name="chevronDown" size={12} className={cn('transition-transform', expanded && 'rotate-180')} />
          </button>
        )}

        {/* Highlights */}
        {highlights.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {highlights.map((h) => (
              <span key={h} className="flex items-center gap-1.5 rounded-full border border-mv-violet/25 bg-mv-violet/10 px-3 py-1 text-[10px] text-mv-violet">
                <Icon name="sparkles" size={10} />
                {h}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

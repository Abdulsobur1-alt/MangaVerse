'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { COLLECTIONS } from './utils';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   CuratedCollections — hand-curated entry points into the catalog.
   Each card maps to real /browse filters (honest, shareable) and
   shows its query as chips so readers know exactly what they're
   getting into. One-click copy makes collections shareable.
   ═══════════════════════════════════════════════════════════════ */

export function CuratedCollections() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyLink = async (def: (typeof COLLECTIONS)[number]) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/browse${def.query}`);
      setCopiedId(def.id);
      setTimeout(() => setCopiedId((c) => (c === def.id ? null : c)), 1600);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  return (
    <section aria-label="Curated collections" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {COLLECTIONS.map((c) => (
        <div
          key={c.id}
          className="group relative overflow-hidden rounded-2xl border border-mv-border-light bg-mv-surface/50 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-mv-violet/40 hover:shadow-card-hover sm:p-5"
        >
          <div className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${c.accent} opacity-15 blur-2xl transition-opacity duration-300 group-hover:opacity-35`} />
          <div className="flex items-start justify-between">
            <span className="text-2xl transition-transform duration-300 group-hover:scale-110" aria-hidden="true">{c.emoji}</span>
            <button
              onClick={() => copyLink(c)}
              aria-label={`Copy link to ${c.title}`}
              title={copiedId === c.id ? 'Copied!' : 'Copy link'}
              className="rounded-full p-1.5 text-mv-text-dim opacity-0 transition-all hover:bg-white/5 hover:text-mv-violet group-hover:opacity-100 focus-visible:opacity-100"
            >
              <Icon name={copiedId === c.id ? 'check' : 'link'} size={13} />
            </button>
          </div>
          <p className="mt-3 text-sm font-bold text-white">{c.title}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-mv-text-muted">{c.blurb}</p>
          <div className="mt-3 flex flex-wrap gap-1">
            {c.chips.map((chip) => (
              <span key={chip} className="rounded-full border border-mv-border-light bg-mv-darker/60 px-2 py-0.5 text-[8px] text-mv-text-muted">
                {chip}
              </span>
            ))}
          </div>
          <Link
            href={`/browse${c.query}`}
            className={cn(
              'mt-4 inline-flex items-center gap-1 text-[10px] font-medium text-mv-violet transition-all',
              'opacity-0 -translate-x-1 group-hover:translate-x-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:translate-x-0',
            )}
          >
            Explore
            <Icon name="arrowRight" size={12} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      ))}
    </section>
  );
}

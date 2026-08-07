'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { Kbd } from '@/components/ui/Kbd';
import { CoverImage } from '@/components/CoverImage';
import { useTrendingTitles } from '@/lib/hooks/useTitles';
import { api } from '@/lib/api';
import { formatType } from '@/lib/format';
import { genreDisplayLabel, toDbGenre } from './utils';
import { GENRES_META } from '@/components/home/types';
import { useDialog } from './useDialog';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   DiscoverSearch — the search engine of the Discovery Hub.
   Search should never feel empty:
   • Idle: recent searches, trending now, popular genres, quick filters
   • Typing: debounced live results (covers, author, rating) + smart
     "try a genre / browse everything" suggestions
   • Keyboard: ↑↓ navigate · ↵ open · esc close · full combobox a11y
   • Future-ready: an AI-search teaser pill (honest "coming soon")
   Recents are shared with the homepage search + ⌘K palette.
   ═══════════════════════════════════════════════════════════════ */

const RECENT_KEY = 'mangaverse_recent_searches';
const POPULAR_GENRES = ['action', 'fantasy', 'romance', 'isekai', 'sci-fi', 'comedy', 'slice_of_life', 'mystery'];

interface Hit {
  id: string;
  slug: string;
  title: string;
  type: string;
  coverUrl: string | null;
  author?: string | null;
  rating?: number | null;
}

interface DiscoverSearchProps {
  value: string;
  onChange: (v: string) => void;
  /** Called when the user commits a search (Enter / suggestion). */
  onSubmit: (term: string) => void;
  /** Show a hero-sized bar (browse hub) vs compact (genre/author pages). */
  large?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) return JSON.parse(raw).slice(0, 6);
  } catch { /* ignore */ }
  return [];
}

export function DiscoverSearch({ value, onChange, onSubmit, large = false, autoFocus = false, placeholder, className }: DiscoverSearchProps) {
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showAi, setShowAi] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const aiDialogRef = useRef<HTMLDivElement>(null);
  useDialog(aiDialogRef, showAi, () => setShowAi(false));

  const { data: trending } = useTrendingTitles();
  const trendingList = (trending ?? []).slice(0, 5);
  const q = value.trim();

  // Load recents on focus
  useEffect(() => {
    if (focused) setRecent(loadRecent());
  }, [focused]);

  // Close on outside click / escape
  useEffect(() => {
    if (!focused) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setFocused(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFocused(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [focused]);

  // Debounced live search
  useEffect(() => {
    if (!focused || q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.get<{ items: Hit[] }>(`/titles?search=${encodeURIComponent(q)}&limit=7`);
        setHits(data.items ?? []);
      } catch {
        setHits([]);
      }
      setSearching(false);
      setActiveIndex(0);
    }, 180);
    return () => clearTimeout(timer);
  }, [q, focused]);

  const saveRecent = (term: string) => {
    const next = [term, ...recent.filter((r) => r.toLowerCase() !== term.toLowerCase())].slice(0, 6);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
  };

  const commit = (term: string) => {
    saveRecent(term);
    setFocused(false);
    onSubmit(term);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const count = q.length >= 2 ? hits.length + 1 : 0; // hits + "search all" row
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, count - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!q) return;
      if (q.length < 2) {
        commit(q);
        return;
      }
      const hit = hits[activeIndex];
      if (hit) commit(hit.title);
      else commit(q);
    }
  };

  // Keep the highlighted row visible
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-ai="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const showDropdown = focused && (q.length >= 2 || !q);

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      {/* ── Search bar ── */}
      <div
        className={cn(
          'group flex items-center gap-2.5 rounded-2xl border bg-mv-darker/85 px-3.5 backdrop-blur-xl transition-all duration-300 sm:px-4',
          large ? 'h-12 shadow-card sm:h-14' : 'h-11',
          focused ? 'border-mv-violet/60 shadow-glow-sm' : 'border-mv-border-light hover:border-mv-violet/40',
        )}
      >
        <Icon name="search" size={large ? 22 : 18} className="shrink-0 text-mv-text-muted transition-colors group-focus-within:text-mv-violet" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
          placeholder={placeholder ?? 'Search manga, manhwa, light novels, authors, genres…'}
          aria-label="Search everything"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="discover-search-results"
          aria-autocomplete="list"
          className={cn('w-full bg-transparent text-mv-text outline-none placeholder:text-mv-text-dim', large ? 'text-sm sm:text-[15px]' : 'text-sm')}
        />
        {q && (
          <button
            onClick={() => { onChange(''); setFocused(true); }}
            aria-label="Clear search"
            className="shrink-0 rounded-full p-1 text-mv-text-dim transition-colors hover:bg-white/5 hover:text-mv-text"
          >
            <Icon name="close" size={14} />
          </button>
        )}
        {searching ? (
          <Spinner size={16} className="shrink-0 text-mv-violet" />
        ) : (
          <span title="Press Enter to search">
            <Kbd className="hidden shrink-0 sm:inline-flex">↵</Kbd>
          </span>
        )}
      </div>

      {/* ── Dropdown ── */}
      {showDropdown && (
        <div
          id="discover-search-results"
          className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-mv-border bg-mv-darker/95 shadow-modal backdrop-blur-xl animate-scale-in"
          role="listbox"
          aria-label="Search suggestions"
        >
          <div ref={listRef} className="max-h-[60vh] overflow-y-auto overscroll-contain p-2">
            {/* ── Idle state: never empty ── */}
            {q.length < 2 && (
              <>
                {recent.length > 0 && (
                  <div className="px-3 pb-2 pt-2.5">
                    <p className="pb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">Recent</p>
                    <div className="flex flex-wrap gap-1.5">
                      {recent.map((term) => (
                        <button
                          key={term}
                          onClick={() => commit(term)}
                          className="flex items-center gap-1.5 rounded-full border border-mv-border-light bg-mv-surface/60 px-3 py-1 text-[11px] text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
                        >
                          <Icon name="history" size={12} />
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="px-3 pb-1.5 pt-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">Trending searches</p>
                <div className="space-y-0.5">
                  {trendingList.map((t, i) => (
                    <button
                      key={t.id}
                      onClick={() => commit(t.title)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/5"
                    >
                      <span className="w-4 text-center text-[11px] font-bold text-mv-violet">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-mv-text-secondary hover:text-white">{t.title}</span>
                      {t.rating != null && <span className="text-[10px] text-mv-gold">★ {t.rating.toFixed(1)}</span>}
                    </button>
                  ))}
                </div>

                <p className="px-3 pb-1.5 pt-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">Popular genres</p>
                <div className="flex flex-wrap gap-1.5 px-3 pb-1">
                  {POPULAR_GENRES.map((g) => (
                    <Link
                      key={g}
                      href={`/genre/${toDbGenre(g)}`}
                      onClick={() => setFocused(false)}
                      className="rounded-full border border-mv-border-light bg-mv-surface/60 px-3 py-1 text-[11px] text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
                    >
                      {genreDisplayLabel(g)}
                    </Link>
                  ))}
                </div>

                {/* AI teaser — future-ready, honest */}
                <div className="mx-3 mt-2 flex items-center gap-3 rounded-xl border border-mv-violet/20 bg-gradient-to-r from-mv-violet/10 via-mv-purple/5 to-transparent p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-mv-purple to-mv-accent">
                    <Icon name="sparkles" size={16} className="text-white" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-white">AI Discovery</p>
                    <p className="truncate text-[10px] text-mv-text-muted">“find a slow-burn romance with an OP villainess lead”</p>
                  </div>
                  <button
                    onClick={() => setShowAi(true)}
                    className="shrink-0 rounded-full border border-mv-violet/30 bg-mv-violet/10 px-3 py-1 text-[10px] font-medium text-mv-violet transition-colors hover:bg-mv-violet/20"
                  >
                    Soon
                  </button>
                </div>
              </>
            )}

            {/* ── Typing: live results ── */}
            {q.length >= 2 && (
              <>
                <p className="px-3 pb-1.5 pt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">
                  {searching ? 'Searching…' : hits.length > 0 ? `Titles matching “${q}”` : `No titles match “${q}”`}
                </p>
                {!searching && hits.length === 0 && (
                  <div className="px-3 py-5 text-center">
                    <p className="text-xs text-mv-text-muted">Nothing found — try a broader term, an author, or a genre.</p>
                  </div>
                )}
                <div className="space-y-0.5">
                  {hits.map((hit, i) => (
                    <button
                      key={hit.id}
                      data-ai={i}
                      role="option"
                      aria-selected={activeIndex === i}
                      onClick={() => commit(hit.title)}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                        activeIndex === i ? 'bg-mv-accent/15' : 'hover:bg-white/5',
                      )}
                    >
                      <span className="h-12 w-9 shrink-0 overflow-hidden rounded-md bg-mv-surface">
                        <CoverImage src={hit.coverUrl} title={hit.title} type={hit.type} className="h-full w-full" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-mv-text">{hit.title}</span>
                        <span className="mt-0.5 flex items-center gap-2 text-[10px] text-mv-text-muted">
                          <span>{formatType(hit.type)}</span>
                          {hit.author && <span className="truncate italic">{hit.author}</span>}
                          {hit.rating != null && <span className="text-mv-gold">★ {hit.rating.toFixed(1)}</span>}
                        </span>
                      </span>
                      <Icon name="chevronRight" size={14} className="shrink-0 text-mv-text-dim" />
                    </button>
                  ))}
                </div>

                {/* Smart follow-ups — genres that contain the term */}
                {!searching && hits.length === 0 && (
                  <div className="border-t border-mv-border px-3 py-3">
                    <p className="pb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">Try a genre</p>
                    <div className="flex flex-wrap gap-1.5">
                      {GENRES_META.filter((g) => g.label.toLowerCase().includes(q.toLowerCase())).map((g) => (
                        <Link
                          key={g.key}
                          href={`/genre/${toDbGenre(g.key)}`}
                          onClick={() => setFocused(false)}
                          className="rounded-full border border-mv-border-light bg-mv-surface/60 px-3 py-1 text-[11px] text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
                        >
                          {g.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search-all row (last item, keyboard reachable) */}
                <button
                  data-ai={hits.length}
                  role="option"
                  aria-selected={activeIndex === hits.length}
                  onClick={() => commit(q)}
                  onMouseEnter={() => setActiveIndex(hits.length)}
                  className={cn(
                    'mt-1 flex w-full items-center justify-between rounded-xl border-t border-mv-border px-3 py-2.5 text-left transition-colors',
                    activeIndex === hits.length ? 'bg-mv-accent/15' : 'hover:bg-white/5',
                  )}
                >
                  <span className="flex items-center gap-2 text-xs text-mv-violet">
                    <Icon name="arrowRight" size={14} />
                    Search all of Browse for “{q}”
                  </span>
                  <Kbd>↵</Kbd>
                </button>
              </>
            )}
          </div>

          {/* Footer hints */}
          <div className="flex items-center gap-4 border-t border-mv-border px-4 py-2.5 text-[9px] text-mv-text-dim">
            <span><Kbd>↑↓</Kbd> navigate</span>
            <span><Kbd>↵</Kbd> open</span>
            <span><Kbd>esc</Kbd> close</span>
            <span className="ml-auto hidden items-center gap-1 sm:flex">
              <Icon name="zap" size={10} className="text-mv-violet" />
              instant results
            </span>
          </div>
        </div>
      )}

      {/* ── AI teaser modal (honest: not implemented yet) ── */}
      {showAi && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowAi(false)}
          role="presentation"
        >
          <div
            ref={aiDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-teaser-title"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-3xl border border-mv-violet/25 bg-mv-darker p-7 shadow-modal animate-scale-in"
          >
            <button
              onClick={() => setShowAi(false)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full p-1.5 text-mv-text-muted transition-colors hover:bg-white/5 hover:text-white"
            >
              <Icon name="close" size={16} />
            </button>
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-mv-purple to-mv-accent shadow-glow-sm">
              <Icon name="sparkles" size={22} className="text-white" />
            </div>
            <h3 id="ai-teaser-title" className="text-lg font-bold text-white">AI Discovery is coming soon</h3>
            <p className="mt-2 text-xs leading-relaxed text-mv-text-secondary">
              We're wiring up story-graph embeddings so you can describe what you want in plain language —
              by mood, tropes, character types, or artwork.
            </p>
            <div className="mt-4 space-y-1.5">
              {['“something mind-bending with a cold FL”', '“OP protagonist, kingdom building, no romance”', '“cozy slice of life about food”'].map((ex) => (
                <p key={ex} className="rounded-lg border border-mv-border bg-mv-surface/60 px-3 py-2 text-[11px] italic text-mv-text-muted">
                  {ex}
                </p>
              ))}
            </div>
            <p className="mt-4 text-[10px] text-mv-text-dim">
              Meanwhile, try keyword search, genre pages, or the curated collections — they're live right now.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

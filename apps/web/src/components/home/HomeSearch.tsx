'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { Kbd } from '@/components/ui/Kbd';
import { useTrendingTitles } from '@/lib/hooks/useTitles';
import { api } from '@/lib/api';
import { genreLabel } from './types';
import { formatType } from '@/lib/format';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   HomeSearch — lightweight discovery search on the homepage.
   • Focus: trending searches, popular genres, recent searches,
     quick format filters, suggested authors & manga
   • Typing: debounced live title results with covers
   • Keyboard: ↑↓ navigate · ↵ open · esc close
   Recents are shared with the global ⌘K palette (same key).
   ═══════════════════════════════════════════════════════════════ */

const RECENT_KEY = 'mangaverse_recent_searches';
const QUICK_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Manga', value: 'manga' },
  { label: 'Manhwa', value: 'manhwa' },
  { label: 'Manhua', value: 'manhua' },
  { label: 'Light Novel', value: 'light_novel' },
];
const POPULAR_GENRES = ['action', 'fantasy', 'romance', 'isekai', 'sci-fi', 'comedy'];

interface Suggestion {
  id: string;
  slug: string;
  title: string;
  type: string;
  coverUrl: string | null;
  author?: string | null;
  rating?: number | null;
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) return JSON.parse(raw).slice(0, 6);
  } catch { /* ignore */ }
  return [];
}

export function HomeSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: trending } = useTrendingTitles();
  const trendingList = (trending ?? []).slice(0, 5);
  const q = query.trim();

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
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.get<{ items: Suggestion[] }>(`/titles?search=${encodeURIComponent(q)}&limit=7`);
        setResults(data.items ?? []);
      } catch {
        setResults([]);
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

  const goTitle = (slug: string, term?: string) => {
    if (term) saveRecent(term);
    setFocused(false);
    router.push(`/title/${slug}`);
  };

  const goBrowse = (params: string, term?: string) => {
    if (term) saveRecent(term);
    setFocused(false);
    router.push(`/browse${params}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, 6));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!q) return; // nothing to search yet
      if (q.length < 2) {
        goBrowse(`?search=${encodeURIComponent(q)}`, q);
        return;
      }
      const hit = results[activeIndex];
      if (hit) goTitle(hit.slug, q);
      else goBrowse(`?search=${encodeURIComponent(q)}`, q);
    }
  };

  const showDropdown = focused && (q.length >= 2 || !q);

  return (
    <div ref={rootRef} className="relative mx-auto w-full max-w-3xl">
      {/* Search bar */}
      <div
        className={cn(
          'group flex items-center gap-3 rounded-2xl border bg-mv-darker/85 px-4 backdrop-blur-xl transition-all duration-300',
          focused ? 'border-mv-violet/60 shadow-glow-sm' : 'border-mv-border-light hover:border-mv-violet/40',
        )}
      >
        <Icon name="search" size={20} className="shrink-0 text-mv-text-muted transition-colors group-focus-within:text-mv-violet" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
          placeholder="Search manga, manhwa, light novels…"
          aria-label="Search titles"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="home-search-results"
          className="h-12 w-full bg-transparent text-sm text-mv-text outline-none placeholder:text-mv-text-dim"
        />
        {searching ? (
          <Spinner size={16} className="shrink-0 text-mv-violet" />
        ) : (
          <span title="Press Enter to search">
            <Kbd className="hidden shrink-0 sm:inline-flex">↵</Kbd>
          </span>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          id="home-search-results"
          className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-mv-border bg-mv-darker/95 shadow-modal backdrop-blur-xl animate-scale-in"
          role="listbox"
          aria-label="Search suggestions"
        >
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {/* ── Idle: trending + genres + filters + recents ── */}
            {q.length < 2 && (
              <>
                {/* Recent searches */}
                {recent.length > 0 && (
                  <div className="px-3 pb-2 pt-2.5">
                    <p className="pb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">Recent</p>
                    <div className="flex flex-wrap gap-1.5">
                      {recent.map((term) => (
                        <button
                          key={term}
                          onClick={() => goBrowse(`?search=${encodeURIComponent(term)}`, term)}
                          className="flex items-center gap-1.5 rounded-full border border-mv-border-light bg-mv-surface/60 px-3 py-1 text-[11px] text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
                        >
                          <Icon name="history" size={12} />
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trending searches */}
                <p className="px-3 pb-1.5 pt-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">Trending now</p>
                <div className="space-y-0.5">
                  {trendingList.map((t, i) => (
                    <button
                      key={t.id}
                      onClick={() => goTitle(t.slug, t.title)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/5"
                    >
                      <span className="w-4 text-center text-[11px] font-bold text-mv-violet">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-mv-text-secondary hover:text-white">{t.title}</span>
                      {t.rating != null && <span className="text-[10px] text-mv-gold">★ {t.rating.toFixed(1)}</span>}
                    </button>
                  ))}
                </div>

                {/* Popular genres */}
                <p className="px-3 pb-1.5 pt-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">Popular genres</p>
                <div className="flex flex-wrap gap-1.5 px-3 pb-1">
                  {POPULAR_GENRES.map((g) => (
                    <button
                      key={g}
                      onClick={() => goBrowse(`?genres=${g}`)}
                      className="rounded-full border border-mv-border-light bg-mv-surface/60 px-3 py-1 text-[11px] text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
                    >
                      {genreLabel(g)}
                    </button>
                  ))}
                </div>

                {/* Quick filters */}
                <p className="px-3 pb-1.5 pt-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">Quick filters</p>
                <div className="flex gap-1.5 px-3 pb-2.5">
                  {QUICK_FILTERS.map((f) => (
                    <button
                      key={f.label}
                      onClick={() => goBrowse(f.value ? `?type=${f.value}` : '')}
                      className="rounded-full border border-mv-border-light bg-mv-surface/60 px-3 py-1 text-[11px] font-medium text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ── Typing: results ── */}
            {q.length >= 2 && (
              <>
                <p className="px-3 pb-1.5 pt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">
                  {searching ? 'Searching…' : results.length > 0 ? 'Titles' : 'No titles found'}
                </p>
                {!searching && results.length === 0 && (
                  <div className="px-3 py-6 text-center">
                    <p className="text-xs text-mv-text-muted">Nothing matched “{q}”. Try a broader term.</p>
                    <button
                      onClick={() => goBrowse(`?search=${encodeURIComponent(q)}`, q)}
                      className="mt-3 rounded-full bg-mv-accent/15 px-4 py-1.5 text-[11px] font-medium text-mv-violet transition-colors hover:bg-mv-accent/25"
                    >
                      Search all of Browse →
                    </button>
                  </div>
                )}
                <div className="space-y-0.5">
                  {results.map((hit, i) => (
                    <button
                      key={hit.id}
                      onClick={() => goTitle(hit.slug, q)}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                        activeIndex === i ? 'bg-mv-accent/15' : 'hover:bg-white/5',
                      )}
                    >
                      <span className="flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-mv-surface text-sm">
                        {hit.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={hit.coverUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span aria-hidden="true">📖</span>
                        )}
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
              </>
            )}
          </div>

          {/* Footer hints */}
          <div className="flex items-center gap-4 border-t border-mv-border px-4 py-2.5 text-[9px] text-mv-text-dim">
            <span><Kbd>↑↓</Kbd> navigate</span>
            <span><Kbd>↵</Kbd> open</span>
            <span><Kbd>esc</Kbd> close</span>
            <button
              onClick={() => goBrowse(`?search=${encodeURIComponent(q)}`, q)}
              className="ml-auto font-medium text-mv-violet transition-colors hover:text-mv-violet/80"
            >
              Advanced search →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

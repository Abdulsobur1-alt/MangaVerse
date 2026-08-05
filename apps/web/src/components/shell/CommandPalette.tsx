'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTrendingTitles } from '@/lib/hooks/useTitles';
import { api } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { Kbd } from '@/components/ui/Kbd';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   CommandPalette — the universal search overlay (⌘K / "/").
   • Empty: recent searches + trending now + genre quick picks
   • Typing: debounced live results + genre matches
   • Full keyboard support: ↑↓ navigate · ↵ open · Esc close
   • Focus trap + focus restore, aria-complete dialog semantics
   ═══════════════════════════════════════════════════════════════ */

interface SearchHit {
  id: string;
  slug: string;
  title: string;
  type: string;
  coverUrl: string | null;
  rating?: number | null;
  status?: string;
}

const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Isekai',
  'Mecha', 'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
  'Supernatural', 'Thriller',
];
const RECENT_KEY = 'mangaverse_recent_searches';

function typeIcon(type?: string): string {
  switch ((type || '').toUpperCase()) {
    case 'MANHWA': return '🇰🇷';
    case 'MANHUA': return '🇨🇳';
    case 'LIGHT_NOVEL': return '📕';
    default: return '📖';
  }
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) return JSON.parse(raw).slice(0, 5);
  } catch {
    // ignore
  }
  return [];
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const { data: trending } = useTrendingTitles();

  const trendingList = (trending || []).slice(0, 7);
  const q = query.trim();
  const flatList = q ? results : trendingList;
  const genreMatches = q
    ? GENRES.filter((g) => g.toLowerCase().includes(q.toLowerCase())).slice(0, 3)
    : [];

  // Load recents + focus + remember focus target on open
  useEffect(() => {
    if (open) {
      setRecent(loadRecent());
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Debounced live search
  useEffect(() => {
    if (!open) return;
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.get<{ items: SearchHit[] }>(`/titles?search=${encodeURIComponent(q)}&limit=8`);
        setResults(data.items || []);
      } catch {
        setResults([]);
      }
      setSearching(false);
      setActiveIndex(0);
    }, 220);
    return () => clearTimeout(timer);
  }, [q, open]);

  // Escape + focus trap + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  const go = (slug: string) => {
    if (q) {
      const next = [q, ...recent.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 5);
      setRecent(next);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
    }
    onClose();
    router.push(`/title/${slug}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const listLen = flatList.length + genreMatches.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, listLen - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (genreMatches.length > 0 && activeIndex < genreMatches.length) {
        onClose();
        router.push(`/browse?genres=${genreMatches[activeIndex].toLowerCase().replace(/\s+/g, '_')}`);
        return;
      }
      const hit = flatList[activeIndex - genreMatches.length];
      if (hit) go(hit.slug);
    } else if (e.key === 'Tab') {
      // Basic focus trap: keep focus inside the dialog
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input');
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (!open) return null;

  const showGenreSection = genreMatches.length > 0;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-black/70 p-4 pt-[12vh] backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-mv-border bg-mv-darker shadow-modal animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search titles, authors, genres"
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-mv-border px-4">
          <Icon name="search" size={20} className="shrink-0 text-mv-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search titles & genres…"
            aria-label="Search"
            className="h-14 w-full bg-transparent text-sm text-mv-text outline-none placeholder:text-mv-text-dim"
          />
          {searching && <Spinner size={16} className="shrink-0 text-mv-violet" />}
          <button
            onClick={onClose}
            className="shrink-0 rounded-md border border-mv-border px-1.5 py-0.5 text-[9px] text-mv-text-dim transition-colors hover:text-mv-text"
          >
            ESC
          </button>
        </div>

        <div className="max-h-[46vh] overflow-y-auto p-2">
          {/* ── Empty state: recent + trending + genres ── */}
          {!q && (
            <>
              {recent.length > 0 && (
                <div className="px-3 pb-2 pt-2">
                  <p className="pb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">Recent</p>
                  <div className="flex flex-wrap gap-1.5">
                    {recent.map((term) => (
                      <button
                        key={term}
                        onClick={() => {
                          setQuery(term);
                          inputRef.current?.focus();
                        }}
                        className="flex items-center gap-1.5 rounded-full border border-mv-border-light bg-mv-surface/60 px-3 py-1 text-[11px] text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
                      >
                        <Icon name="history" size={12} />
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="px-3 pb-1.5 pt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">
                Trending now
              </p>
              {trendingList.map((hit, i) => (
                <PaletteRow key={hit.id} hit={hit} active={i === activeIndex} onSelect={() => go(hit.slug)} onHover={() => setActiveIndex(i)} />
              ))}

              <div className="px-3 pb-2 pt-3">
                <p className="pb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">Browse genres</p>
                <div className="flex flex-wrap gap-1.5">
                  {GENRES.slice(0, 8).map((g) => (
                    <button
                      key={g}
                      onClick={() => {
                        onClose();
                        router.push(`/browse?genres=${g.toLowerCase().replace(/\s+/g, '_')}`);
                      }}
                      className="rounded-full border border-mv-border-light bg-mv-surface/60 px-3 py-1 text-[11px] text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Query state: genre matches + results ── */}
          {q && (
            <>
              {showGenreSection && (
                <p className="px-3 pb-1.5 pt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">Genres</p>
              )}
              {genreMatches.map((g, i) => (
                <button
                  key={g}
                  onClick={() => {
                    onClose();
                    router.push(`/browse?genres=${g.toLowerCase().replace(/\s+/g, '_')}`);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                    activeIndex === i ? 'bg-mv-accent/15' : 'hover:bg-white/5',
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mv-accent/15 text-sm">🏷️</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-mv-text">{g}</span>
                    <span className="text-[10px] text-mv-text-muted">Browse all {g} titles</span>
                  </span>
                </button>
              ))}

              <p className="px-3 pb-1.5 pt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">
                {searching ? 'Searching…' : results.length > 0 ? 'Titles' : 'No titles found'}
              </p>

              {!searching && results.length === 0 && (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-mv-text-muted">
                    Nothing found for “{q}”
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      router.push(`/browse?search=${encodeURIComponent(q)}`);
                    }}
                    className="mt-3 rounded-full bg-mv-accent/15 px-4 py-1.5 text-[11px] font-medium text-mv-violet transition-colors hover:bg-mv-accent/25"
                  >
                    Search all of Browse →
                  </button>
                </div>
              )}

              {results.map((hit, i) => {
                const idx = genreMatches.length + i;
                return <PaletteRow key={hit.id} hit={hit} active={activeIndex === idx} onSelect={() => go(hit.slug)} onHover={() => setActiveIndex(idx)} />;
              })}
            </>
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 border-t border-mv-border px-4 py-2.5 text-[9px] text-mv-text-dim">
          <span><Kbd>↑↓</Kbd> navigate</span>
          <span><Kbd>↵</Kbd> open</span>
          <span><Kbd>esc</Kbd> close</span>
          <Link href="/browse" onClick={onClose} className="ml-auto font-medium text-mv-violet transition-colors hover:text-mv-violet/80">
            Advanced search →
          </Link>
        </div>
      </div>
    </div>
  );
}

function PaletteRow({
  hit,
  active,
  onSelect,
  onHover,
}: {
  hit: SearchHit;
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
        active ? 'bg-mv-accent/15' : 'hover:bg-white/5',
      )}
    >
      <span className="flex h-11 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-mv-surface text-sm">
        {hit.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hit.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          typeIcon(hit.type)
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-mv-text">{hit.title}</span>
        <span className="mt-0.5 flex items-center gap-2 text-[10px] text-mv-text-muted">
          <span>{typeIcon(hit.type)} {hit.type?.replace(/_/g, ' ')}</span>
          {hit.rating ? <span className="text-mv-gold">★ {hit.rating.toFixed(1)}</span> : null}
        </span>
      </span>
      <Icon name="chevronRight" size={14} className="shrink-0 text-mv-text-dim" />
    </button>
  );
}

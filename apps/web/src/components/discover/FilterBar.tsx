'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { FORMAT_OPTIONS, STATUS_OPTIONS, SORT_OPTIONS, toDbGenre, genreDisplayLabel, type FilterState } from './utils';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   FilterBar — the advanced filter system for the Discovery Hub.
   Every control is URL-synced (the browse page owns the URL) so
   filter sets are shareable and deep-linkable. Genre counts come
   live from /api/titles/genres so choices show real numbers.
   ═══════════════════════════════════════════════════════════════ */

interface FilterBarProps {
  filters: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  genreCounts: { genre: string; count: number }[];
  resultCount: number;
}

export function FilterBar({ filters, onChange, genreCounts, resultCount }: FilterBarProps) {
  const [genreOpen, setGenreOpen] = useState(false);
  const [genreQuery, setGenreQuery] = useState('');
  const genreRef = useRef<HTMLDivElement>(null);

  // ── Debounced writes for the continuous controls (year + rating).
  //    Local state keeps the UI instant while dragging/typing; the URL (and
  //    therefore the results query) only commits after the value settles, so
  //    we don't hammer the router with a replace per slider tick/keystroke.
  const [local, setLocal] = useState({ yearFrom: filters.yearFrom, yearTo: filters.yearTo, minRating: filters.minRating });
  useEffect(() => {
    setLocal({ yearFrom: filters.yearFrom, yearTo: filters.yearTo, minRating: filters.minRating });
  }, [filters.yearFrom, filters.yearTo, filters.minRating]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (local.yearFrom !== filters.yearFrom || local.yearTo !== filters.yearTo || local.minRating !== filters.minRating) {
        onChange({ yearFrom: local.yearFrom, yearTo: local.yearTo, minRating: local.minRating });
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  // Close genre popover on outside click / escape
  useEffect(() => {
    if (!genreOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!genreRef.current?.contains(e.target as Node)) setGenreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setGenreOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [genreOpen]);

  const countsMap = new Map(genreCounts.map((g) => [toDbGenre(g.genre), g.count]));
  const allGenres = genreCounts.length > 0
    ? [...genreCounts].sort((a, b) => b.count - a.count).map((g) => toDbGenre(g.genre))
    : [];
  const visibleGenres = genreQuery
    ? allGenres.filter((g) => genreDisplayLabel(g).toLowerCase().includes(genreQuery.toLowerCase()))
    : allGenres;

  const toggleGenre = (g: string) => {
    onChange({
      genres: filters.genres.includes(g) ? filters.genres.filter((x) => x !== g) : [...filters.genres, g],
    });
  };

  const activeCount = filters.genres.length;

  return (
    <div className="space-y-3">
      {/* ── Control row ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {/* Format */}
        <div className="flex items-center gap-1.5">
          <span className="eyebrow shrink-0">Format</span>
          <div className="flex flex-wrap gap-1">
            {FORMAT_OPTIONS.map((f) => (
              <button
                key={f.value || 'all'}
                onClick={() => onChange({ type: f.value })}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[10px] transition-all duration-200',
                  filters.type === f.value
                    ? 'bg-gradient-to-r from-mv-purple to-mv-accent font-medium text-white shadow-glow-sm'
                    : 'bg-white/[0.04] text-mv-text-secondary hover:bg-white/[0.08] hover:text-mv-text',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-1.5">
          <span className="eyebrow shrink-0">Status</span>
          <div className="flex flex-wrap gap-1">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value || 'any'}
                onClick={() => onChange({ status: s.value })}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[10px] transition-all duration-200',
                  filters.status === s.value
                    ? 'bg-gradient-to-r from-mv-purple to-mv-accent font-medium text-white shadow-glow-sm'
                    : 'bg-white/[0.04] text-mv-text-secondary hover:bg-white/[0.08] hover:text-mv-text',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Genre multi-select */}
        <div className="relative" ref={genreRef}>
          <button
            onClick={() => setGenreOpen((o) => !o)}
            aria-expanded={genreOpen}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] transition-colors',
              activeCount > 0
                ? 'border border-mv-violet/30 bg-mv-violet/15 text-mv-violet'
                : 'bg-white/[0.04] text-mv-text-secondary hover:bg-white/[0.08] hover:text-mv-text',
            )}
          >
            <Icon name="filter" size={12} />
            Genres{activeCount > 0 ? ` (${activeCount})` : ''}
            <Icon name="chevronDown" size={11} className={cn('transition-transform', genreOpen && 'rotate-180')} />
          </button>

          {genreOpen && (
            <div className="glass absolute left-0 top-full z-40 mt-2 w-[min(18rem,calc(100vw-2.5rem))] rounded-2xl p-3 shadow-modal animate-scale-in">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold text-mv-text">Filter by genre</p>
                {activeCount > 0 && (
                  <button onClick={() => onChange({ genres: [] })} className="text-[9px] text-mv-text-dim hover:text-mv-violet">
                    Clear
                  </button>
                )}
              </div>
              <input
                value={genreQuery}
                onChange={(e) => setGenreQuery(e.target.value)}
                placeholder="Search genres…"
                aria-label="Search genres"
                className="field mb-2 h-8 px-2.5! text-[11px]"
              />
              {visibleGenres.length === 0 ? (
                <p className="px-2 py-4 text-center text-[10px] text-mv-text-dim">No matching genres</p>
              ) : (
                <div className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
                  {visibleGenres.map((g) => {
                    const selected = filters.genres.includes(g);
                    return (
                      <button
                        key={g}
                        onClick={() => toggleGenre(g)}
                        aria-pressed={selected}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] transition-colors',
                          selected ? 'bg-mv-accent/15 text-mv-violet' : 'text-mv-text-secondary hover:bg-white/5 hover:text-mv-text',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors',
                            selected ? 'border-mv-violet bg-mv-violet' : 'border-mv-border-light',
                          )}
                        >
                          {selected && <Icon name="check" size={10} className="text-white" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{genreDisplayLabel(g)}</span>
                        <span className="shrink-0 text-[9px] text-mv-text-dim">{countsMap.get(g) ?? ''}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {filters.genres.length > 1 && (
                <p className="mt-2 border-t border-mv-border pt-2 text-[9px] text-mv-text-dim">Titles match <span className="text-mv-violet">all</span> selected genres</p>
              )}
            </div>
          )}
        </div>

        {/* Year range */}
        <div className="flex items-center gap-1.5">
          <span className="eyebrow shrink-0">Year</span>
          <input
            type="number"
            min={1900}
            max={2100}
            value={local.yearFrom ?? ''}
            onChange={(e) => setLocal((p) => ({ ...p, yearFrom: e.target.value ? Number(e.target.value) : null }))}
            onBlur={() => onChange({ yearFrom: local.yearFrom })}
            placeholder="From"
            aria-label="Release year from"
            className="field h-8 w-[68px] px-2.5! text-[11px]"
          />
          <span className="text-[10px] text-mv-text-dim">–</span>
          <input
            type="number"
            min={1900}
            max={2100}
            value={local.yearTo ?? ''}
            onChange={(e) => setLocal((p) => ({ ...p, yearTo: e.target.value ? Number(e.target.value) : null }))}
            onBlur={() => onChange({ yearTo: local.yearTo })}
            placeholder="To"
            aria-label="Release year to"
            className="field h-8 w-[68px] px-2.5! text-[11px]"
          />
        </div>

        {/* Min rating */}
        <div className="flex items-center gap-2">
          <span className="eyebrow shrink-0">Rating</span>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={local.minRating ?? 0}
            onChange={(e) => setLocal((p) => ({ ...p, minRating: Number(e.target.value) > 0 ? Number(e.target.value) : null }))}
            onPointerUp={() => onChange({ minRating: local.minRating })}
            aria-label="Minimum rating"
            className="h-1.5 w-28 accent-mv-violet"
          />
          <button
            onClick={() => { setLocal((p) => ({ ...p, minRating: null })); onChange({ minRating: null }); }}
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] transition-colors',
              local.minRating != null
                ? 'bg-mv-violet/15 font-medium text-mv-violet hover:bg-mv-violet/25'
                : 'text-mv-text-dim hover:text-mv-text-secondary',
            )}
          >
            {local.minRating != null ? `${local.minRating.toFixed(1)}★` : 'Any'}
          </button>
        </div>

        {/* Sort */}
        <select
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value })}
          aria-label="Sort results"
          className="ml-auto rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-mv-text outline-none transition-all focus:border-mv-violet/50"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* ── Active chips + count ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {filters.type && (
          <Chip onClear={() => onChange({ type: '' })}>{FORMAT_OPTIONS.find((f) => f.value === filters.type)?.label ?? filters.type}</Chip>
        )}
        {filters.status && (
          <Chip onClear={() => onChange({ status: '' })}>{STATUS_OPTIONS.find((s) => s.value === filters.status)?.label ?? filters.status}</Chip>
        )}
        {filters.genres.map((g) => (
          <Chip key={g} onClear={() => toggleGenre(g)}>{genreDisplayLabel(g)}</Chip>
        ))}
        {filters.yearFrom != null && (
          <Chip onClear={() => onChange({ yearFrom: null })}>≥ {filters.yearFrom}</Chip>
        )}
        {filters.yearTo != null && (
          <Chip onClear={() => onChange({ yearTo: null })}>≤ {filters.yearTo}</Chip>
        )}
        {filters.minRating != null && (
          <Chip onClear={() => onChange({ minRating: null })}>★ {filters.minRating.toFixed(1)}+</Chip>
        )}
        {filters.search.trim() && (
          <Chip onClear={() => onChange({ search: '' })}>“{filters.search.trim()}”</Chip>
        )}
        <span className="ml-auto text-[10px] text-mv-text-dim">
          <span className="font-medium text-mv-violet">{resultCount.toLocaleString()}</span> titles
        </span>
      </div>
    </div>
  );
}

function Chip({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-mv-violet/25 bg-mv-violet/10 px-2 py-0.5 text-[9px] text-mv-violet">
      {children}
      <button onClick={onClear} aria-label={`Remove ${typeof children === 'string' ? children : 'filter'}`} className="rounded-full p-0.5 transition-colors hover:bg-white/10 hover:text-white">
        <Icon name="close" size={9} />
      </button>
    </span>
  );
}

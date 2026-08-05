'use client';

import { GENRES_META, genreLabel, type GenreMeta } from '@/components/home/types';

/* ═══════════════════════════════════════════════════════════════
   Discover utilities — Phase 6.
   The catalog stores genres in DB slug form (e.g. `sci_fi`, with an
   underscore), while the design metadata uses display slugs
   (`sci-fi`, hyphen). These helpers bridge the two so genre pages,
   the filter bar, and the genre grid all agree on keys.
   ═══════════════════════════════════════════════════════════════ */

/** Canonical DB form: `sci-fi` → `sci_fi`, `Slice of Life` → `slice_of_life`. */
export function toDbGenre(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

/** Design-display form: `sci_fi` → `sci-fi` (matches GENRES_META keys). */
export function toDisplayGenre(slug: string): string {
  return slug.trim().toLowerCase().replace(/_/g, '-');
}

/** Look up genre metadata, accepting either slug form (falls back gracefully). */
export function genreMetaFor(slug: string): GenreMeta {
  const display = toDisplayGenre(slug);
  const found = GENRES_META.find((g) => g.key === display || toDbGenre(g.key) === slug);
  if (found) return found;
  // Second pass: some DB genres (cultivation, psychological, …) have no card —
  // synthesize a neutral one instead of rendering broken styling.
  const label = genreLabel(display).replace(/_/g, ' ');
  return {
    key: toDbGenre(slug),
    label,
    emoji: '📚',
    blurb: `Stories filed under ${label}.`,
    accent: 'from-violet-500/30 to-purple-500/10',
    glow: 'rgba(139,92,246,0.35)',
  };
}

/** Pretty label for a genre slug in either form. */
export function genreDisplayLabel(slug: string): string {
  return genreLabel(toDisplayGenre(slug)).replace(/_/g, ' ');
}

// ─── Curated collections ────────────────────────────────
// Honest, API-backed definitions: each maps to real /browse filters.

export interface CollectionDef {
  id: string;
  title: string;
  emoji: string;
  blurb: string;
  query: string; // browse query string
  chips: string[];
  accent: string; // tailwind gradient stops
}

export const COLLECTIONS: CollectionDef[] = [
  {
    id: 'masterpieces',
    title: 'Completed Masterpieces',
    emoji: '🏆',
    blurb: 'Finished series with the highest community ratings — no cliffhangers, all payoff.',
    query: '?status=completed&sort=rating',
    chips: ['Completed', 'Top rated'],
    accent: 'from-amber-500/30 to-yellow-500/10',
  },
  {
    id: 'trending',
    title: 'Trending Now',
    emoji: '🔥',
    blurb: 'What the whole community is reading this week.',
    query: '?sort=trending',
    chips: ['Trending'],
    accent: 'from-rose-500/30 to-orange-500/10',
  },
  {
    id: 'top-rated',
    title: 'Critically Acclaimed',
    emoji: '⭐',
    blurb: 'Series rated 8.0+ by readers. The canon of great manga.',
    query: '?sort=rating&minRating=8',
    chips: ['Rating 8+', 'Top rated'],
    accent: 'from-violet-500/30 to-purple-500/10',
  },
  {
    id: 'bookmarked',
    title: 'Most Bookmarked',
    emoji: '🔖',
    blurb: 'The titles readers save and return to most.',
    query: '?sort=bookmarks',
    chips: ['Bookmarks'],
    accent: 'from-pink-500/30 to-rose-500/10',
  },
  {
    id: 'fresh',
    title: 'Fresh Updates',
    emoji: '🆕',
    blurb: 'Recently updated series with new chapters just dropped.',
    query: '?sort=updated',
    chips: ['Recently updated'],
    accent: 'from-emerald-500/30 to-teal-500/10',
  },
  {
    id: 'new',
    title: 'New Releases',
    emoji: '🎉',
    blurb: 'Brand-new series joining the catalog.',
    query: '?sort=newest',
    chips: ['Newest'],
    accent: 'from-sky-500/30 to-blue-500/10',
  },
  {
    id: 'action',
    title: 'Action Binge',
    emoji: '⚔️',
    blurb: 'High-octane fights and stakes, ranked by saves.',
    query: '?genres=action&sort=bookmarks',
    chips: ['Action', 'Bookmarks'],
    accent: 'from-red-500/30 to-rose-500/10',
  },
  {
    id: 'romance',
    title: 'Romance Picks',
    emoji: '💕',
    blurb: 'Slow burns and stolen glances, highest rated.',
    query: '?genres=romance&sort=rating',
    chips: ['Romance', 'Top rated'],
    accent: 'from-fuchsia-500/30 to-pink-500/10',
  },
];

// ─── Filter state (URL-synced) ─────────────────────────

export interface FilterState {
  search: string;
  genres: string[]; // DB-form slugs (e.g. `sci_fi`)
  type: string;
  status: string;
  yearFrom: number | null;
  yearTo: number | null;
  minRating: number | null;
  sort: string;
}

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  genres: [],
  type: '',
  status: '',
  yearFrom: null,
  yearTo: null,
  minRating: null,
  sort: 'trending',
};

/** True when any non-default filter or search is active. */
export function filtersActive(f: FilterState): boolean {
  return f.search.trim().length > 0 || f.genres.length > 0 || f.type !== '' || f.status !== '' || f.yearFrom != null || f.yearTo != null || f.minRating != null || f.sort !== 'trending';
}

/** Parse a URLSearchParams object into a FilterState (tolerant of both `format` and `type`). */
export function filtersFromParams(params: URLSearchParams): FilterState {
  const genreParam = params.get('genres') || '';
  return {
    search: params.get('search') || '',
    genres: genreParam.split(',').map((g) => g.trim()).filter(Boolean),
    type: params.get('type') || params.get('format') || '',
    status: params.get('status') || '',
    yearFrom: params.get('yearFrom') ? Number(params.get('yearFrom')) : null,
    yearTo: params.get('yearTo') ? Number(params.get('yearTo')) : null,
    minRating: params.get('minRating') != null ? Number(params.get('minRating')) : null,
    sort: params.get('sort') || 'trending',
  };
}

/** Serialize a FilterState into a browse query string (without leading `?`). */
export function filtersToQuery(f: FilterState): string {
  const p = new URLSearchParams();
  if (f.search.trim()) p.set('search', f.search.trim());
  if (f.genres.length > 0) p.set('genres', f.genres.join(','));
  if (f.type) p.set('type', f.type);
  if (f.status) p.set('status', f.status);
  if (f.yearFrom != null) p.set('yearFrom', String(f.yearFrom));
  if (f.yearTo != null) p.set('yearTo', String(f.yearTo));
  if (f.minRating != null) p.set('minRating', String(f.minRating));
  if (f.sort !== 'trending') p.set('sort', f.sort);
  return p.toString();
}

// ─── Sort options ───────────────────────────────────────

export const SORT_OPTIONS = [
  { value: 'trending', label: 'Trending' },
  { value: 'bookmarks', label: 'Most Bookmarked' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'updated', label: 'Recently Updated' },
  { value: 'newest', label: 'Newest' },
  { value: 'title', label: 'A–Z' },
] as const;

export const FORMAT_OPTIONS = [
  { value: '', label: 'All formats' },
  { value: 'manga', label: 'Manga' },
  { value: 'manhwa', label: 'Manhwa' },
  { value: 'manhua', label: 'Manhua' },
  { value: 'light_novel', label: 'Light Novel' },
] as const;

export const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'hiatus', label: 'Hiatus' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

'use client';

import type { TitleListItem } from '@/lib/hooks/useTitles';

/* ═══════════════════════════════════════════════════════════════
   Home / Discovery shared types & helpers.
   A single place for the resume map (per-series reading progress),
   reading-time estimates, and the curated genre explorer metadata.
   ═══════════════════════════════════════════════════════════════ */

export type HomeTitle = TitleListItem;

/** Per-series resume info derived from /reading/progress. */
export interface ResumeInfo {
  seriesId: string;
  title: string;
  slug: string;
  type?: string;
  coverUrl: string | null;
  chapterId: string;
  chapterNumber: number;
  /** 0–100 across the current chapter. */
  pct: number;
  /** Completed chapter at or past the current one. */
  completed: boolean;
  lastReadAt?: string;
  /** Pages into the chapter (for ETA math). */
  pageNumber: number;
  pageCount: number | null;
}

interface ProgressEntry {
  chapter: {
    id: string;
    number: number;
    pageCount: number | null;
    series: { id: string; slug: string; title: string; coverUrl: string | null; type?: string };
  };
  pageNumber: number;
  completed: boolean;
  updatedAt?: string;
}

/**
 * Latest in-progress (or most recent) chapter per series, keyed by series id.
 * Feeds the hero progress-aware CTA, Continue Reading, and card overlays.
 */
export function buildResumeMap(data: ProgressEntry[] | undefined): Map<string, ResumeInfo> {
  const map = new Map<string, ResumeInfo>();
  (data ?? []).forEach((entry) => {
    const series = entry?.chapter?.series;
    if (!series) return;
    const existing = map.get(series.id);
    if (existing && entry.chapter.number < existing.chapterNumber) return;
    const pageCount = entry.chapter.pageCount;
    const pct = entry.completed
      ? 100
      : entry.pageNumber && pageCount
        ? Math.min(100, Math.round((entry.pageNumber / pageCount) * 100))
        : 0;
    map.set(series.id, {
      seriesId: series.id,
      title: series.title,
      slug: series.slug,
      type: series.type,
      coverUrl: series.coverUrl ?? null,
      chapterId: entry.chapter.id,
      chapterNumber: entry.chapter.number,
      pct,
      completed: entry.completed,
      lastReadAt: entry.updatedAt,
      pageNumber: entry.pageNumber,
      pageCount,
    });
  });
  return map;
}

/** Rough remaining reading time for the current chapter (in minutes).
 *  Estimates use seconds-per-page (LN prose is slower), then convert to
 *  minutes so the caller can format directly. */
export function estimateMinutesLeft(info: ResumeInfo): number | null {
  if (info.completed || !info.pageCount) return null;
  const remaining = Math.max(0, info.pageCount - info.pageNumber);
  if (remaining === 0) return null;
  const secPerPage = (info.type || '').toUpperCase() === 'LIGHT_NOVEL' ? 150 : 75;
  return Math.max(1, Math.round((remaining * secPerPage) / 60));
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `≈ ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `≈ ${h}h ${m}m` : `≈ ${h}h`;
}

/* ─── Genre explorer metadata ──────────────────────────── */

export interface GenreMeta {
  key: string;
  label: string;
  emoji: string;
  blurb: string;
  accent: string; // tailwind gradient stops
  glow: string; // rgba glow color
}

export const GENRES_META: GenreMeta[] = [
  { key: 'action', label: 'Action', emoji: '⚔️', blurb: 'Fights, stakes, and adrenaline.', accent: 'from-rose-500/30 to-orange-500/10', glow: 'rgba(244,63,94,0.35)' },
  { key: 'adventure', label: 'Adventure', emoji: '🏔️', blurb: 'Journeys into the unknown.', accent: 'from-emerald-500/30 to-teal-500/10', glow: 'rgba(16,185,129,0.35)' },
  { key: 'fantasy', label: 'Fantasy', emoji: '🧙', blurb: 'Magic, monsters & other worlds.', accent: 'from-violet-500/30 to-purple-500/10', glow: 'rgba(139,92,246,0.4)' },
  { key: 'romance', label: 'Romance', emoji: '💕', blurb: 'Slow burns & stolen glances.', accent: 'from-pink-500/30 to-rose-500/10', glow: 'rgba(236,72,153,0.35)' },
  { key: 'isekai', label: 'Isekai', emoji: '🌌', blurb: 'Reincarnated into new worlds.', accent: 'from-indigo-500/30 to-violet-500/10', glow: 'rgba(99,102,241,0.4)' },
  { key: 'comedy', label: 'Comedy', emoji: '😂', blurb: 'Gags, chaos & wholesome laughs.', accent: 'from-amber-500/30 to-yellow-500/10', glow: 'rgba(245,158,11,0.35)' },
  { key: 'thriller', label: 'Thriller', emoji: '🔪', blurb: 'Twists that keep you up.', accent: 'from-slate-500/30 to-zinc-500/10', glow: 'rgba(148,163,184,0.35)' },
  { key: 'sci-fi', label: 'Sci-Fi', emoji: '🚀', blurb: 'Futures, tech & the far beyond.', accent: 'from-cyan-500/30 to-blue-500/10', glow: 'rgba(34,211,238,0.35)' },
  { key: 'horror', label: 'Horror', emoji: '👻', blurb: 'Dread, gore & the uncanny.', accent: 'from-red-900/40 to-zinc-900/20', glow: 'rgba(239,68,68,0.35)' },
  { key: 'drama', label: 'Drama', emoji: '🎭', blurb: 'Emotional weight & hard choices.', accent: 'from-fuchsia-500/30 to-pink-500/10', glow: 'rgba(217,70,239,0.35)' },
  { key: 'slice_of_life', label: 'Slice of Life', emoji: '☕', blurb: 'Quiet days, real feelings.', accent: 'from-orange-400/25 to-amber-300/10', glow: 'rgba(251,146,60,0.35)' },
  { key: 'mystery', label: 'Mystery', emoji: '🔍', blurb: 'Puzzles, secrets & reveals.', accent: 'from-sky-500/30 to-indigo-500/10', glow: 'rgba(14,165,233,0.35)' },
  { key: 'mecha', label: 'Mecha', emoji: '🤖', blurb: 'Machines, pilots & war.', accent: 'from-blue-600/30 to-cyan-500/10', glow: 'rgba(37,99,235,0.4)' },
  { key: 'supernatural', label: 'Supernatural', emoji: '👁️', blurb: 'Beyond the veil of reality.', accent: 'from-purple-500/30 to-fuchsia-500/10', glow: 'rgba(168,85,247,0.4)' },
  { key: 'sports', label: 'Sports', emoji: '🏀', blurb: 'Underdogs & final plays.', accent: 'from-green-500/30 to-lime-500/10', glow: 'rgba(34,197,94,0.35)' },
];

/** Look up genre display label from a slug. */
export function genreLabel(key: string): string {
  return GENRES_META.find((g) => g.key === key)?.label ?? key.replace(/_/g, ' ');
}

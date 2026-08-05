'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useReadingProgress } from '@/lib/hooks/useReading';
import { useAuthStore } from '@/store/authStore';
import { CoverImage } from '@/components/CoverImage';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   ContinueReading — the reader shortcut engine for the shell.
   `useResumeData` derives the latest chapter + progress per series
   from reading progress; the <ContinueReading> list renders it in
   the expanded sidebar (and powers the mobile resume pill).
   ═══════════════════════════════════════════════════════════════ */

export interface ResumeEntry {
  titleId: string;
  title: string;
  slug: string;
  type?: string;
  coverUrl: string | null;
  chapterId: string;
  chapterNumber: number;
  pct: number;
}

export function useResumeData(limit?: number): { entries: ResumeEntry[]; latest: ResumeEntry | null } {
  const { token } = useAuthStore();
  const { data } = useReadingProgress(!!token);

  return useMemo(() => {
    const bySeries = new Map<string, ResumeEntry & { lastTouched: number }>();
    const entriesData = (data ?? []) as any[];
    entriesData.forEach((entry: any) => {
      const series = entry?.chapter?.series;
      if (!series) return;
      const existing = bySeries.get(series.id);
      // Keep the highest chapter per series (most recent position).
      if (existing && entry.chapter.number <= existing.chapterNumber) return;
      const pageCount = entry.chapter?.pageCount || 20;
      const pct = entry.completed
        ? 100
        : entry.pageNumber
          ? Math.min(100, Math.round((entry.pageNumber / pageCount) * 100))
          : 0;
      bySeries.set(series.id, {
        titleId: series.id,
        title: series.title,
        slug: series.slug,
        type: series.type,
        coverUrl: series.coverUrl ?? null,
        chapterId: entry.chapter.id,
        chapterNumber: entry.chapter.number,
        pct,
        lastTouched: entry.updatedAt ? new Date(entry.updatedAt).getTime() : entry.chapter.number,
      });
    });

    const all = [...bySeries.values()].sort((a, b) => b.lastTouched - a.lastTouched);
    const inProgress = all.filter((e) => e.pct > 0 && e.pct < 100);
    const list = (inProgress.length > 0 ? inProgress : all).slice(0, limit);
    return { entries: list, latest: list[0] ?? null };
  }, [data, limit]);
}

export interface ContinueReadingProps {
  /** Items to render (from useResumeData). */
  entries: ResumeEntry[];
  /** Number of items to show. */
  limit?: number;
  className?: string;
}

export function ContinueReading({ entries, limit = 3, className }: ContinueReadingProps) {
  const items = entries.slice(0, limit);
  if (items.length === 0) return null;

  return (
    <div className={cn('space-y-1', className)}>
      {items.map((entry) => (
        <Link
          key={entry.titleId}
          href={`/reader/${entry.chapterId}`}
          className="group/recent flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/5"
        >
          <div className="relative h-9 w-7 shrink-0 overflow-hidden rounded-md bg-mv-surface">
            <CoverImage src={entry.coverUrl} title={entry.title} type={entry.type} className="h-full w-full" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium text-mv-text-secondary transition-colors group-hover/recent:text-mv-text">
              {entry.title}
            </p>
            <p className="text-[9px] text-mv-text-muted">Ch. {entry.chapterNumber} · {entry.pct}%</p>
          </div>
          <Icon name="play" size={12} className="shrink-0 text-mv-violet opacity-0 transition-opacity group-hover/recent:opacity-100" />
        </Link>
      ))}
    </div>
  );
}

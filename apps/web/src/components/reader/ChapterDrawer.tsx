'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useChapters } from '@/lib/hooks/useChapters';
import { useReadingProgress } from '@/lib/hooks/useReading';
import { useAuthStore } from '@/store/authStore';
import { enqueueDownload, removeDownload, cancelDownload, useDownloads } from '@/lib/downloads';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   ChapterDrawer — the real chapter browser inside the reader.
   Fetches the full chapter list for the series, highlights the
   current one, marks read/locked states, searches, and jumps
   instantly. Replaces the old "page picker".
   ═══════════════════════════════════════════════════════════════ */

interface ChapterDrawerProps {
  open: boolean;
  onClose: () => void;
  seriesSlug: string;
  seriesTitle: string;
  seriesTitleId: string;
  coverUrl: string | null;
  currentChapterId: string;
}

export function ChapterDrawer({ open, onClose, seriesSlug, seriesTitle, seriesTitleId, coverUrl, currentChapterId }: ChapterDrawerProps) {
  const router = useRouter();
  const { token } = useAuthStore();
  const [query, setQuery] = useState('');
  const { data } = useChapters(undefined, seriesSlug, { page: 1, limit: 100 });
  const { data: progressData } = useReadingProgress(!!token);
  const downloads = useDownloads();

  // chapterId → completed (for read marks)
  const readMap = useMemo(() => {
    const map = new Map<string, boolean>();
    ((progressData ?? []) as any[]).forEach((e) => {
      if (e?.chapter?.id && e.completed) map.set(e.chapter.id, true);
    });
    return map;
  }, [progressData]);

  const chapters = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (data?.items ?? []).filter(
      (c) => !q || String(c.number).includes(q) || (c.title ?? '').toLowerCase().includes(q),
    );
    // newest first (API default)
    return list;
  }, [data, query]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="absolute inset-y-0 right-0 z-40 flex w-[min(90vw,22rem)] flex-col border-l border-mv-border-light bg-mv-darker/97 shadow-modal backdrop-blur-xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-mv-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-white">{seriesTitle}</p>
          <p className="text-[9px] text-mv-text-muted">{data?.total ?? '…'} chapters</p>
        </div>
        <button onClick={onClose} aria-label="Close chapter list" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-mv-text-muted transition-colors hover:bg-white/5 hover:text-white">
          <Icon name="close" size={15} />
        </button>
      </div>

      {/* Search */}
      <div className="border-b border-mv-border px-3 py-2">
        <div className="relative">
          <Icon name="search" size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-mv-text-dim" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find chapter…"
            aria-label="Search chapters"
            className="field py-1.5 pl-8 pr-2 text-[10px]"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {chapters.length === 0 ? (
          <p className="px-3 py-8 text-center text-[11px] text-mv-text-muted">No chapters match “{query}”.</p>
        ) : (
          <div className="space-y-0.5">
            {chapters.map((ch) => {
              const isCurrent = ch.id === currentChapterId;
              const isRead = readMap.has(ch.id);
              const dl = downloads.find((d) => d.chapterId === ch.id);
              const dlBusy = dl?.status === 'queued' || dl?.status === 'downloading';
              const dlDone = !!dl && !dlBusy;
              return (
                <div
                  key={ch.id}
                  className={cn(
                    'group/ch flex items-center gap-1 rounded-lg pl-1 pr-1.5 transition-colors',
                    isCurrent ? 'bg-mv-accent/20' : 'hover:bg-white/5',
                  )}
                >
                  <button
                    onClick={() => {
                      onClose();
                      router.push(`/reader/${ch.id}`);
                    }}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-2 pl-2 text-left transition-colors',
                      isCurrent ? 'text-mv-accent' : 'text-mv-text-secondary hover:text-white',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px]',
                        isRead ? 'border-mv-success/50 bg-mv-success/15 text-mv-success' : 'border-mv-border-light text-mv-text-dim',
                      )}
                    >
                      {isRead ? <Icon name="check" size={10} strokeWidth={3} /> : <span>{ch.number}</span>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-medium">Chapter {ch.number}</span>
                      {ch.title && <span className="block truncate text-[9px] text-mv-text-dim">{ch.title}</span>}
                    </span>
                    {ch.coinLocked && !isRead && <Icon name="lock" size={11} className="shrink-0 text-mv-warning" />}
                    {isCurrent && <Icon name="chevronRight" size={12} className="shrink-0 text-mv-accent" />}
                  </button>
                  <button
                    onClick={() => {
                      if (dlBusy) {
                        cancelDownload(ch.id);
                      } else if (dl) {
                        void removeDownload(ch.id);
                      } else {
                        enqueueDownload({
                          chapterId: ch.id,
                          titleId: seriesTitleId,
                          seriesSlug,
                          seriesTitle,
                          coverUrl,
                          chapterNumber: ch.number,
                          chapterTitle: ch.title,
                        });
                      }
                    }}
                    aria-label={dlBusy ? `Cancel download of chapter ${ch.number}` : dlDone ? `Remove offline copy of chapter ${ch.number}` : `Download chapter ${ch.number} for offline`}
                    title={dlBusy ? 'Cancel download' : dlDone ? 'Downloaded — tap to remove' : 'Download for offline'}
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors',
                      dlBusy
                        ? 'text-mv-warning'
                        : dlDone
                          ? 'text-mv-accent'
                          : 'text-mv-text-dim opacity-0 hover:text-mv-text focus-visible:opacity-100 group-hover/ch:opacity-100',
                    )}
                  >
                    {dlBusy ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" aria-hidden="true" />
                    ) : (
                      <Icon name="download" size={12} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-mv-border px-4 py-2 text-[9px] text-mv-text-dim">
        ✓ read · <Icon name="lock" size={9} className="inline text-mv-warning" /> locked
      </div>
    </div>
  );
}

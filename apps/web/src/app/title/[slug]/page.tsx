'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { Reveal } from '@/components/Reveal';
import { Icon } from '@/components/ui/Icon';
import { TitleHero } from '@/components/title/TitleHero';
import { StoryPreview } from '@/components/title/StoryPreview';
import { MetadataGrid } from '@/components/title/MetadataGrid';
import { ChapterList, ChapterListSkeleton } from '@/components/title/ChapterList';
import { Recommendations } from '@/components/title/Recommendations';
import { StatsDashboard } from '@/components/title/StatsDashboard';
import { CommunityPanel } from '@/components/title/CommunityPanel';
import { ShareDialog } from '@/components/title/ShareDialog';
import { useTitleChapters } from '@/lib/hooks/useTitles';
import { useReadingProgress } from '@/lib/hooks/useReading';
import { useAuthStore } from '@/store/authStore';
import type { ReadingState } from '@/components/title/ReadingCta';

/* ═══════════════════════════════════════════════════════════════
   Title details — Phase 4 cinematic experience.
   Above the fold the hero sells the story (adaptive cover colors,
   glass metadata, state-aware CTAs). Below: story preview → chapters
   → recommendations → stats → community. The right rail holds the
   metadata grid + stats on desktop, and collapses to full-width.
   ═══════════════════════════════════════════════════════════════ */

const CHAPTERS_PER_PAGE = 50;

export default function TitleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [loadedPages, setLoadedPages] = useState(1);
  const [shareOpen, setShareOpen] = useState(false);
  const { token } = useAuthStore();

  const { title, chapters, pagination, isLoading, isFetching, error } = useTitleChapters(slug, loadedPages, CHAPTERS_PER_PAGE);
  const { data: readingData } = useReadingProgress(!!token);

  // ── Chapter edges across ALL loaded pages (API returns each page desc,
  //    so reduce to find the true first/latest regardless of page count). ──
  const { firstChapterId, latestChapterId } = useMemo(() => {
    if (chapters.length === 0) return { firstChapterId: undefined, latestChapterId: undefined };
    const min = chapters.reduce((a, b) => (a.number < b.number ? a : b));
    const max = chapters.reduce((a, b) => (a.number > b.number ? a : b));
    return { firstChapterId: min.id, latestChapterId: max.id };
  }, [chapters]);

  // ── Derived reading state for THIS title ─────────────────
  const reading = useMemo<ReadingState>(() => {
    const entries = (readingData ?? []) as any[];
    const mine = entries.filter((e) => e?.chapter?.series?.id === title?.id);
    const completedCount = mine.filter((e) => e.completed).length;
    const total = pagination.total || title?.totalChapters || 0;
    const progressPct = total > 0 ? Math.min(100, Math.round((completedCount / total) * 100)) : 0;

    // Latest in-progress chapter (highest number, not completed)
    const resume = mine
      .filter((e) => !e.completed)
      .sort((a, b) => b.chapter.number - a.chapter.number)[0];

    return {
      resumeChapterId: resume?.chapter?.id,
      resumeChapterNumber: resume?.chapter?.number,
      progressPct,
      firstChapterId,
      latestChapterId,
      hasChapters: chapters.length > 0,
    };
  }, [readingData, title, pagination, chapters, firstChapterId, latestChapterId]);

  const readCount = useMemo(
    () => ((readingData ?? []) as any[]).filter((e) => e?.chapter?.series?.id === title?.id && e.completed).length,
    [readingData, title],
  );

  // Estimated finish time: totalChapters × avg pages × sec/page
  const estMinutes = useMemo(() => {
    if (!title || pagination.total === 0) return null;
    const withPages = chapters.filter((c) => c.pageCount);
    const avgPages = withPages.length > 0 ? withPages.reduce((s, c) => s + (c.pageCount ?? 0), 0) / withPages.length : 20;
    const secPerPage = title.type === 'light_novel' ? 150 : 75;
    return Math.max(1, Math.round((pagination.total * avgPages * secPerPage) / 60));
  }, [title, chapters, pagination.total]);

  const views = (title?._count?.bookmarks ?? 0) * 100 + 5000;

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
          <div className="flex flex-col gap-8 md:flex-row">
            <div className="w-full shrink-0 md:w-[250px]">
              <div className="skeleton aspect-[3/4] w-full rounded-2xl" />
            </div>
            <div className="flex-1 space-y-4">
              <div className="skeleton h-12 w-3/4 rounded-xl" />
              <div className="skeleton h-4 w-1/2 rounded" />
              <div className="skeleton h-6 w-1/3 rounded" />
              <div className="skeleton h-24 rounded-2xl" />
              <div className="flex gap-2">
                <div className="skeleton h-11 w-32 rounded-xl" />
                <div className="skeleton h-11 w-32 rounded-xl" />
              </div>
            </div>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_18rem]">
            <ChapterListSkeleton />
            <div className="space-y-4"><div className="skeleton h-64 rounded-2xl" /><div className="skeleton h-64 rounded-2xl" /></div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !title) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl px-5 py-24 text-center sm:px-6">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-mv-border bg-mv-darker">
            <Icon name="alert" size={24} className="text-mv-text-dim" />
          </div>
          <p className="mb-2 text-sm text-mv-text-muted">Title not found</p>
          <Link href="/browse" className="text-sm text-mv-violet hover:underline">Browse titles</Link>
        </div>
      </AppShell>
    );
  }

  const readingState: ReadingState = reading;

  return (
    <AppShell>
      {/* ─── Cinematic hero ─────────────────────────────── */}
      <TitleHero
        title={title}
        reading={readingState}
        chaptersTotal={pagination.total}
        estMinutes={estMinutes}
        views={views}
        onShare={() => setShareOpen(true)}
      />

      {/* ─── Body ─────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 md:px-8">
        <div className="flex flex-col gap-10 py-6 md:py-8 lg:flex-row">
          {/* Main column */}
          <div className="min-w-0 flex-1 space-y-12">
            <Reveal>
              <StoryPreview synopsis={title.synopsis ?? ''} genres={title.genres} />
            </Reveal>

            {/* Tags */}
            {title.tags && title.tags.length > 0 && (
              <Reveal>
                <section aria-label="Tags">
                  <p className="eyebrow mb-3 flex items-center gap-2">
                    <Icon name="tag" size={12} className="text-mv-violet" />
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {title.tags.map((tag) => (
                      <span key={tag} className="rounded-md border border-mv-border bg-mv-surface px-2.5 py-1 text-[10px] text-mv-text-muted">
                        {tag.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    ))}
                  </div>
                </section>
              </Reveal>
            )}

            {/* Chapters */}
            <Reveal>
              <ChapterList
                chapters={chapters}
                total={pagination.total}
                hasMore={pagination.hasMore}
                loadingMore={isFetching && loadedPages > 1}
                onLoadMore={() => setLoadedPages((p) => p + 1)}
              />
            </Reveal>

            {/* Recommendations */}
            <Reveal>
              <Recommendations slug={slug} titleId={title.id} genres={title.genres} author={title.author} />
            </Reveal>

            {/* Community */}
            <Reveal>
              <CommunityPanel slug={slug} />
            </Reveal>
          </div>

          {/* ─── Sidebar ────────────────────────────────── */}
          <aside className="w-full shrink-0 space-y-5 lg:w-72">
            <Reveal>
              <MetadataGrid title={title} chaptersTotal={pagination.total} views={views} />
            </Reveal>

            <Reveal>
              <StatsDashboard
                title={title}
                chaptersTotal={pagination.total}
                views={views}
                readCount={readCount}
                progressPct={reading.progressPct}
                estMinutes={estMinutes}
                averageRating={title.rating ?? null}
                totalReviews={title._count?.reviews ?? 0}
              />
            </Reveal>
          </aside>
        </div>
      </div>

      {/* ─── Share dialog ───────────────────────────────── */}
      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} title={title.title} slug={slug} coverUrl={title.coverUrl} />
    </AppShell>
  );
}

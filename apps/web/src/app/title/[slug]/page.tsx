'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { AppShell } from '@/components/AppShell';
import { CoverImage } from '@/components/CoverImage';
import { useTitle } from '@/lib/hooks/useTitles';
import { useAddBookmark, useRemoveBookmark } from '@/lib/hooks/useLibrary';
import { useAuthStore } from '@/store/authStore';
import { useTitleReviews, useCreateReview, useDeleteReview } from '@/lib/hooks/useReviews';
import { formatLabel, getPageNumbers } from '@mangaverse/shared';
import { COIN_UNLOCK_COST } from '@mangaverse/shared';
import { useCoinBalance } from '@/lib/hooks/useCoins';
import { useWiki, useUpsertWiki, useRevertWiki } from '@/lib/hooks/useCommunity';
import ReportButton from '@/components/ReportButton';

const CHAPTERS_PER_PAGE = 50;

export default function TitleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [chaptersPage, setChaptersPage] = useState(1);
  const { data: title, isLoading, error } = useTitle(slug, chaptersPage, CHAPTERS_PER_PAGE);
  const { token, user } = useAuthStore();
  const addBookmark = useAddBookmark();
  const removeBookmark = useRemoveBookmark();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [sortReviews, setSortReviews] = useState('newest');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState('');
  const [hoverRating, setHoverRating] = useState(0);

  const { data: reviewsData } = useTitleReviews(slug, { page: reviewsPage, limit: 5, sort: sortReviews });
  const createReview = useCreateReview(slug);
  const deleteReview = useDeleteReview();
  const { data: coinData } = useCoinBalance();
  const { data: wikiData } = useWiki(slug);
  const upsertWiki = useUpsertWiki();
  const revertWiki = useRevertWiki();
  const [editingWiki, setEditingWiki] = useState(false);
  const [wikiContent, setWikiContent] = useState('');
  const [wikiSaving, setWikiSaving] = useState(false);
  const [showWikiHistory, setShowWikiHistory] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);

  const handleSaveWiki = async () => {
    if (!token || wikiContent.trim().length < 1) return;
    setWikiSaving(true);
    try {
      await upsertWiki.mutateAsync({ slug, contentMd: wikiContent.trim() });
      setEditingWiki(false);
    } catch {
      // Error handled by mutation
    }
    setWikiSaving(false);
  };

  const handleSubmitReview = async () => {
    if (!token || reviewBody.length < 10) return;
    try {
      await createReview.mutateAsync({ rating: reviewRating, body: reviewBody });
      setShowReviewForm(false);
      setReviewBody('');
      setReviewRating(5);
    } catch {
      // Error handled by mutation
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!token) return;
    try {
      await deleteReview.mutateAsync(reviewId);
    } catch {
      // Error handled by mutation
    }
  };

  useEffect(() => {
    if (title && token) {
      const cached = localStorage.getItem(`bookmark_${title.id}`);
      if (cached === 'true') setIsBookmarked(true);
    }
  }, [title, token]);

  const handleBookmark = async () => {
    if (!title || !token) return;
    setBookmarkLoading(true);
    try {
      if (isBookmarked) {
        await removeBookmark.mutateAsync(title.id);
        setIsBookmarked(false);
        localStorage.setItem(`bookmark_${title.id}`, 'false');
      } else {
        await addBookmark.mutateAsync({ titleId: title.id, listName: 'Reading' });
        setIsBookmarked(true);
        localStorage.setItem(`bookmark_${title.id}`, 'true');
      }
    } catch {
      // Silently fail
    }
    setBookmarkLoading(false);
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl p-6">
          <div className="flex flex-col gap-8 md:flex-row">
            <div className="w-full shrink-0 md:w-[280px]">
              <div className="skeleton aspect-[3/4] w-full rounded-2xl" />
            </div>
            <div className="flex-1 space-y-4">
              <div className="skeleton h-10 w-3/4 rounded-xl" />
              <div className="skeleton h-4 w-1/2 rounded" />
              <div className="skeleton h-6 w-1/3 rounded" />
              <div className="skeleton h-28 rounded-2xl" />
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton h-14 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !title) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl p-6 py-24 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-mv-border bg-mv-darker">
            <svg className="h-7 w-7 text-mv-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="mb-2 text-sm text-mv-text-muted">Title not found</p>
          <Link href="/browse" className="text-sm text-mv-violet hover:underline">Browse titles</Link>
        </div>
      </AppShell>
    );
  }

  const chapters = title.chapters || [];
  const pagination = title.chaptersPagination || { page: 1, total: 0, hasMore: false };
  const hasMultiplePages = pagination.total > CHAPTERS_PER_PAGE;
  const readChapters = chapters.filter((ch) => ch.progress?.completed).length;
  const progressPct = pagination.total > 0 ? Math.round((readChapters / pagination.total) * 100) : 0;
  const firstChapter = chapters[0];
  const views = (title._count?.bookmarks || 0) * 100 + 5000;
  const prettyGenre = (g: string) => g.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <AppShell>
      {/* ─── Cinematic hero ─────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Backdrop */}
        <div className="absolute inset-0">
          {title.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={title.coverUrl} alt="" className="h-full w-full scale-110 object-cover opacity-25 blur-2xl" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-mv-accent/15 via-mv-dark/85 to-mv-dark" />
          <div className="absolute inset-0 bg-grid opacity-30" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 py-10 sm:px-6 md:px-8 md:py-14">
          <div className="flex flex-col gap-8 md:flex-row md:items-start">
            {/* Cover */}
            <div className="mx-auto w-44 shrink-0 md:mx-0 md:w-[240px]">
              <div className="tilt-card group relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 shadow-modal">
                <CoverImage src={title.coverUrl} title={title.title} type={title.type} emojiFallback className="h-full w-full" />
                <div className="absolute inset-0 ring-1 ring-inset ring-white/5" />
              </div>
            </div>

            {/* Meta */}
            <div className="min-w-0 flex-1 text-center md:text-left">
              <div className="mb-3 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                <span className="rounded-full bg-gradient-to-r from-mv-purple to-mv-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-glow-sm">
                  {formatLabel(title.type as any)}
                </span>
                <span className={`status-pill ${title.status === 'ongoing' ? 'border-mv-success/30 bg-mv-success/10 text-mv-success' : title.status === 'completed' ? 'border-mv-violet/30 bg-mv-violet/10 text-mv-violet' : 'border-mv-warning/30 bg-mv-warning/10 text-mv-warning'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${title.status === 'ongoing' ? 'bg-mv-success animate-pulse-dot' : title.status === 'completed' ? 'bg-mv-violet' : 'bg-mv-warning'}`} />
                  {title.status.charAt(0).toUpperCase() + title.status.slice(1)}
                </span>
                {title.releaseYear && (
                  <span className="rounded-full border border-mv-border-light bg-black/30 px-2.5 py-1 text-[10px] text-mv-text-secondary">{title.releaseYear}</span>
                )}
              </div>

              <h1 className="text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl">{title.title}</h1>
              {title.alternativeTitles && <p className="mt-2 text-xs italic text-mv-text-muted">{title.alternativeTitles}</p>}

              {/* Ratings + meta row */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 md:justify-start">
                {title.rating && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-mv-gold">★</span>
                    <span className="text-sm font-semibold text-white">{title.rating.toFixed(1)}</span>
                    <span className="text-[10px] text-mv-text-muted">· {reviewsData?.totalReviews || title._count?.reviews || 0} reviews</span>
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-xs text-mv-text-secondary">
                  <svg className="h-3.5 w-3.5 text-mv-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  {views.toLocaleString()} views
                </span>
                <span className="flex items-center gap-1.5 text-xs text-mv-text-secondary">
                  <svg className="h-3.5 w-3.5 text-mv-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  {pagination.total} chapters
                </span>
              </div>

              {/* Genres */}
              <div className="mt-4 flex flex-wrap justify-center gap-1.5 md:justify-start">
                {title.genres?.map((genre) => (
                  <Link
                    key={genre}
                    href={`/browse?genres=${genre}`}
                    className="rounded-full border border-mv-border-light bg-black/30 px-3 py-1 text-[10px] text-mv-text-secondary transition-colors hover:border-mv-violet/50 hover:text-mv-violet"
                  >
                    {prettyGenre(genre)}
                  </Link>
                ))}
              </div>

              {/* Synopsis */}
              {title.synopsis && (
                <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-mv-text-secondary md:mx-0 md:line-clamp-4">
                  {title.synopsis}
                </p>
              )}

              {/* CTAs */}
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                <Link
                  href={firstChapter ? `/reader/${firstChapter.id}` : '#'}
                  className={`btn-primary px-7 py-3 text-sm ${!firstChapter ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {firstChapter ? 'Start Reading' : 'No Chapters Yet'}
                </Link>
                <button
                  onClick={handleBookmark}
                  disabled={bookmarkLoading || !token}
                  className={`btn-ghost px-6 py-3 text-sm ${isBookmarked ? 'border-mv-violet/50 text-mv-violet' : ''}`}
                >
                  <svg className="h-4 w-4" fill={isBookmarked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  {bookmarkLoading ? '…' : isBookmarked ? 'In Library' : 'Add to Library'}
                </button>
              </div>

              {/* Reading progress */}
              {token && pagination.total > 0 && (
                <div className="mx-auto mt-6 max-w-md md:mx-0 md:max-w-sm">
                  <div className="mb-1.5 flex items-center justify-between text-[10px]">
                    <span className="text-mv-text-muted">{readChapters} of {pagination.total} chapters read</span>
                    <span className="font-semibold text-mv-violet">{progressPct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-mv-purple to-mv-accent transition-all duration-700" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Body ─────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-5 sm:px-6 md:px-8">
        <div className="flex flex-col gap-10 py-8 lg:flex-row">
          {/* Main column */}
          <div className="min-w-0 flex-1 space-y-12">
            {/* Synopsis (full) */}
            {title.synopsis && (
              <section className="card p-6 md:hidden">
                <h3 className="eyebrow mb-3">Synopsis</h3>
                <p className="text-sm leading-relaxed text-mv-text-secondary">{title.synopsis}</p>
              </section>
            )}

            {/* Tags */}
            {title.tags && title.tags.length > 0 && (
              <section>
                <h3 className="eyebrow mb-3">Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {title.tags.map((tag) => (
                    <span key={tag} className="rounded-md border border-mv-border bg-mv-surface px-2.5 py-1 text-[10px] text-mv-text-muted">
                      {prettyGenre(tag)}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Chapter List */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2.5 text-lg font-bold text-white">
                  <span className="h-5 w-1 rounded-full bg-gradient-to-b from-mv-purple to-mv-accent" />
                  Chapters
                  <span className="text-xs font-normal text-mv-text-muted">({pagination.total} total)</span>
                </h2>
                {progressPct > 0 && <span className="text-[10px] text-mv-text-muted">{readChapters} read</span>}
              </div>

              {chapters.length === 0 ? (
                <div className="card rounded-2xl p-10 text-center">
                  <p className="text-sm text-mv-text-muted">No chapters available yet</p>
                  <p className="mt-1 text-xs text-mv-text-dim">Check back soon for new releases</p>
                </div>
              ) : (
                <>
                  <div className="overflow-hidden rounded-2xl border border-mv-border bg-mv-darker">
                    {chapters.map((ch, idx) => {
                      const isCompleted = ch.progress?.completed;
                      const isInProgress = ch.progress && !ch.progress.completed;
                      const isLocked = ch.isLocked;
                      return (
                        <Link
                          key={ch.id}
                          href={`/reader/${ch.id}`}
                          className={`group flex items-center justify-between px-4 py-3 transition-all hover:bg-mv-surface ${
                            idx > 0 ? 'border-t border-mv-border/50' : ''
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            {isLocked && !isCompleted && (
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center text-mv-warning" title="Coin-locked chapter">🔒</span>
                            )}
                            <div
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                                isCompleted
                                  ? 'border-mv-success/50 bg-mv-success/15 text-mv-success'
                                  : isInProgress
                                  ? 'border-mv-violet/50 bg-mv-accent/10 text-mv-violet'
                                  : 'border-mv-border-light text-mv-text-dim'
                              }`}
                            >
                              {isCompleted ? (
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : isInProgress ? (
                                <span className="text-[8px] font-bold">{Math.round(((ch.progress?.pageNumber || 0) / 20) * 100)}%</span>
                              ) : (
                                <span className="text-[9px] font-semibold">{ch.number}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className={`text-sm font-medium transition-colors ${isCompleted ? 'text-mv-text-muted' : 'text-mv-text group-hover:text-mv-violet'}`}>
                                Ch. {ch.number}
                              </span>
                              {ch.title && <span className="ml-2 truncate text-xs text-mv-text-muted">{ch.title}</span>}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-3 text-xs text-mv-text-dim">
                            {ch.isLocked && (
                              <span className="rounded border border-mv-warning/30 bg-mv-warning/10 px-2 py-0.5 text-[9px] font-medium text-mv-warning" title={`Locked — unlock for ${COIN_UNLOCK_COST} coins`}>
                                🔒 {COIN_UNLOCK_COST}🪙
                              </span>
                            )}
                            <span>{ch.pageCount || '?'}p</span>
                            {ch.createdAt && <span className="hidden sm:inline">{formatDate(ch.createdAt)}</span>}
                            <svg className="h-4 w-4 text-mv-text-dim transition-colors group-hover:text-mv-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </Link>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {hasMultiplePages && (
                    <div className="mt-6 flex items-center justify-center gap-2">
                      <button
                        onClick={() => setChaptersPage((p) => Math.max(1, p - 1))}
                        disabled={chaptersPage === 1}
                        className="rounded-xl border border-mv-border-light bg-mv-surface px-3 py-1.5 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ← Previous
                      </button>
                      <div className="flex gap-1">
                        {getPageNumbers(chaptersPage, Math.ceil(pagination.total / CHAPTERS_PER_PAGE)).map((p) => (
                          <button
                            key={p}
                            onClick={() => setChaptersPage(p)}
                            className={`flex h-7 w-7 items-center justify-center rounded text-[10px] transition-colors ${
                              p === chaptersPage
                                ? 'bg-gradient-to-br from-mv-purple to-mv-accent text-white'
                                : 'bg-mv-surface text-mv-text-secondary hover:bg-mv-border-light hover:text-mv-text'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setChaptersPage((p) => p + 1)}
                        disabled={!pagination.hasMore}
                        className="rounded-xl border border-mv-border-light bg-mv-surface px-3 py-1.5 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* ─── Wiki Section ─────────────────────────── */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2.5 text-lg font-bold text-white">
                  <span className="h-5 w-1 rounded-full bg-gradient-to-b from-mv-purple to-mv-accent" />
                  Community Wiki
                </h2>
                <div className="flex items-center gap-2">
                  {wikiData?.wiki && <span className="text-[9px] text-mv-text-dim">v{wikiData.wiki.version}</span>}
                  {wikiData?.wiki && <ReportButton contentType="wiki" targetId={wikiData.wiki.id} label="Flag wiki" />}
                  {wikiData?.wiki && wikiData.wiki.revisions.length > 0 && (
                    <button
                      onClick={() => { setShowWikiHistory(!showWikiHistory); setEditingWiki(false); }}
                      className="rounded-lg border border-mv-border-light bg-mv-surface px-2.5 py-1 text-[9px] text-mv-text-secondary transition-colors hover:border-mv-violet hover:text-mv-violet"
                    >
                      History
                    </button>
                  )}
                  {token && (
                    <button
                      onClick={() => {
                        if (!editingWiki) {
                          setWikiContent(wikiData?.wiki?.contentMd || '');
                          setShowWikiHistory(false);
                        }
                        setEditingWiki(!editingWiki);
                      }}
                      className="rounded-lg border border-mv-border-light bg-mv-surface px-2.5 py-1 text-[9px] text-mv-text-secondary transition-colors hover:border-mv-violet hover:text-mv-violet"
                    >
                      {editingWiki ? 'Cancel' : wikiData?.wiki ? 'Edit' : 'Create'}
                    </button>
                  )}
                </div>
              </div>

              {showWikiHistory && wikiData?.wiki && (
                <div className="card mb-4 rounded-xl p-4 animate-fade-in">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Revision History</p>
                  <div className="space-y-2">
                    {wikiData.wiki.revisions.map((rev) => (
                      <div key={rev.id} className="flex items-center justify-between gap-3 rounded-lg bg-mv-surface/50 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-[10px] text-mv-text">
                            <span className="font-medium text-mv-violet">v{rev.version}</span>
                            <span className="mx-1.5 text-mv-text-dim">·</span>
                            {rev.author.displayName}
                            <span className="ml-1.5 text-mv-text-dim">· {formatReviewDate(rev.createdAt)}</span>
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-[9px] text-mv-text-dim">{rev.contentMd.slice(0, 120)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {rev.version === wikiData.wiki!.version ? (
                            <span className="text-[8px] text-mv-success">current</span>
                          ) : token ? (
                            <button
                              onClick={async () => {
                                setRevertError(null);
                                try {
                                  await revertWiki.mutateAsync({ slug, version: rev.version });
                                  setShowWikiHistory(false);
                                } catch {
                                  setRevertError('Could not restore this version');
                                }
                              }}
                              disabled={revertWiki.isPending}
                              className="rounded-md border border-mv-border-light bg-mv-surface px-2 py-1 text-[8px] text-mv-text-secondary transition-colors hover:border-mv-violet hover:text-mv-violet disabled:opacity-50"
                            >
                              Restore
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                  {revertError && <p className="mt-2 text-[9px] text-mv-danger">{revertError}</p>}
                </div>
              )}

              {editingWiki ? (
                <div className="card rounded-xl p-4 animate-fade-in">
                  <textarea
                    value={wikiContent}
                    onChange={(e) => setWikiContent(e.target.value)}
                    placeholder="Write the community wiki for this title (markdown supported)..."
                    rows={8}
                    className="field resize-none font-mono"
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[9px] text-mv-text-dim">
                      {wikiData?.wiki ? `Editing v${wikiData.wiki.version} — save creates v${wikiData.wiki.version + 1}` : 'Creating a new wiki page'}
                    </span>
                    <button
                      onClick={handleSaveWiki}
                      disabled={wikiContent.trim().length < 1 || wikiSaving || upsertWiki.isPending}
                      className="btn-primary px-4 py-2 text-[10px] disabled:opacity-50"
                    >
                      {wikiSaving || upsertWiki.isPending ? 'Saving…' : 'Save Wiki'}
                    </button>
                  </div>
                </div>
              ) : wikiData?.wiki ? (
                <div className="card rounded-xl p-6">
                  <p className="mb-3 text-[9px] text-mv-text-dim">
                    Last edited by <span className="text-mv-text-secondary">{wikiData.wiki.author.displayName}</span> · {formatDate(wikiData.wiki.updatedAt)}
                  </p>
                  <div className="whitespace-pre-wrap text-xs leading-relaxed text-mv-text-secondary">{wikiData.wiki.contentMd}</div>
                </div>
              ) : (
                <div className="card rounded-xl p-10 text-center">
                  <p className="text-xs text-mv-text-muted">No wiki page yet</p>
                  <p className="mt-1 text-[10px] text-mv-text-dim">
                    {token ? 'Be the first to write it!' : 'Sign in to contribute to the community wiki.'}
                  </p>
                </div>
              )}
            </section>

            {/* ─── Reviews ─────────────────────────────── */}
            <section className="border-t border-mv-border/60 pt-10">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2.5 text-lg font-bold text-white">
                    <span className="h-5 w-1 rounded-full bg-gradient-to-b from-mv-purple to-mv-accent" />
                    Reviews
                    <span className="text-xs font-normal text-mv-text-muted">({reviewsData?.totalReviews || title._count?.reviews || 0})</span>
                  </h2>
                  {reviewsData?.averageRating && (
                    <p className="mt-1 text-xs text-mv-text-muted">
                      Community rating: <span className="font-medium text-mv-gold">★ {reviewsData.averageRating.toFixed(1)}</span> / 10
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={sortReviews}
                    onChange={(e) => { setSortReviews(e.target.value); setReviewsPage(1); }}
                    aria-label="Sort reviews"
                    className="rounded-xl border border-mv-border-light bg-mv-surface px-2.5 py-2 text-[10px] text-mv-text-secondary outline-none focus:border-mv-violet/60"
                  >
                    <option value="newest">Newest</option>
                    <option value="highest">Highest Rated</option>
                    <option value="lowest">Lowest Rated</option>
                    <option value="helpful">Most Helpful</option>
                  </select>
                  {token && (
                    <button
                      onClick={() => setShowReviewForm(!showReviewForm)}
                      className={`rounded-xl px-3.5 py-2 text-[10px] font-medium transition-colors ${
                        showReviewForm ? 'btn-ghost' : 'btn-primary'
                      }`}
                    >
                      {showReviewForm ? 'Cancel' : 'Write Review'}
                    </button>
                  )}
                </div>
              </div>

              {showReviewForm && (
                <div className="card mb-6 rounded-xl p-6 animate-fade-in">
                  <h3 className="mb-4 text-xs font-medium text-white">Write Your Review</h3>
                  <p className="mb-2 text-[10px] text-mv-text-muted">Rating (out of 10)</p>
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setReviewRating(r)}
                        onMouseEnter={() => setHoverRating(r)}
                        onMouseLeave={() => setHoverRating(0)}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                          (hoverRating || reviewRating) >= r
                            ? 'scale-110 bg-gradient-to-br from-mv-purple to-mv-accent text-white shadow-glow-sm'
                            : 'bg-mv-surface text-mv-text-dim hover:bg-mv-border-light'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewBody}
                    onChange={(e) => setReviewBody(e.target.value)}
                    placeholder="What did you think? (min. 10 characters)"
                    rows={4}
                    className="field resize-none"
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[9px] text-mv-text-dim">
                      {reviewBody.length < 10 ? `${10 - reviewBody.length} more chars needed` : 'Ready to submit!'}
                    </span>
                    <button
                      onClick={handleSubmitReview}
                      disabled={reviewBody.length < 10 || createReview.isPending}
                      className="btn-primary px-4 py-2 text-[10px]"
                    >
                      {createReview.isPending ? 'Submitting…' : 'Submit Review'}
                    </button>
                  </div>
                  {createReview.isError && <p className="mt-2 text-[10px] text-mv-danger">Failed to submit review. You may have already reviewed this title.</p>}
                </div>
              )}

              {!reviewsData || reviewsData.items.length === 0 ? (
                <div className="card rounded-xl p-10 text-center">
                  <p className="text-xs text-mv-text-muted">No reviews yet. Be the first to share your thoughts!</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {reviewsData.items.map((review) => (
                      <div key={review.id} className="card rounded-xl p-5 transition-all hover:border-mv-border-light">
                        <div className="mb-3 flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-mv-purple to-mv-accent text-xs font-semibold text-white">
                              {review.user.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-mv-text">{review.user.displayName}</p>
                              <p className="text-[9px] text-mv-text-dim">{formatReviewDate(review.createdAt)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex gap-0.5">
                              {Array.from({ length: 10 }, (_, i) => i + 1).map((r) => (
                                <span key={r} className={`text-[9px] ${r <= review.rating ? 'text-mv-gold' : 'text-mv-text-dim'}`}>★</span>
                              ))}
                            </div>
                            <span className="ml-1 text-[10px] font-bold text-mv-gold">{review.rating}</span>
                          </div>
                        </div>

                        {review.body && <p className="text-xs leading-relaxed text-mv-text-secondary">{review.body}</p>}

                        {review.subScores && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {Object.entries(review.subScores).map(([key, val]) =>
                              val ? (
                                <span key={key} className="rounded-md bg-mv-surface px-2 py-0.5 text-[9px] text-mv-text-dim">
                                  {key.charAt(0).toUpperCase() + key.slice(1)}: {val}/10
                                </span>
                              ) : null,
                            )}
                          </div>
                        )}

                        <div className="mt-3 flex items-center gap-3 text-[9px] text-mv-text-dim">
                          <span className="flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                            {review.helpfulCount} helpful
                          </span>
                          {user?.email && review.user?.id === user.id && (
                            <button
                              onClick={() => handleDeleteReview(review.id)}
                              disabled={deleteReview.isPending}
                              className="text-mv-danger/60 transition-colors hover:text-mv-danger disabled:opacity-30"
                            >
                              {deleteReview.isPending ? '…' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {reviewsData.total > reviewsData.limit && (
                    <div className="mt-6 flex items-center justify-center gap-2">
                      <button
                        onClick={() => setReviewsPage((p) => Math.max(1, p - 1))}
                        disabled={reviewsPage === 1}
                        className="rounded-xl border border-mv-border-light bg-mv-surface px-3 py-1.5 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ← Prev
                      </button>
                      <span className="text-[10px] text-mv-text-muted">Page {reviewsPage} of {Math.ceil(reviewsData.total / reviewsData.limit)}</span>
                      <button
                        onClick={() => setReviewsPage((p) => p + 1)}
                        disabled={!reviewsData.hasMore}
                        className="rounded-xl border border-mv-border-light bg-mv-surface px-3 py-1.5 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>

          {/* ─── Sidebar ────────────────────────────────── */}
          <aside className="w-full shrink-0 space-y-5 lg:w-72">
            {token && pagination.total > 0 && (
              <div className="card rounded-2xl p-5">
                <p className="eyebrow mb-3">Reading Progress</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-mv-text-secondary">{readChapters} / {pagination.total} chapters</span>
                  <span className="text-xs font-semibold text-mv-violet">{progressPct}%</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-mv-purple to-mv-accent transition-all duration-500" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}

            <div className="card rounded-2xl p-5">
              <p className="eyebrow mb-4">Details</p>
              <dl className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-mv-text-muted">Type</dt>
                  <dd><span className="rounded-md bg-mv-accent/15 px-2 py-0.5 text-[10px] font-medium text-mv-violet">{formatLabel(title.type as any)}</span></dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-mv-text-muted">Status</dt>
                  <dd className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${title.status === 'ongoing' ? 'bg-mv-success/15 text-mv-success' : title.status === 'completed' ? 'bg-mv-violet/15 text-mv-violet' : 'bg-mv-warning/15 text-mv-warning'}`}>
                    {title.status.charAt(0).toUpperCase() + title.status.slice(1)}
                  </dd>
                </div>
                {title.rating && (
                  <div className="flex items-center justify-between">
                    <dt className="text-mv-text-muted">Rating</dt>
                    <dd className="text-mv-gold">★ {title.rating.toFixed(1)}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <dt className="text-mv-text-muted">Chapters</dt>
                  <dd className="text-mv-text-secondary">{pagination.total}</dd>
                </div>
                {title.releaseYear && (
                  <div className="flex items-center justify-between">
                    <dt className="text-mv-text-muted">Year</dt>
                    <dd className="text-mv-text-secondary">{title.releaseYear}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-mv-border pt-3">
                  <dt className="text-mv-text-muted">Views</dt>
                  <dd className="text-mv-text-secondary">{views.toLocaleString()}</dd>
                </div>
              </dl>
            </div>

            {(title.author || title.artist) && (
              <div className="card rounded-2xl p-5">
                <p className="eyebrow mb-3">Credits</p>
                {title.author && <p className="text-xs text-mv-text-secondary">Author: <span className="text-mv-text">{title.author}</span></p>}
                {title.artist && <p className="mt-1.5 text-xs text-mv-text-secondary">Artist: <span className="text-mv-text">{title.artist}</span></p>}
              </div>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatReviewDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

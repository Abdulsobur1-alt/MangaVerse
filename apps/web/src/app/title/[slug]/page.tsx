'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { TopBar } from '@/components/TopBar';
import { useTitle } from '@/lib/hooks/useTitles';
import { useAddBookmark, useRemoveBookmark } from '@/lib/hooks/useLibrary';
import { useAuthStore } from '@/store/authStore';
import { formatLabel, getPageNumbers } from '@mangaverse/shared';

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

  // Check if already bookmarked
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
      <main className="min-h-screen bg-mv-dark">
        <TopBar />
        <div className="mx-auto max-w-6xl p-6 animate-pulse">
          <div className="flex flex-col gap-8 md:flex-row">
            <div className="w-full md:w-[300px] shrink-0">
              <div className="aspect-[3/4] w-full rounded-xl bg-mv-surface" />
            </div>
            <div className="flex-1 space-y-4">
              <div className="h-9 w-3/4 rounded bg-mv-surface" />
              <div className="h-4 w-1/2 rounded bg-mv-surface" />
              <div className="h-5 w-1/3 rounded bg-mv-surface" />
              <div className="h-24 rounded bg-mv-surface" />
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-mv-surface" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !title) {
    return (
      <main className="min-h-screen bg-mv-dark">
        <TopBar />
        <div className="mx-auto max-w-5xl p-6 text-center py-20">
          <svg className="mx-auto mb-4 h-12 w-12 text-mv-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-mv-text-muted mb-2">Title not found</p>
          <Link href="/browse" className="text-sm text-mv-accent hover:underline">Browse titles</Link>
        </div>
      </main>
    );
  }

  const chapters = title.chapters || [];
  const pagination = title.chaptersPagination || { page: 1, total: 0, hasMore: false };
  const hasMultiplePages = pagination.total > CHAPTERS_PER_PAGE;
  const readChapters = chapters.filter(ch => ch.progress?.completed).length;
  const progressPct = pagination.total > 0 ? Math.round((readChapters / pagination.total) * 100) : 0;

  return (
    <main className="min-h-screen bg-mv-dark">
      <TopBar />

      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-0 md:flex-row">
          {/* ─── Sidebar ─────────────────────────── */}
          <aside className="w-full border-b border-mv-border md:w-[300px] md:shrink-0 md:border-b-0 md:border-r md:min-h-screen">
            <div className="p-5">
              {/* Back link */}
              <Link href="/browse" className="mb-4 inline-flex items-center gap-1 text-[10px] text-mv-text-muted hover:text-mv-text transition-colors">
                ← Back to Browse
              </Link>

              {/* Cover */}
              <div className="mt-1 aspect-[3/4] w-full rounded-xl bg-gradient-to-br from-mv-darker via-mv-surface to-mv-darker flex items-center justify-center shadow-lg overflow-hidden">
                <div className="text-center p-4">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-mv-accent/20">
                    <span className="text-2xl">{title.type === 'MANHWA' ? '🇰🇷' : title.type === 'MANHUA' ? '🇨🇳' : title.type === 'LIGHT_NOVEL' ? '📕' : '📖'}</span>
                  </div>
                  <p className="text-xs text-mv-text-muted line-clamp-3">{title.title}</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-4 flex flex-col gap-2">
                <Link
                  href={chapters[0] ? `/reader/${chapters[0].id}` : '#'}
                  className={`flex items-center justify-center gap-2 rounded-lg bg-mv-accent py-2.5 text-xs font-medium text-white transition-all hover:bg-red-500 ${!chapters[0] ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {chapters[0] ? 'Start Reading' : 'No Chapters'}
                </Link>
                <button
                  onClick={handleBookmark}
                  disabled={bookmarkLoading || !token}
                  className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-medium transition-colors ${
                    isBookmarked
                      ? 'border-mv-accent bg-mv-accent/20 text-mv-accent'
                      : 'border-mv-border-light bg-mv-surface text-mv-text-secondary hover:border-mv-accent hover:text-mv-accent'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <svg className="h-4 w-4" fill={isBookmarked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  {bookmarkLoading ? '...' : isBookmarked ? 'In Library' : 'Add to Library'}
                </button>
              </div>

              {/* Reading Progress Card */}
              {token && pagination.total > 0 && (
                <div className="mt-4 rounded-xl border border-mv-border bg-mv-darker p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted mb-2">Reading Progress</p>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-mv-text-secondary">{readChapters} / {pagination.total} chapters</span>
                    <span className="text-xs font-medium text-mv-accent">{progressPct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-mv-surface overflow-hidden">
                    <div className="h-full rounded-full bg-mv-accent transition-all duration-500" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
              )}

              {/* Stats Card */}
              <div className="mt-4 rounded-xl border border-mv-border bg-mv-darker p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted mb-3">Details</p>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-mv-text-muted">Type</span>
                    <span className="rounded bg-mv-accent/20 px-2 py-0.5 text-[10px] font-medium text-mv-accent">{formatLabel(title.type as any)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-mv-text-muted">Status</span>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                      title.status === 'ongoing' ? 'bg-green-900/30 text-green-400' :
                      title.status === 'completed' ? 'bg-blue-900/30 text-blue-400' :
                      'bg-yellow-900/30 text-yellow-400'
                    }`}>
                      {title.status.charAt(0).toUpperCase() + title.status.slice(1)}
                    </span>
                  </div>
                  {title.rating && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-mv-text-muted">Rating</span>
                      <span className="text-mv-gold">⭐ {title.rating.toFixed(1)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-mv-text-muted">Chapters</span>
                    <span className="text-mv-text-secondary">{pagination.total}</span>
                  </div>
                  {title.releaseYear && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-mv-text-muted">Year</span>
                      <span className="text-mv-text-secondary">{title.releaseYear}</span>
                    </div>
                  )}
                  <div className="border-t border-mv-border pt-2.5 mt-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-mv-text-muted">Views</span>
                      <span className="text-mv-text-secondary">{(title._count?.bookmarks || 0) * 100 + 5000}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Author/Artist */}
              {(title.author || title.artist) && (
                <div className="mt-4 rounded-xl border border-mv-border bg-mv-darker p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted mb-2">Credits</p>
                  {title.author && <p className="text-xs text-mv-text-secondary">Author: <span className="text-mv-text">{title.author}</span></p>}
                  {title.artist && <p className="text-xs text-mv-text-secondary mt-1">Artist: <span className="text-mv-text">{title.artist}</span></p>}
                </div>
              )}
            </div>
          </aside>

          {/* ─── Main Content ──────────────────────── */}
          <div className="flex-1 min-w-0">
            <div className="p-5 md:p-8">
              {/* Title Header */}
              <div>
                <h1 className="text-2xl font-bold text-white md:text-3xl">{title.title}</h1>
                {title.alternativeTitles && (
                  <p className="mt-1 text-xs text-mv-text-muted italic">{title.alternativeTitles}</p>
                )}

                {/* Genre Tags */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {title.genres?.map((genre) => (
                    <Link
                      key={genre}
                      href={`/browse?genre=${genre}`}
                      className="rounded-full border border-mv-border-light bg-mv-surface px-3 py-1 text-[10px] text-mv-text-secondary transition-colors hover:border-mv-accent hover:text-mv-accent"
                    >
                      {genre.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Synopsis */}
              {title.synopsis && (
                <div className="mt-6">
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-mv-text-muted">Synopsis</h3>
                  <p className="text-sm leading-relaxed text-mv-text-secondary">{title.synopsis}</p>
                </div>
              )}

              {/* Tags */}
              {title.tags && title.tags.length > 0 && (
                <div className="mt-5">
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-mv-text-muted">Tags</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {title.tags.map((tag) => (
                      <span key={tag} className="rounded-md bg-mv-surface px-2.5 py-1 text-[10px] text-mv-text-muted border border-mv-border">
                        {tag.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── Chapter List ────────────────────── */}
              <div className="mt-8">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-medium text-white">
                    Chapters
                    <span className="ml-2 text-xs text-mv-text-muted font-normal">({pagination.total} total)</span>
                  </h2>
                  {progressPct > 0 && (
                    <span className="text-[10px] text-mv-text-muted">{readChapters} read</span>
                  )}
                </div>

                {chapters.length === 0 ? (
                  <div className="rounded-xl border border-mv-border bg-mv-darker p-8 text-center">
                    <p className="text-sm text-mv-text-muted">No chapters available yet</p>
                    <p className="text-xs text-mv-text-dim mt-1">Check back soon for new releases</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-0.5">
                      {chapters.map((ch) => {
                        const isCompleted = ch.progress?.completed;
                        const isInProgress = ch.progress && !ch.progress.completed;
                        return (
                          <Link
                            key={ch.id}
                            href={`/reader/${ch.id}`}
                            className="group flex items-center justify-between rounded-lg px-4 py-3 transition-all hover:bg-mv-surface"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Progress indicator */}
                              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                isCompleted
                                  ? 'border-green-500/50 bg-green-500/20 text-green-400'
                                  : isInProgress
                                  ? 'border-mv-accent/50 bg-mv-accent/10 text-mv-accent'
                                  : 'border-mv-border-light bg-transparent text-mv-text-dim'
                              }`}>
                                {isCompleted ? (
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : isInProgress ? (
                                  <span className="text-[8px] font-bold">{Math.round((ch.progress?.pageNumber || 0) / 20 * 100)}%</span>
                                ) : (
                                  <span className="text-[8px]">{ch.number > (chapters[0]?.number || 0) ? '' : ''}</span>
                                )}
                              </div>

                              {/* Chapter info */}
                              <div className="min-w-0">
                                <span className={`text-sm font-medium transition-colors ${
                                  isCompleted
                                    ? 'text-green-400/70'
                                    : 'text-mv-text group-hover:text-white'
                                }`}>
                                  Ch. {ch.number}
                                </span>
                                {ch.title && (
                                  <span className="ml-2 text-xs text-mv-text-muted truncate">{ch.title}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-mv-text-dim shrink-0">
                              <span>{ch.pageCount || '?'}p</span>
                              {ch.createdAt && (
                                <span className="hidden sm:inline">{formatDate(ch.createdAt)}</span>
                              )}
                              <svg className="h-4 w-4 text-mv-text-dim group-hover:text-mv-text-secondary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                          onClick={() => setChaptersPage(p => Math.max(1, p - 1))}
                          disabled={chaptersPage === 1}
                          className="rounded-lg border border-mv-border-light bg-mv-surface px-3 py-1.5 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text disabled:opacity-30 disabled:cursor-not-allowed"
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
                                  ? 'bg-mv-accent text-white'
                                  : 'bg-mv-surface text-mv-text-secondary hover:bg-mv-border-light hover:text-mv-text'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>

                        <button
                          onClick={() => setChaptersPage(p => p + 1)}
                          disabled={!pagination.hasMore}
                          className="rounded-lg border border-mv-border-light bg-mv-surface px-3 py-1.5 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
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



'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import ReportButton from '@/components/ReportButton';
import { useTitleReviews, useCreateReview, useDeleteReview } from '@/lib/hooks/useReviews';
import { useWiki, useUpsertWiki, useRevertWiki } from '@/lib/hooks/useCommunity';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   CommunityPanel — reviews + wiki for the details page.
   • Review composer with 1–10 stars + story/art/characters/enjoyment
   • Review cards: avatar, stars, spoiler collapse, helpful count,
     verified badge (review count-based), delete for own reviews
   • Wiki: read / edit / history / revert, with ReportButton
   ═══════════════════════════════════════════════════════════════ */

const SUBSCORES = [
  { key: 'story', label: 'Story' },
  { key: 'art', label: 'Art' },
  { key: 'characters', label: 'Characters' },
  { key: 'enjoyment', label: 'Enjoyment' },
] as const;

function reviewDate(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function CommunityPanel({ slug }: { slug: string }) {
  const { token, user } = useAuthStore();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('newest');
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(8);
  const [body, setBody] = useState('');
  const [hover, setHover] = useState(0);
  const [subScores, setSubScores] = useState<Record<string, number>>({ story: 8, art: 8, characters: 8, enjoyment: 8 });
  const [spoilerOpen, setSpoilerOpen] = useState<string | null>(null);

  // Wiki state
  const [editingWiki, setEditingWiki] = useState(false);
  const [wikiContent, setWikiContent] = useState('');
  const [wikiSaving, setWikiSaving] = useState(false);
  const [showWikiHistory, setShowWikiHistory] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);

  const { data: reviewsData } = useTitleReviews(slug, { page, limit: 5, sort });
  const createReview = useCreateReview(slug);
  const deleteReview = useDeleteReview();
  const { data: wikiData } = useWiki(slug);
  const upsertWiki = useUpsertWiki();
  const revertWiki = useRevertWiki();

  const submitReview = async () => {
    if (!token || body.length < 10) return;
    try {
      await createReview.mutateAsync({ rating, body, subScores });
      setShowForm(false);
      setBody('');
      setRating(8);
      setSubScores({ story: 8, art: 8, characters: 8, enjoyment: 8 });
    } catch { /* surfaced by hooks */ }
  };

  const saveWiki = async () => {
    if (!token || wikiContent.trim().length < 1) return;
    setWikiSaving(true);
    try {
      await upsertWiki.mutateAsync({ slug, contentMd: wikiContent.trim() });
      setEditingWiki(false);
    } catch { /* surfaced */ }
    setWikiSaving(false);
  };

  return (
    <div className="space-y-12">
      {/* ─── Reviews ─────────────────────────────────── */}
      <section aria-label="Reviews">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2.5 text-lg font-bold text-white">
              <span className="h-5 w-1 rounded-full bg-gradient-to-b from-mv-purple to-mv-accent" aria-hidden="true" />
              Reviews
              <span className="text-xs font-normal text-mv-text-muted">({reviewsData?.totalReviews ?? 0})</span>
            </h2>
            {reviewsData?.averageRating != null && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-mv-text-muted">
                <span className="font-bold text-mv-gold">★ {reviewsData.averageRating.toFixed(1)}</span> community average / 10
              </p>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
              aria-label="Sort reviews"
              className="rounded-xl border border-mv-border-light bg-mv-surface px-2.5 py-2 text-[10px] text-mv-text-secondary outline-none focus:border-mv-violet/60"
            >
              <option value="newest">Newest</option>
              <option value="highest">Highest rated</option>
              <option value="lowest">Lowest rated</option>
              <option value="helpful">Most helpful</option>
            </select>
            {token && (
              <button onClick={() => setShowForm((s) => !s)} className={cn('rounded-xl px-3.5 py-2 text-[10px] font-medium transition-colors', showForm ? 'btn-ghost' : 'btn-primary')}>
                {showForm ? 'Cancel' : 'Write review'}
              </button>
            )}
          </div>
        </div>

        {/* Composer */}
        {showForm && (
          <div className="card mb-6 rounded-xl p-6 animate-fade-in">
            <p className="mb-4 text-xs font-medium text-white">Your rating</p>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRating(r)}
                  onMouseEnter={() => setHover(r)}
                  onMouseLeave={() => setHover(0)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold transition-all',
                    (hover || rating) >= r ? 'scale-110 bg-gradient-to-br from-mv-purple to-mv-accent text-white shadow-glow-sm' : 'bg-mv-surface text-mv-text-dim hover:bg-mv-border-light',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SUBSCORES.map((s) => (
                <label key={s.key} className="flex flex-col gap-1.5 rounded-lg bg-mv-surface/60 p-2.5">
                  <span className="text-[9px] text-mv-text-muted">{s.label}</span>
                  <input
                    type="range" min={1} max={10} value={subScores[s.key] ?? 8}
                    onChange={(e) => setSubScores((prev) => ({ ...prev, [s.key]: Number(e.target.value) }))}
                    className="h-1.5 accent-violet-500"
                  />
                  <span className="text-[10px] font-semibold text-mv-violet">{subScores[s.key] ?? 8}</span>
                </label>
              ))}
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What did you think? Spoilers are fine — reviewers can collapse them."
              rows={4}
              className="field resize-none"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[9px] text-mv-text-dim">{body.length < 10 ? `${10 - body.length} more chars needed` : 'Ready to submit!'}</span>
              <button onClick={submitReview} disabled={body.length < 10 || createReview.isPending} className="btn-primary px-4 py-2 text-[10px]">
                {createReview.isPending ? 'Submitting…' : 'Publish review'}
              </button>
            </div>
            {createReview.isError && <p className="mt-2 text-[10px] text-mv-danger">Couldn't post — you may have already reviewed this title.</p>}
          </div>
        )}

        {/* List */}
        {!reviewsData || reviewsData.items.length === 0 ? (
          <div className="card rounded-xl p-10 text-center">
            <p className="text-xs text-mv-text-muted">No reviews yet — be the first to share your thoughts.</p>
            {!token && (
              <Link href="/login" className="mt-3 inline-block text-[11px] text-mv-violet hover:underline">Sign in to review</Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {reviewsData.items.map((review) => {
              const own = user?.email && review.user?.id === user.id;
              const isSpoiler = spoilerOpen === review.id;
              return (
                <article key={review.id} className="card rounded-xl p-5 transition-all hover:border-mv-border-light">
                  <header className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-mv-purple to-mv-accent text-xs font-semibold text-white">
                        {review.user.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="flex items-center gap-1.5 text-xs font-medium text-mv-text">
                          {review.user.displayName}
                          <span className="flex items-center gap-0.5 rounded-full border border-mv-violet/30 bg-mv-violet/10 px-1.5 py-0.5 text-[8px] font-semibold text-mv-violet">
                            <Icon name="check" size={8} strokeWidth={3} /> Reader
                          </span>
                        </p>
                        <p className="text-[9px] text-mv-text-dim">{reviewDate(review.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="flex gap-0.5" aria-label={`${review.rating} out of 10 stars`}>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((r) => (
                          <span key={r} className={cn('text-[9px]', r <= review.rating ? 'text-mv-gold' : 'text-mv-text-dim/50')}>★</span>
                        ))}
                      </span>
                      <span className="ml-1 text-[10px] font-bold text-mv-gold">{review.rating}</span>
                    </div>
                  </header>

                  {/* Body with spoiler collapse */}
                  {review.body && (
                    <div className="relative">
                      {!isSpoiler && review.body.length > 140 && (
                        <button
                          onClick={() => setSpoilerOpen(review.id)}
                          className="absolute -top-0.5 right-0 flex items-center gap-1 rounded-full border border-mv-warning/30 bg-mv-warning/10 px-2 py-0.5 text-[8px] font-medium text-mv-warning"
                        >
                          <Icon name="alert" size={9} /> May contain spoilers
                        </button>
                      )}
                      <p className={cn('text-xs leading-relaxed text-mv-text-secondary transition-all', isSpoiler ? '' : review.body.length > 200 && 'line-clamp-3')}>
                        {review.body}
                      </p>
                      {isSpoiler && (
                        <button onClick={() => setSpoilerOpen(null)} className="mt-1.5 text-[9px] text-mv-violet hover:underline">Collapse</button>
                      )}
                    </div>
                  )}

                  {/* Sub-scores */}
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

                  <footer className="mt-3 flex items-center gap-3 text-[9px] text-mv-text-dim">
                    <span className="flex items-center gap-1">
                      <Icon name="arrowPath" size={11} />
                      {review.helpfulCount} helpful
                    </span>
                    {own && (
                      <button onClick={() => deleteReview.mutate(review.id)} disabled={deleteReview.isPending} className="text-mv-danger/60 transition-colors hover:text-mv-danger disabled:opacity-30">
                        {deleteReview.isPending ? '…' : 'Delete'}
                      </button>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        )}

        {/* Reviews pagination */}
        {reviewsData && reviewsData.total > reviewsData.limit && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-xl border border-mv-border-light bg-mv-surface px-3 py-1.5 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text disabled:opacity-30">
              ← Prev
            </button>
            <span className="text-[10px] text-mv-text-muted">Page {page} of {Math.ceil(reviewsData.total / reviewsData.limit)}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={!reviewsData.hasMore} className="rounded-xl border border-mv-border-light bg-mv-surface px-3 py-1.5 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text disabled:opacity-30">
              Next →
            </button>
          </div>
        )}
      </section>

      {/* ─── Wiki ─────────────────────────────────────── */}
      <section aria-label="Community wiki">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2.5 text-lg font-bold text-white">
            <span className="h-5 w-1 rounded-full bg-gradient-to-b from-mv-purple to-mv-accent" aria-hidden="true" />
            Community Wiki
          </h2>
          <div className="flex items-center gap-2">
            {wikiData?.wiki && <span className="text-[9px] text-mv-text-dim">v{wikiData.wiki.version}</span>}
            {wikiData?.wiki && <ReportButton contentType="wiki" targetId={wikiData.wiki.id} label="Flag" />}
            {wikiData?.wiki && wikiData.wiki.revisions.length > 0 && (
              <button onClick={() => { setShowWikiHistory(!showWikiHistory); setEditingWiki(false); }} className="rounded-lg border border-mv-border-light bg-mv-surface px-2.5 py-1 text-[9px] text-mv-text-secondary transition-colors hover:border-mv-violet hover:text-mv-violet">
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
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Revision history</p>
            <div className="space-y-2">
              {wikiData.wiki.revisions.map((rev) => (
                <div key={rev.id} className="flex items-center justify-between gap-3 rounded-lg bg-mv-surface/50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[10px] text-mv-text">
                      <span className="font-medium text-mv-violet">v{rev.version}</span>
                      <span className="mx-1.5 text-mv-text-dim">·</span>
                      {rev.author.displayName}
                      <span className="ml-1.5 text-mv-text-dim">· {reviewDate(rev.createdAt)}</span>
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-[9px] text-mv-text-dim">{rev.contentMd.slice(0, 120)}</p>
                  </div>
                  {rev.version !== wikiData.wiki!.version && token && (
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
                  )}
                </div>
              ))}
            </div>
            {revertError && <p className="mt-2 text-[9px] text-mv-danger">{revertError}</p>}
          </div>
        )}

        {editingWiki ? (
          <div className="card rounded-xl p-4 animate-fade-in">
            <textarea value={wikiContent} onChange={(e) => setWikiContent(e.target.value)} placeholder="Write the community wiki for this title (markdown supported)…" rows={8} className="field resize-none font-mono" />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[9px] text-mv-text-dim">
                {wikiData?.wiki ? `Editing v${wikiData.wiki.version} — save creates v${wikiData.wiki.version + 1}` : 'Creating a new wiki page'}
              </span>
              <button onClick={saveWiki} disabled={wikiContent.trim().length < 1 || wikiSaving || upsertWiki.isPending} className="btn-primary px-4 py-2 text-[10px] disabled:opacity-50">
                {wikiSaving || upsertWiki.isPending ? 'Saving…' : 'Save wiki'}
              </button>
            </div>
          </div>
        ) : wikiData?.wiki ? (
          <div className="card rounded-xl p-6">
            <p className="mb-3 text-[9px] text-mv-text-dim">
              Last edited by <span className="text-mv-text-secondary">{wikiData.wiki.author.displayName}</span> · {reviewDate(wikiData.wiki.updatedAt)}
            </p>
            <div className="whitespace-pre-wrap text-xs leading-relaxed text-mv-text-secondary">{wikiData.wiki.contentMd}</div>
          </div>
        ) : (
          <div className="card rounded-xl p-10 text-center">
            <p className="text-xs text-mv-text-muted">No wiki page yet.</p>
            <p className="mt-1 text-[10px] text-mv-text-dim">{token ? 'Be the first to write it!' : 'Sign in to contribute to the community wiki.'}</p>
          </div>
        )}
      </section>
    </div>
  );
}

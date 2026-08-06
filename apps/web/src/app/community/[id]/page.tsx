'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { useAuthStore } from '@/store/authStore';
import {
  useCommunityPost,
  useReactToPost,
  useAddComment,
  REACTIONS,
  type ReactionKey,
  type PostComment,
} from '@/lib/hooks/useCommunity';
import ReportButton from '@/components/ReportButton';
import { UserHoverCard } from '@/components/social/UserHoverCard';
import { timeAgo } from '@mangaverse/shared';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Post detail — one thoughtful discussion (Phase 8).
   • Six meaningful reactions (toggle / switch), never reaction spam
   • Threaded replies: reply to a comment inline, nested rendering
   • Author hover cards + profile links, report + view counts
   ═══════════════════════════════════════════════════════════════ */

function CommentItem({
  comment,
  depth,
  onReply,
  token,
}: {
  comment: PostComment;
  depth: number;
  onReply: (c: PostComment) => void;
  token: string | null;
}) {
  return (
    <div className={cn('relative', depth > 0 && 'ml-6 border-l-2 border-mv-border/50 pl-3')}>
      <div className="rounded-xl bg-mv-darker border border-mv-border p-4 transition-colors hover:border-mv-border-light">
        <div className="mb-2 flex items-center gap-2.5">
          <UserHoverCard userId={comment.author.id}>
            <Link href={`/user/${comment.author.id}`} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mv-accent/20 text-[9px] font-semibold text-mv-accent">
              {comment.author.displayName.charAt(0).toUpperCase()}
            </Link>
          </UserHoverCard>
          <UserHoverCard userId={comment.author.id}>
            <Link href={`/user/${comment.author.id}`} className="text-xs font-medium text-mv-text transition-colors hover:text-mv-violet">
              {comment.author.displayName}
            </Link>
          </UserHoverCard>
          <p className="text-[9px] text-mv-text-dim">{timeAgo(comment.createdAt)}</p>
          {token && (
            <button
              onClick={() => onReply(comment)}
              className="ml-auto text-[9px] font-medium text-mv-text-dim transition-colors hover:text-mv-violet"
            >
              Reply
            </button>
          )}
        </div>
        <p className="text-xs text-mv-text-secondary leading-relaxed">{comment.body}</p>
      </div>
    </div>
  );
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuthStore();
  const { data: post, isLoading, error } = useCommunityPost(id || '');
  const reactToPost = useReactToPost();
  const addComment = useAddComment();
  const [commentBody, setCommentBody] = useState('');
  const [replyTarget, setReplyTarget] = useState<PostComment | null>(null);

  const handleReact = async (reaction: ReactionKey) => {
    if (!token || !post) return;
    try {
      await reactToPost.mutateAsync({ postId: post.id, reaction });
    } catch {
      // Error handled by mutation
    }
  };

  const handleComment = async () => {
    if (!token || !post || commentBody.trim().length === 0) return;
    try {
      await addComment.mutateAsync({
        postId: post.id,
        body: commentBody.trim(),
        parentId: replyTarget?.id,
      });
      setCommentBody('');
      setReplyTarget(null);
    } catch {
      // Error handled by mutation
    }
  };

  // Top-level comments + their replies (one nesting level, flat API).
  const commentTree = useMemo(() => {
    if (!post) return { top: [] as PostComment[], replies: new Map<string, PostComment[]>() };
    const top: PostComment[] = [];
    const replies = new Map<string, PostComment[]>();
    for (const c of post.comments) {
      if (c.parentId) {
        const list = replies.get(c.parentId) ?? [];
        list.push(c);
        replies.set(c.parentId, list);
      } else {
        top.push(c);
      }
    }
    return { top, replies };
  }, [post]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-2/3 rounded bg-mv-surface" />
            <div className="h-4 w-1/3 rounded bg-mv-surface" />
            <div className="h-40 rounded bg-mv-surface" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !post) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl p-6 text-center py-20">
          <p className="text-sm text-mv-text-muted mb-2">Post not found</p>
          <Link href="/community" className="text-xs text-mv-violet hover:underline">← Back to Community</Link>
        </div>
      </AppShell>
    );
  }

  const reactions = post.reactions ?? {};
  const sortedReactions = [...REACTIONS].sort((a, b) => (reactions[b.key] ?? 0) - (reactions[a.key] ?? 0)).filter((r) => (reactions[r.key] ?? 0) > 0);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl p-6">
        <Link href="/community" className="mb-4 inline-flex items-center gap-1 text-[10px] text-mv-text-muted hover:text-mv-text transition-colors">
          ← Back to Community
        </Link>

        {/* Post */}
        <div className="rounded-xl bg-mv-darker border border-mv-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <UserHoverCard userId={post.author.id}>
              <Link href={`/user/${post.author.id}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-mv-accent/20 text-xs font-semibold text-mv-accent">
                {post.author.displayName.charAt(0).toUpperCase()}
              </Link>
            </UserHoverCard>
            <div>
              <div className="flex items-center gap-2">
                <UserHoverCard userId={post.author.id}>
                  <Link href={`/user/${post.author.id}`} className="text-sm font-medium text-mv-text transition-colors hover:text-mv-violet">
                    {post.author.displayName}
                  </Link>
                </UserHoverCard>
                <span className={`rounded px-1.5 py-0.5 text-[8px] font-medium ${post.tagColor}`}>
                  {post.tag.charAt(0).toUpperCase() + post.tag.slice(1)}
                </span>
              </div>
              <p className="text-[10px] text-mv-text-muted">
                {timeAgo(post.createdAt)}
                {post.series && <span className="text-mv-accent"> · {post.series.title}</span>}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-[10px] text-mv-text-dim">{post.views.toLocaleString()} views</span>
            </div>
          </div>

          <h1 className="text-lg font-semibold text-white leading-snug">{post.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-mv-text-secondary whitespace-pre-wrap">{post.body}</p>

          {/* Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-mv-border pt-4">
            {/* Reaction bar */}
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Reactions">
              {REACTIONS.map((r) => {
                const count = reactions[r.key] ?? 0;
                const active = post.myReaction === r.key;
                return (
                  <button
                    key={r.key}
                    onClick={() => void handleReact(r.key)}
                    disabled={!token || reactToPost.isPending}
                    title={r.label}
                    aria-pressed={active}
                    aria-label={`${r.label}${count ? ` (${count})` : ''}`}
                    className={cn(
                      'flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] transition-all',
                      active
                        ? 'border-mv-accent/50 bg-mv-accent/20 text-mv-accent shadow-glow-sm'
                        : 'border-mv-border-light bg-mv-surface text-mv-text-secondary hover:border-mv-violet/40 hover:text-mv-text',
                      'disabled:opacity-50',
                    )}
                  >
                    <span aria-hidden="true">{r.emoji}</span>
                    {count > 0 && <span className="text-[9px] font-semibold">{count}</span>}
                  </button>
                );
              })}
            </div>

            <span className="flex items-center gap-1.5 text-xs text-mv-text-dim">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {post.comments.length} replies
            </span>

            <div className="ml-auto flex items-center gap-3">
              <ReportButton contentType="post" targetId={post.id} />
              {!token && (
                <Link href="/login" className="text-[10px] text-mv-violet hover:underline">Sign in to react & comment</Link>
              )}
            </div>
          </div>

          {/* Reaction summary chips */}
          {sortedReactions.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {sortedReactions.map((r) => (
                <span key={r.key} className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-mv-text-dim">
                  {r.emoji} {reactions[r.key]}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Comments */}
        <div className="mt-6">
          <h2 className="mb-4 text-sm font-medium text-white">
            Replies <span className="ml-1 text-xs text-mv-text-muted">({post.comments.length})</span>
          </h2>

          {/* Comment input */}
          {token ? (
            <div className="mb-5">
              {replyTarget && (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-mv-violet/30 bg-mv-violet/10 px-3 py-2">
                  <p className="flex-1 truncate text-[10px] text-mv-text-secondary">
                    Replying to <span className="font-semibold text-mv-violet">{replyTarget.author.displayName}</span>
                  </p>
                  <button onClick={() => setReplyTarget(null)} aria-label="Cancel reply" className="flex h-5 w-5 items-center justify-center rounded-full text-mv-text-dim transition-colors hover:bg-white/10 hover:text-white">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder={replyTarget ? 'Write your reply…' : 'Write a reply…'}
                  className="flex-1 rounded-lg border border-mv-border-light bg-mv-surface px-3 py-2 text-xs text-mv-text placeholder:text-mv-text-dim outline-none focus:border-mv-accent"
                  onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                />
                <button
                  onClick={handleComment}
                  disabled={commentBody.trim().length === 0 || addComment.isPending}
                  className="btn-primary px-4 py-2 text-[10px] disabled:opacity-50"
                >
                  {addComment.isPending ? '...' : 'Reply'}
                </button>
              </div>
            </div>
          ) : (
            <p className="mb-5 rounded-lg bg-mv-darker px-3 py-2 text-[10px] text-mv-text-dim">
              <Link href="/login" className="text-mv-violet hover:underline">Sign in</Link> to join the discussion.
            </p>
          )}

          {post.comments.length === 0 ? (
            <div className="rounded-xl border border-mv-border bg-mv-darker p-8 text-center">
              <p className="text-xs text-mv-text-muted">No replies yet. Be the first to respond!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {commentTree.top.map((comment) => {
                const replies = commentTree.replies.get(comment.id) ?? [];
                return (
                  <div key={comment.id}>
                    <CommentItem comment={comment} depth={0} onReply={(c) => { setReplyTarget(c); setCommentBody(''); }} token={token} />
                    {replies.length > 0 && (
                      <div className="mt-3 space-y-3">
                        {replies.map((r) => (
                          <CommentItem key={r.id} comment={r} depth={1} onReply={(c) => { setReplyTarget(c); setCommentBody(''); }} token={token} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

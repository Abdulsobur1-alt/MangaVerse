'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { TopBar } from '@/components/TopBar';
import { useAuthStore } from '@/store/authStore';
import { useCommunityPost, useVotePost, useAddComment } from '@/lib/hooks/useCommunity';
import { timeAgo } from '@mangaverse/shared';

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuthStore();
  const { data: post, isLoading, error } = useCommunityPost(id || '');
  const votePost = useVotePost();
  const addComment = useAddComment();
  const [commentBody, setCommentBody] = useState('');

  const handleVote = async () => {
    if (!token) return;
    try {
      await votePost.mutateAsync(post!.id);
    } catch {
      // Error handled by mutation
    }
  };

  const handleComment = async () => {
    if (!token || !post || commentBody.trim().length === 0) return;
    try {
      await addComment.mutateAsync({ postId: post.id, body: commentBody.trim() });
      setCommentBody('');
    } catch {
      // Error handled by mutation
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-mv-dark">
        <TopBar />
        <div className="mx-auto max-w-3xl p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-2/3 rounded bg-mv-surface" />
            <div className="h-4 w-1/3 rounded bg-mv-surface" />
            <div className="h-40 rounded bg-mv-surface" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !post) {
    return (
      <main className="min-h-screen bg-mv-dark">
        <TopBar />
        <div className="mx-auto max-w-3xl p-6 text-center py-20">
          <p className="text-sm text-mv-text-muted mb-2">Post not found</p>
          <Link href="/community" className="text-xs text-mv-accent hover:underline">← Back to Community</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-mv-dark">
      <TopBar />

      <div className="mx-auto max-w-3xl p-6">
        <Link href="/community" className="mb-4 inline-flex items-center gap-1 text-[10px] text-mv-text-muted hover:text-mv-text transition-colors">
          ← Back to Community
        </Link>

        {/* Post */}
        <div className="rounded-xl bg-mv-darker border border-mv-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-mv-accent/20 text-xs font-semibold text-mv-accent">
              {post.author.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-mv-text">{post.author.displayName}</span>
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
          <div className="mt-5 flex items-center gap-3 border-t border-mv-border pt-4">
            <button
              onClick={handleVote}
              disabled={!token || votePost.isPending}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                post.voted
                  ? 'bg-mv-accent/20 text-mv-accent'
                  : 'bg-mv-surface text-mv-text-secondary hover:bg-mv-accent/10 hover:text-mv-accent'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
              {post.voted ? 'Upvoted' : 'Upvote'} · {post.upvotes}
            </button>
            <span className="flex items-center gap-1.5 text-xs text-mv-text-dim">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              {post.comments.length} replies
            </span>
            {!token && (
              <Link href="/login" className="ml-auto text-[10px] text-mv-accent hover:underline">Sign in to upvote & comment</Link>
            )}
          </div>
        </div>

        {/* Comments */}
        <div className="mt-6">
          <h2 className="mb-4 text-sm font-medium text-white">
            Replies <span className="ml-1 text-xs text-mv-text-muted">({post.comments.length})</span>
          </h2>

          {/* Comment input */}
          {token ? (
            <div className="mb-5 flex gap-2">
              <input
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 rounded-lg border border-mv-border-light bg-mv-surface px-3 py-2 text-xs text-mv-text placeholder:text-mv-text-dim outline-none focus:border-mv-accent"
                onKeyDown={(e) => e.key === 'Enter' && handleComment()}
              />
              <button
                onClick={handleComment}
                disabled={commentBody.trim().length === 0 || addComment.isPending}
                className="rounded-lg bg-mv-accent px-3.5 py-2 text-[10px] font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
              >
                {addComment.isPending ? '...' : 'Reply'}
              </button>
            </div>
          ) : (
            <p className="mb-5 rounded-lg bg-mv-darker px-3 py-2 text-[10px] text-mv-text-dim">
              <Link href="/login" className="text-mv-accent hover:underline">Sign in</Link> to join the discussion.
            </p>
          )}

          {post.comments.length === 0 ? (
            <div className="rounded-xl border border-mv-border bg-mv-darker p-8 text-center">
              <p className="text-xs text-mv-text-muted">No replies yet. Be the first to respond!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {post.comments.map((comment) => (
                <div key={comment.id} className="rounded-xl bg-mv-darker border border-mv-border p-4">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-mv-accent/20 text-[9px] font-semibold text-mv-accent">
                      {comment.author.displayName.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-xs font-medium text-mv-text">{comment.author.displayName}</p>
                    <p className="text-[9px] text-mv-text-dim">{timeAgo(comment.createdAt)}</p>
                  </div>
                  <p className="text-xs text-mv-text-secondary leading-relaxed">{comment.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

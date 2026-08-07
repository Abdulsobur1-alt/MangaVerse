'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { useAuthStore } from '@/store/authStore';
import {
  useCommunityPosts,
  useCreatePost,
  useReadingClubs,
  useCreateClub,
  useJoinClub,
  useLeaveClub,
  usePredictions,
  useVotePrediction,
} from '@/lib/hooks/useCommunity';
import { useCoinBalance } from '@/lib/hooks/useCoins';
import { UserHoverCard } from '@/components/social/UserHoverCard';
import { REACTIONS } from '@/lib/hooks/useCommunity';
import { timeAgo } from '@mangaverse/shared';
import { cn } from '@/lib/cn';

const TAGS = ['All', 'theory', 'prediction', 'discussion', 'review'];

const TAG_EMOJI: Record<string, string> = {
  theory: '🧠',
  prediction: '🔮',
  discussion: '💬',
  review: '✍️',
};

export default function CommunityPage() {
  const { token } = useAuthStore();
  const [activeTag, setActiveTag] = useState<string | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const [postTag, setPostTag] = useState('discussion');
  const [clubName, setClubName] = useState('');
  const [showCreateClub, setShowCreateClub] = useState(false);

  const { data: postsData, isLoading } = useCommunityPosts({ tag: activeTag, sort: 'newest' });
  const createPost = useCreatePost();
  const { data: clubsData } = useReadingClubs();
  const createClub = useCreateClub();
  const joinClub = useJoinClub();
  const leaveClub = useLeaveClub();
  const { data: predictionsData } = usePredictions();
  const votePrediction = useVotePrediction();
  const { data: coinData } = useCoinBalance();

  const posts = postsData?.items || [];
  const clubs = clubsData?.items || [];
  const predictions = predictionsData?.items || [];

  const handleCreatePost = async () => {
    if (!token || postTitle.length < 3 || postBody.length < 10) return;
    try {
      await createPost.mutateAsync({ title: postTitle, body: postBody, tag: postTag });
      setPostTitle('');
      setPostBody('');
      setPostTag('discussion');
      setShowCreate(false);
    } catch {
      // Error handled by mutation
    }
  };

  const handleCreateClub = async () => {
    if (!token || clubName.length < 3) return;
    try {
      await createClub.mutateAsync(clubName);
      setClubName('');
      setShowCreateClub(false);
    } catch {
      // Error handled by mutation
    }
  };

  const handleVote = async (predictionId: string, option: string, coins: number) => {
    if (!token) return;
    try {
      await votePrediction.mutateAsync({ predictionId, option, coins });
    } catch {
      // Error handled by mutation
    }
  };

  const onlineCount = 1240 + posts.length * 3;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
        <div className="mb-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow mb-2">Fandom Central</p>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
                Community
              </h1>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-mv-success/30 bg-mv-success/10 px-3 py-1">
              <div className="h-2 w-2 animate-pulse-dot rounded-full bg-mv-success" />
              <span className="text-[10px] font-medium text-mv-success">{onlineCount.toLocaleString()} online</span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {/* Tag filter */}
            <div className="flex items-center gap-1 rounded-xl border border-mv-border bg-mv-darker p-1">
              {TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag === 'All' ? undefined : tag)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] transition-colors ${
                    (tag === 'All' && !activeTag) || tag === activeTag
                      ? 'bg-gradient-to-r from-mv-purple to-mv-accent text-white shadow-glow-sm'
                      : 'text-mv-text-secondary hover:text-mv-text'
                  }`}
                >
                  {tag === 'All' ? 'All' : `${TAG_EMOJI[tag]} ${tag.charAt(0).toUpperCase() + tag.slice(1)}`}
                </button>
              ))}
            </div>

            {token && (
              <button
                onClick={() => setShowCreate(!showCreate)}
                className="btn-primary px-4 py-2 text-[10px]"
              >
                {showCreate ? 'Cancel' : '+ New Post'}
              </button>
            )}
          </div>
        </div>

        {/* Create Post Form */}
        {showCreate && (
          <div className="mb-6 rounded-xl border border-mv-border-light bg-mv-darker p-5 animate-fade-in">
            <h3 className="text-xs font-medium text-white mb-3">Create a Community Post</h3>
            <div className="mb-3 flex gap-2">
              {['theory', 'prediction', 'discussion', 'review'].map((tag) => (
                <button
                  key={tag}
                  onClick={() => setPostTag(tag)}
                  className={`rounded-full px-3 py-1 text-[10px] transition-colors ${
                    postTag === tag
                      ? 'bg-mv-accent text-white'
                      : 'bg-mv-surface text-mv-text-secondary hover:text-mv-text'
                  }`}
                >
                  {TAG_EMOJI[tag]} {tag.charAt(0).toUpperCase() + tag.slice(1)}
                </button>
              ))}
            </div>
            <input
              value={postTitle}
              onChange={(e) => setPostTitle(e.target.value)}
              placeholder="Post title (min. 3 characters)"
              className="mb-2 w-full rounded-lg border border-mv-border-light bg-mv-surface px-3 py-2 text-xs text-mv-text placeholder:text-mv-text-dim outline-none focus:border-mv-accent"
            />
            <textarea
              value={postBody}
              onChange={(e) => setPostBody(e.target.value)}
              placeholder="Share your theory, prediction, or discussion (min. 10 characters)"
              rows={4}
              className="mb-3 w-full rounded-lg border border-mv-border-light bg-mv-surface px-3 py-2 text-xs text-mv-text placeholder:text-mv-text-dim outline-none focus:border-mv-accent resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-mv-text-dim">
                {postBody.length < 10 ? `${10 - postBody.length} more chars needed` : 'Ready to publish!'}
              </span>
              <button
                onClick={handleCreatePost}
                disabled={postTitle.length < 3 || postBody.length < 10 || createPost.isPending}
                className="btn-primary px-4 py-2 text-[10px] disabled:opacity-50"
              >
                {createPost.isPending ? 'Publishing...' : 'Publish Post'}
              </button>
            </div>
          </div>
        )}          <div className="flex flex-col gap-6 lg:flex-row">
            {/* ─── Main Feed ─────────────────────────── */}
            <div className="flex-1 space-y-3.5">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-mv-accent border-t-transparent" />
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-xl border border-mv-border bg-mv-darker p-10 text-center">
                <p className="text-sm text-mv-text-muted">No posts here yet</p>
                <p className="text-xs text-mv-text-dim mt-1">
                  {token ? 'Be the first to start a discussion!' : 'Sign in to join the community conversation.'}
                </p>
              </div>
            ) : (
              posts.map((post) => {
                const reactions = post.reactions ?? {};
                const topReactions = [...REACTIONS]
                  .sort((a, b) => (reactions[b.key] ?? 0) - (reactions[a.key] ?? 0))
                  .filter((r) => (reactions[r.key] ?? 0) > 0)
                  .slice(0, 3);
                return (
                  <div
                    key={post.id}
                    className="rounded-xl bg-mv-darker border border-mv-border p-4 transition-all hover:border-mv-border-light hover:bg-mv-surface group"
                  >
                    {/* Author row — own element so hover cards don't nest inside the post link */}
                    <div className="mb-3 flex items-center gap-3">
                      <UserHoverCard userId={post.author.id}>
                        <Link href={`/user/${post.author.id}`} className="flex h-7 w-7 items-center justify-center rounded-full bg-mv-accent/20 text-[10px] font-semibold text-mv-accent flex-shrink-0">
                          {post.author.displayName.charAt(0).toUpperCase()}
                        </Link>
                      </UserHoverCard>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <UserHoverCard userId={post.author.id}>
                            <Link href={`/user/${post.author.id}`} className="text-xs font-medium text-mv-text transition-colors hover:text-mv-violet">
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
                    </div>

                    <Link href={`/community/${post.id}`} className="block">
                      <h3 className="text-sm font-medium text-white mb-1.5 group-hover:text-mv-accent transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-xs text-mv-text-muted leading-relaxed line-clamp-2">{post.body}</p>
                    </Link>

                    <div className="mt-3 flex items-center gap-4">
                      <span className="flex items-center gap-1 text-[10px] text-mv-text-dim">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        {post.comments} replies
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-mv-text-dim">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        {post.views} views
                      </span>
                      {/* Reaction preview */}
                      <div className="ml-auto flex items-center gap-2">
                        {topReactions.length > 0 && (
                          <span className="flex items-center -space-x-1" aria-label={`${post.totalReactions ?? 0} reactions`}>
                            {topReactions.map((r) => (
                              <span key={r.key} className="flex h-6 w-6 items-center justify-center rounded-full border border-mv-darker bg-mv-surface text-[10px]" aria-hidden="true">
                                {r.emoji}
                              </span>
                            ))}
                          </span>
                        )}
                        <span
                          className={cn(
                            'flex items-center gap-1.5 rounded-md px-2 py-1',
                            post.myReaction ? 'bg-mv-accent/20' : 'bg-mv-surface',
                          )}
                        >
                          {post.myReaction ? (
                            <span aria-hidden="true">{REACTIONS.find((r) => r.key === post.myReaction)?.emoji}</span>
                          ) : (
                            <svg className="h-3 w-3 text-mv-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                          )}
                          <span className={`text-[10px] font-medium ${post.myReaction ? 'text-mv-accent' : 'text-mv-text-dim'}`}>
                            {post.totalReactions ?? 0}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ─── Sidebar ───────────────────────────── */}
          <div className="w-full lg:w-64 flex-shrink-0 space-y-6">
            {/* Reading Clubs */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">📚 Reading Clubs</h3>
                {token && (
                  <button
                    onClick={() => setShowCreateClub(!showCreateClub)}
                    className="text-[9px] text-mv-accent hover:underline"
                  >
                    {showCreateClub ? 'Cancel' : '+ New'}
                  </button>
                )}
              </div>

              {showCreateClub && (
                <div className="mb-2 flex gap-1.5">
                  <input
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                    placeholder="Club name"
                    className="flex-1 rounded-lg border border-mv-border-light bg-mv-surface px-2 py-1.5 text-[10px] text-mv-text placeholder:text-mv-text-dim outline-none focus:border-mv-accent"
                  />
                  <button
                    onClick={handleCreateClub}
                    disabled={clubName.length < 3 || createClub.isPending}
                    className="rounded-lg bg-mv-accent px-2.5 py-1.5 text-[9px] font-medium text-white disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {clubs.length === 0 && (
                  <p className="rounded-lg bg-mv-darker px-3 py-2 text-[10px] text-mv-text-dim">No clubs yet</p>
                )}
                {clubs.slice(0, 6).map((club) => (
                  <div key={club.id} className="flex items-center justify-between rounded-lg bg-mv-darker px-3 py-2 hover:bg-mv-surface transition-colors">
                    <div className="min-w-0">
                      <p className="text-[10px] text-mv-text-secondary truncate">{club.name}</p>
                      <p className="text-[9px] text-mv-text-dim">{club.memberCount} members</p>
                    </div>
                    {token && (
                      <button
                        onClick={() =>
                          club.joined
                            ? leaveClub.mutate(club.id)
                            : joinClub.mutate(club.id)
                        }
                        disabled={joinClub.isPending || leaveClub.isPending}
                        className={`rounded-full px-2 py-0.5 text-[8px] font-medium transition-colors ${
                          club.joined
                            ? 'bg-mv-surface text-mv-text-secondary hover:bg-mv-accent/20 hover:text-mv-accent'
                            : 'bg-mv-accent text-white hover:bg-mv-purple'
                        }`}
                      >
                        {club.joined ? 'Joined' : 'Join'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Prediction Markets */}
            <div>
              <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">🔮 Prediction Markets</h3>
              <div className="space-y-2">
                {predictions.length === 0 && (
                  <p className="rounded-lg bg-mv-darker px-3 py-2 text-[10px] text-mv-text-dim">No predictions open</p>
                )}
                {predictions.slice(0, 3).map((pred) => (
                  <div key={pred.id} className="rounded-lg bg-mv-darker border border-mv-border p-3">
                    <p className="text-[10px] text-mv-text-secondary leading-relaxed">{pred.question}</p>
                    {pred.title && (
                      <Link href={`/title/${pred.title.slug}`} className="mt-1 block text-[9px] text-mv-accent hover:underline">
                        {pred.title.title}
                      </Link>
                    )}

                    {/* Resolved banner */}
                    {pred.result && (
                      <div className="mt-2 rounded border border-green-500/30 bg-green-500/5 px-2 py-1">
                        <span className="text-[8px] font-medium text-green-400">✓ Resolved: {pred.result}</span>
                      </div>
                    )}

                    <div className="mt-2 space-y-1">
                      {pred.options.map((opt) => {
                        const stake = pred.optionStakes[opt] || 0;
                        const pct = pred.totalStaked > 0 ? Math.round((stake / pred.totalStaked) * 100) : 0;
                        const isWinner = pred.result === opt;
                        const closed = !!pred.result;
                        return (
                          <div key={opt} className="flex items-center gap-2">
                            <button
                              onClick={() => handleVote(pred.id, opt, 5)}
                              disabled={!token || !!pred.myVote || closed}
                              className={`flex-1 rounded px-2 py-1 text-left text-[9px] transition-colors disabled:opacity-50 ${
                                isWinner
                                  ? 'bg-green-500/10 border border-green-500/40 text-green-400'
                                  : closed
                                  ? 'bg-mv-surface/50 text-mv-text-dim'
                                  : 'bg-mv-surface text-mv-text-secondary hover:bg-mv-accent/20 hover:text-mv-accent'
                              }`}
                            >
                              <span className="flex justify-between">
                                <span className="truncate">{opt}{isWinner ? ' ✓' : ''}</span>
                                <span className="text-mv-gold">{pct}%</span>
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[8px] text-mv-text-dim">
                        🪙 {pred.totalStaked.toLocaleString()} staked · {pred.totalVotes} votes
                      </span>
                      {pred.myVote && pred.result && pred.myVote.won ? (
                        <span className="text-[8px] font-medium text-green-400">
                          {pred.myVote.payout && pred.myVote.payout > 0
                            ? `You won +${pred.myVote.payout} 🪙`
                            : 'Your pick won 🎉'}
                        </span>
                      ) : pred.myVote && pred.result ? (
                        <span className="text-[8px] text-red-400">You lost · {pred.myVote.option}</span>
                      ) : pred.myVote ? (
                        <span className="text-[8px] text-mv-gold">Your vote: {pred.myVote.option}</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              {token && coinData && (
                <p className="mt-2 text-[9px] text-mv-text-dim">Balance: {coinData.balance} 🪙 (tap an option to stake 5)</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

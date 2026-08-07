'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useActivityFeed, type ActivityItem } from '@/lib/hooks/useActivity';
import { useRealtime } from '@/lib/realtime';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Activity — the premium activity feed (Phase 10).
   Friends' reviews/posts/milestones/lists, community highlights,
   platform announcements, and your own milestones — with full
   control over what appears.
   ═══════════════════════════════════════════════════════════════ */

const KIND_TABS: { key: 'all' | 'friends' | 'highlights' | 'mine'; label: string; emoji: string }[] = [
  { key: 'all', label: 'For you', emoji: '✨' },
  { key: 'friends', label: 'Friends', emoji: '👥' },
  { key: 'highlights', label: 'Highlights', emoji: '🔥' },
  { key: 'mine', label: 'Mine', emoji: '🎯' },
];

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ActorAvatar({ actor }: { actor: ActivityItem['actor'] }) {
  if (!actor) {
    return <Avatar name="MangaVerse" emoji="🪐" size="sm" />;
  }
  return <Avatar src={actor.avatar} name={actor.name} size="sm" ring />;
}

function FeedRow({ item }: { item: ActivityItem }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-mv-border bg-mv-darker/60 p-4 transition-colors hover:border-mv-violet/30 hover:bg-mv-darker">
      <ActorAvatar actor={item.actor} />
      <div className="min-w-0 flex-1">
        {item.actor ? (
          <Link href={`/user/${item.actor.id}`} className="text-xs font-semibold text-mv-violet hover:underline">
            {item.actor.name}
          </Link>
        ) : null}
        <p className="mt-0.5 text-sm leading-relaxed text-mv-text-secondary">
          <span className="mr-1.5">{item.emoji}</span>
          {item.title}
        </p>
        {item.body && <p className="mt-1 line-clamp-2 text-xs text-mv-text-muted">{item.body}</p>}
        <div className="mt-2 flex items-center gap-3">
          <span className="text-[10px] text-mv-text-dim">{timeAgo(item.time)}</span>
          {item.link && (
            <Link href={item.link} className="inline-flex items-center gap-1 text-[10px] font-medium text-mv-violet hover:underline">
              View
              <Icon name="arrowRight" size={10} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  useRealtime();
  const [kind, setKind] = useState<'all' | 'friends' | 'highlights' | 'mine'>('all');
  const [page, setPage] = useState(1);
  const { data, isLoading, isPlaceholderData } = useActivityFeed(kind, page);

  const items = data?.items ?? [];
  const hasMore = data?.hasMore ?? false;

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
          <div className="mb-5">
            <p className="eyebrow mb-2">Feed</p>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">Activity</h1>
            <p className="mt-1 text-xs text-mv-text-muted">
              What your community is reading, writing, and celebrating
            </p>
          </div>

          {/* Kind tabs */}
          <div className="scrollbar-none -mx-4 mb-6 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Feed source">
            {KIND_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => { setKind(t.key); setPage(1); }}
                aria-pressed={kind === t.key}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-medium transition-all duration-200',
                  kind === t.key
                    ? 'bg-gradient-to-r from-mv-purple to-mv-accent text-white shadow-glow-sm'
                    : 'border border-mv-border-light bg-mv-surface/60 text-mv-text-secondary hover:border-mv-violet/40 hover:text-mv-text',
                )}
              >
                <span aria-hidden="true">{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-mv-border bg-mv-darker p-4">
                  <div className="h-9 w-9 rounded-full bg-mv-surface" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 rounded bg-mv-surface" />
                    <div className="h-2 w-1/3 rounded bg-mv-surface" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-mv-border bg-mv-darker p-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mv-surface">
                <Icon name="activity" size={24} className="text-mv-text-dim" />
              </div>
              <h3 className="mb-1 text-sm font-medium text-mv-text">
                {kind === 'friends' ? 'No friend activity yet' : kind === 'mine' ? 'Nothing here yet' : 'Feed is quiet'}
              </h3>
              <p className="mb-4 text-xs text-mv-text-muted">
                {kind === 'friends'
                  ? 'Follow readers to see their reviews, milestones, and posts here.'
                  : 'Check back later — or go make some noise in the community.'}
              </p>
              <div className="flex items-center justify-center gap-2">
                {kind === 'friends' && (
                  <Link href="/community" className="btn-primary px-5 py-2.5 text-xs">Explore Community</Link>
                )}
                {kind !== 'all' && (
                  <button onClick={() => setKind('all')} className="btn-ghost px-4 py-2 text-[10px]">See everything</button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {items.map((item) => (
                  <FeedRow key={`${item.kind}-${item.id}`} item={item} />
                ))}
              </div>
              {hasMore && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={isPlaceholderData}
                    className="btn-ghost px-5 py-2 text-[10px] disabled:opacity-50"
                  >
                    {isPlaceholderData ? 'Loading…' : 'Load more activity'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

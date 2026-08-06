'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/ui/Icon';
import { CoverImage } from '@/components/CoverImage';
import { FollowButton } from '@/components/social/FollowButton';
import { useAuthStore } from '@/store/authStore';
import {
  usePublicProfile,
  useUserFollowers,
  useUserFollowing,
  useSuggestions,
  useFollowUser,
  type SuggestionUser,
} from '@/lib/hooks/useSocial';
import { usePublicLists } from '@/lib/hooks/useLists';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   User profile — a reader's public identity (Phase 8).
   • Premium header: avatar, name, joined, streak, stats, follow
   • Privacy-aware: private profiles show identity + counts only
   • Tabs: Activity timeline · Reading (current + favorite genres) ·
     Lists · Followers / Following panels
   • For your own profile: suggested connections + settings link
   ═══════════════════════════════════════════════════════════════ */

const ACTIVITY_META: Record<string, { icon: 'book' | 'check' | 'star' | 'sparkles'; label: string; color: string }> = {
  library: { icon: 'book', label: 'Added to library', color: 'bg-mv-violet/15 text-mv-violet' },
  post: { icon: 'sparkles', label: 'Posted', color: 'bg-mv-purple/15 text-mv-purple' },
  review: { icon: 'star', label: 'Reviewed', color: 'bg-mv-gold/15 text-mv-gold' },
  achievement: { icon: 'check', label: 'Achievement', color: 'bg-mv-success/15 text-mv-success' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function StatPill({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-xl border border-mv-border bg-mv-darker px-4 py-2.5 text-center">
      <p className="text-lg font-bold tracking-tight text-white">{value}</p>
      <p className="mt-0.5 text-[9px] uppercase tracking-wider text-mv-text-dim">{label}</p>
    </div>
  );
}

function SuggestionCard({ s, onFollow }: { s: SuggestionUser; onFollow: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-mv-border bg-mv-darker p-3 transition-all hover:border-mv-violet/40">
      <Link href={`/user/${s.id}`} className="block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-mv-purple to-mv-accent">
        {s.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs font-bold text-white">{s.displayName.charAt(0).toUpperCase()}</span>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/user/${s.id}`} className="block">
          <p className="truncate text-xs font-medium text-mv-text transition-colors hover:text-mv-violet">{s.displayName}</p>
        </Link>
        <p className="text-[9px] text-mv-text-dim">
          {s.sharedGenres} shared genres{s.mutual ? ' · follows you' : ''} · {s.followerCount} followers
        </p>
      </div>
      <button
        onClick={() => onFollow(s.id)}
        className="shrink-0 rounded-full bg-gradient-to-r from-mv-purple to-mv-accent px-3.5 py-1.5 text-[10px] font-semibold text-white transition-all hover:brightness-110"
      >
        Follow
      </button>
    </div>
  );
}

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuthStore();
  const { data: profile, isLoading, error } = usePublicProfile(id, true);
  const { data: followers } = useUserFollowers(id, !!profile && !profile.private);
  const { data: following } = useUserFollowing(id, !!profile && !profile.private);
  const { data: suggestions } = useSuggestions();
  const { data: userLists } = usePublicLists({ userId: id, sort: 'popular' }, !!profile && !profile.private);

  const [showList, setShowList] = useState<'followers' | 'following' | null>(null);
  const followUser = useFollowUser();

  const isMe = !!user && profile?.id === user.id;
  const lists = userLists?.items ?? [];

  const topGenres = useMemo(() => [...(profile?.favoriteGenres ?? [])].sort((a, b) => b.count - a.count).slice(0, 6), [profile]);
  const maxGenreCount = topGenres[0]?.count ?? 1;

  const suggestionsToShow = (suggestions ?? []).filter((s) => s.id !== profile?.id).slice(0, 4);

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-6 md:px-8">
          <div className="skeleton h-44 rounded-3xl" />
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-20 rounded-2xl" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !profile) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <p className="text-sm text-mv-text-muted mb-2">Reader not found</p>
          <Link href="/community" className="text-xs text-mv-violet hover:underline">← Back to Community</Link>
        </div>
      </AppShell>
    );
  }

  const panelUsers = showList === 'followers' ? (followers ?? []) : (following ?? []);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-6 md:px-8">
        {/* ─── Profile header ───────────────────────── */}
        <header className="relative overflow-hidden rounded-3xl border border-mv-border bg-mv-darker p-6 md:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-mv-purple/15 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-mv-accent/10 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-20 w-20 overflow-hidden rounded-3xl bg-gradient-to-br from-mv-purple to-mv-accent ring-2 ring-mv-border-light">
                  {profile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-white">
                      {profile.displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                {profile.mutual && (
                  <span
                    className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-mv-success text-white ring-2 ring-mv-darker"
                    title="You follow each other"
                  >
                    <Icon name="arrowPath" size={11} />
                  </span>
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-white">{profile.displayName}</h1>
                  {profile.role === 'moderator' && (
                    <span className="flex items-center gap-1 rounded-full border border-mv-violet/40 bg-mv-violet/15 px-2 py-0.5 text-[9px] font-semibold text-mv-violet">
                      <Icon name="shield" size={9} /> Moderator
                    </span>
                  )}
                  {isMe && (
                    <Link href="/settings" className="rounded-full border border-mv-border-light bg-mv-surface/60 px-2.5 py-0.5 text-[9px] font-medium text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet">
                      Edit profile
                    </Link>
                  )}
                </div>
                <p className="mt-1 text-[10px] text-mv-text-dim">
                  Reading since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {profile.streakDays > 0 && (
                    <span className="flex items-center gap-1 rounded-full border border-mv-orange/30 bg-mv-orange/10 px-2.5 py-0.5 text-[10px] font-semibold text-mv-orange">
                      <Icon name="flame" size={11} /> {profile.streakDays}-day streak
                    </span>
                  )}
                  {profile.followsYou && !isMe && (
                    <span className="rounded-full border border-mv-success/30 bg-mv-success/10 px-2.5 py-0.5 text-[10px] font-medium text-mv-success">
                      Follows you
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-3">
              {!isMe && (
                <FollowButton
                  userId={profile.id}
                  isFollowing={profile.isFollowing}
                  mutual={profile.mutual}
                  requiresAuth={!token}
                />
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowList(showList === 'followers' ? null : 'followers')}
                  aria-pressed={showList === 'followers'}
                  className="rounded-xl border border-mv-border-light bg-mv-surface/60 px-3.5 py-2 text-[10px] font-medium text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
                >
                  {profile.followerCount} Followers
                </button>
                <button
                  onClick={() => setShowList(showList === 'following' ? null : 'following')}
                  aria-pressed={showList === 'following'}
                  className="rounded-xl border border-mv-border-light bg-mv-surface/60 px-3.5 py-2 text-[10px] font-medium text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
                >
                  {profile.followingCount} Following
                </button>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="relative mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatPill value={profile.reviewCount} label="Reviews" />
            <StatPill value={profile.postCount} label="Posts" />
            <StatPill value={profile.achievementCount} label="Badges" />
            <StatPill value={lists.length} label="Lists" />
          </div>
        </header>

        {/* ─── Followers / Following panel ─────────── */}
        {showList && (
          <section aria-label={showList} className="mt-5 rounded-2xl border border-mv-border bg-mv-darker p-5 animate-fade-in">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
                <Icon name="users" size={13} /> {showList === 'followers' ? 'Followers' : 'Following'}
              </h2>
              <button onClick={() => setShowList(null)} className="flex h-7 w-7 items-center justify-center rounded-lg text-mv-text-dim transition-colors hover:bg-white/5 hover:text-white" aria-label="Close">
                <Icon name="close" size={13} />
              </button>
            </div>
            {panelUsers.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-mv-text-dim">
                {showList === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {panelUsers.map((u) => (
                  <li key={u.id}>
                    <div className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-mv-surface">
                      <Link href={`/user/${u.id}`} className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-mv-purple to-mv-accent">
                        {u.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-bold text-white">{u.displayName.charAt(0).toUpperCase()}</span>
                        )}
                      </Link>
                      <Link href={`/user/${u.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-mv-text transition-colors hover:text-mv-violet">{u.displayName}</p>
                        {u.mutual && <p className="text-[9px] text-mv-success">Mutual</p>}
                        {u.since && <p className="text-[9px] text-mv-text-dim">Since {timeAgo(u.since)}</p>}
                      </Link>
                      {!isMe && u.id !== user?.id && (
                        <FollowButton userId={u.id} isFollowing={u.isFollowing ?? false} compact />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ─── Private profile notice ───────────────── */}
        {profile.private && !isMe && (
          <div className="card mt-6 flex flex-col items-center rounded-3xl px-6 py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-mv-surface">
              <Icon name="lock" size={24} className="text-mv-text-dim" />
            </div>
            <p className="text-sm font-medium text-mv-text">This reader keeps their profile private</p>
            <p className="mt-1 max-w-sm text-xs text-mv-text-muted">
              Follow them to show some love — they'll still see your follow.
            </p>
          </div>
        )}

        {/* ─── Public content ───────────────────────── */}
        {!profile.private && (
          <>
            {/* Activity timeline */}
            {profile.activity && profile.activity.length > 0 && (
              <section aria-label="Activity" className="mt-8">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <Icon name="history" size={15} className="text-mv-violet" />
                  Recent Activity
                </h2>
                <div className="relative space-y-3 pl-8">
                  <div aria-hidden="true" className="absolute bottom-2 left-[13px] top-2 w-px bg-mv-border" />
                  {profile.activity.slice(0, 12).map((a) => {
                    const meta = ACTIVITY_META[a.type] ?? ACTIVITY_META.library;
                    return (
                      <div key={a.id} className="relative">
                        <span aria-hidden="true" className={cn('absolute -left-8 top-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-mv-darker', meta.color)}>
                          <Icon name={meta.icon} size={11} />
                        </span>
                        <Link href={a.link} className="block rounded-xl border border-mv-border bg-mv-darker px-4 py-3 transition-colors hover:border-mv-violet/40">
                          <p className="text-xs font-medium text-mv-text-secondary transition-colors hover:text-mv-violet">{a.title}</p>
                          {a.body && <p className="mt-0.5 line-clamp-1 text-[10px] text-mv-text-dim">{a.body}</p>}
                          <p className="mt-1 text-[9px] text-mv-text-dim">{meta.label} · {timeAgo(a.at)}</p>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Current reading */}
            {profile.currentReading && profile.currentReading.length > 0 && (
              <section aria-label="Currently reading" className="mt-8">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <Icon name="book" size={15} className="text-mv-violet" />
                  Currently Reading
                </h2>
                <div className="scrollbar-none -mx-5 flex gap-3 overflow-x-auto px-5 sm:mx-0 sm:px-0">
                  {profile.currentReading.map((r) => (
                    <Link
                      key={r.slug}
                      href={`/reader/${r.chapterId}`}
                      className="group relative w-28 shrink-0 overflow-hidden rounded-xl border border-mv-border bg-mv-darker transition-all duration-300 hover:-translate-y-0.5 hover:border-mv-violet/40 hover:shadow-card-hover"
                    >
                      <div className="relative aspect-[3/4] overflow-hidden bg-mv-surface">
                        <CoverImage src={r.coverUrl} title={r.title} type={r.type} className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-mv-dark/90 via-transparent to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
                          <div className="h-full bg-gradient-to-r from-mv-purple to-mv-accent" style={{ width: `${Math.max(4, r.pct)}%` }} />
                        </div>
                        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-2 py-0.5 text-[8px] font-semibold text-white">
                          Ch. {r.chapterNumber}
                        </span>
                      </div>
                      <div className="p-2">
                        <p className="truncate text-[10px] font-medium text-mv-text-secondary transition-colors group-hover:text-white">{r.title}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Favorite genres */}
            {topGenres.length > 0 && (
              <section aria-label="Favorite genres" className="mt-8 rounded-2xl border border-mv-border bg-mv-darker p-5">
                <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
                  <Icon name="chart" size={13} /> Favorite genres
                </h2>
                <div className="space-y-2.5">
                  {topGenres.map((g) => (
                    <div key={g.genre} className="flex items-center gap-3">
                      <Link href={`/genre/${g.genre}`} className="w-28 truncate text-[10px] text-mv-text-secondary transition-colors hover:text-mv-violet">
                        {g.genre.replace(/_/g, ' ')}
                      </Link>
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-mv-surface">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-mv-purple to-mv-accent transition-all duration-700"
                          style={{ width: `${(g.count / maxGenreCount) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-[10px] text-mv-text-dim">{g.count}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Public lists */}
            {lists.length > 0 && (
              <section aria-label="Lists" className="mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Icon name="sparkles" size={15} className="text-mv-violet" />
                    Public Lists
                  </h2>
                  <Link href="/lists" className="text-[10px] text-mv-text-dim transition-colors hover:text-mv-violet">Browse all →</Link>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {lists.slice(0, 6).map((l) => (
                    <Link key={l.id} href={`/list/${l.id}`} className="group flex items-center gap-3 rounded-2xl border border-mv-border bg-mv-darker p-3 transition-all duration-300 hover:border-mv-violet/40 hover:shadow-card-hover">
                      <span className="h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-mv-surface">
                        {l.cover ? <CoverImage src={l.cover} title={l.name} type="MANGA" className="h-full w-full" /> : <span className="flex h-full w-full items-center justify-center text-mv-violet/50"><Icon name="sparkles" size={13} /></span>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-medium text-mv-text-secondary transition-colors group-hover:text-white">{l.name}</span>
                        <span className="mt-0.5 block text-[9px] text-mv-text-dim">{l.itemCount} titles · {l.likeCount} likes</span>
                      </span>
                      <Icon name="chevronRight" size={13} className="shrink-0 text-mv-text-dim" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Empty state for a brand-new reader */}
            {(!profile.activity || profile.activity.length === 0) && (!profile.currentReading || profile.currentReading.length === 0) && topGenres.length === 0 && lists.length === 0 && (
              <div className="card mt-8 flex flex-col items-center rounded-3xl px-6 py-14 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-mv-purple/20 to-mv-accent/10">
                  <Icon name="users" size={24} className="text-mv-violet" />
                </div>
                <p className="text-sm font-medium text-mv-text">
                  {isMe ? 'Your profile is a blank slate' : `${profile.displayName} is just getting started`}
                </p>
                <p className="mt-1 max-w-sm text-xs text-mv-text-muted">
                  {isMe ? 'Reading, reviewing, and sharing will light up this page.' : 'Follow them and keep an eye out — activity appears here as it happens.'}
                </p>
              </div>
            )}
          </>
        )}

        {/* ─── Suggested connections (own profile) ─── */}
        {isMe && suggestionsToShow.length > 0 && (
          <section aria-label="Suggested connections" className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Icon name="users" size={15} className="text-mv-violet" />
                Readers like you
              </h2>
              <span className="text-[9px] text-mv-text-dim">Shared genres + mutual follows</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {suggestionsToShow.map((s) => (
                <SuggestionCard key={s.id} s={s} onFollow={(uid) => void followUser.mutate(uid)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

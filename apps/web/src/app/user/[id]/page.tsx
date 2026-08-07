'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Icon, type IconName } from '@/components/ui/Icon';
import { CoverImage } from '@/components/CoverImage';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { JourneyTimeline } from '@/components/profile/JourneyTimeline';
import { StatsSection } from '@/components/profile/StatsSection';
import { PersonalityCard } from '@/components/profile/PersonalityCard';
import { ReputationCard } from '@/components/profile/ReputationCard';
import { useAuthStore } from '@/store/authStore';
import {
  usePublicProfile,
  useUserFollowers,
  useUserFollowing,
  useSuggestions,
  useFollowUser,
  useUnfollowUser,
  type SuggestionUser,
  type ActivityItem,
  type CurrentReadingItem,
} from '@/lib/hooks/useSocial';
import { useOwnIdentity } from '@/lib/hooks/useIdentity';
import { usePublicLists } from '@/lib/hooks/useLists';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   User profile — a reader's premium portfolio (Phase 9).
   • ProfileHero: banner, avatar, bio, links, level, reputation,
     personality, streak — every identity signal in one header
   • Tabs: Overview · Statistics · Achievements · Collections ·
     Reviews · Bookmarks · Goals · Lists (privacy-gated)
   • Reading journey timeline tells the life story
   ═══════════════════════════════════════════════════════════════ */

const ACTIVITY_META: Record<string, { icon: IconName; label: string; color: string }> = {
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

// Public-section types (subset of what /social/users/:id returns).
interface PublicAchievement { badgeId: string; name: string; emoji: string; description: string; category: string; earnedAt: string }
interface PublicCollection { id: string; name: string; description: string | null; coverUrl: string | null; itemCount: number; updatedAt: string }
interface PublicReview { id: string; rating: number; headline: string | null; spoiler: boolean; helpfulCount: number; createdAt: string; title: { slug: string; title: string; coverUrl: string | null; type: string } }
interface PublicBookmark { slug: string; title: string; coverUrl: string | null; type: string; rating: number | null; totalChapters: number | null }
interface PublicGoal { id: string; title: string; type: string; target: number; endsAt: string | null }
interface ProfileSections {
  stats?: Parameters<typeof StatsSection>[0]['stats'];
  readingLevel?: { current: { key: string; label: string; emoji: string; min: number }; next: { key: string; label: string; emoji: string; min: number } | null; progress: number };
  personality?: { key: string; name: string; emoji: string; tagline: string; description: string; gradient: string };
  achievements?: PublicAchievement[];
  collections?: PublicCollection[];
  reviews?: PublicReview[];
  bookmarks?: PublicBookmark[];
  goals?: PublicGoal[];
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
      <button onClick={() => onFollow(s.id)} className="shrink-0 rounded-full bg-gradient-to-r from-mv-purple to-mv-accent px-3.5 py-1.5 text-[10px] font-semibold text-white transition-all hover:brightness-110">
        Follow
      </button>
    </div>
  );
}

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, user } = useAuthStore();
  const { data: profile, isLoading, error } = usePublicProfile(id, true);
  const { data: followers } = useUserFollowers(id, !!profile && !profile.private);
  const { data: following } = useUserFollowing(id, !!profile && !profile.private);
  const { data: suggestions } = useSuggestions();
  const { data: userLists } = usePublicLists({ userId: id, sort: 'popular' }, !!profile && !profile.private);

  const [tab, setTab] = useState('overview');
  const [showList, setShowList] = useState<'followers' | 'following' | null>(null);
  const followUser = useFollowUser();

  // Reset UI state when navigating between profiles.
  useEffect(() => {
    setTab('overview');
    setShowList(null);
  }, [id]);

  const isMe = !!user && profile?.id === user.id;
  const sections = (profile?.sections ?? {}) as ProfileSections;
  const lists = userLists?.items ?? [];
  const topGenres = useMemo(() => [...(profile?.favoriteGenres ?? [])].sort((a, b) => b.count - a.count).slice(0, 6), [profile]);
  const maxGenreCount = topGenres[0]?.count ?? 1;
  const suggestionsToShow = (suggestions ?? []).filter((s) => s.id !== profile?.id).slice(0, 4);

  // Tabs with content (own profile always shows all).
  const tabs = useMemo(() => {
    const has = (k: string) => {
      if (isMe) return true;
      if (k === 'lists') return lists.length > 0;
      if (k === 'overview') return true;
      return !!sections[k as keyof ProfileSections];
    };
    return [
      { key: 'overview', label: 'Overview', icon: 'home' as const, show: true },
      { key: 'stats', label: 'Statistics', icon: 'chart' as const, show: has('stats') },
      { key: 'achievements', label: 'Badges', icon: 'trophy' as const, show: has('achievements') },
      { key: 'collections', label: 'Collections', icon: 'sparkles' as const, show: has('collections') },
      { key: 'reviews', label: 'Reviews', icon: 'star' as const, show: has('reviews') },
      { key: 'bookmarks', label: 'Reading', icon: 'library' as const, show: has('bookmarks') },
      { key: 'goals', label: 'Goals', icon: 'zap' as const, show: has('goals') },
      { key: 'lists', label: 'Lists', icon: 'quote' as const, show: has('lists') },
    ].filter((t) => t.show);
  }, [isMe, sections, lists.length]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
          <div className="skeleton h-72 rounded-3xl" />
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !profile) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <p className="mb-2 text-sm text-mv-text-muted">Reader not found</p>
          <Link href="/community" className="text-xs text-mv-violet hover:underline">← Back to Community</Link>
        </div>
      </AppShell>
    );
  }

  const panelUsers = showList === 'followers' ? (followers ?? []) : (following ?? []);
  const earnedBadges = sections.achievements ?? [];

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
        {/* ─── Hero ────────────────────────────────── */}
        <ProfileHero
          profile={{
            id: profile.id,
            displayName: profile.displayName,
            username: profile.username,
            avatarUrl: profile.avatarUrl,
            bannerUrl: profile.bannerUrl ?? null,
            bio: profile.bio ?? null,
            location: profile.location ?? null,
            website: profile.website ?? null,
            socialLinks: profile.socialLinks ?? {},
            accentColor: profile.accentColor ?? null,
            profileTheme: profile.profileTheme ?? 'aurora',
            createdAt: profile.createdAt,
            streakDays: profile.streakDays,
            role: profile.role,
            followerCount: profile.followerCount,
            followingCount: profile.followingCount,
            isFollowing: profile.isFollowing,
            followsYou: profile.followsYou,
            mutual: profile.mutual,
            readingLevel: sections.readingLevel ?? null,
            personality: sections.personality ?? null,
            reputationTier: profile.reputationTier ?? null,
            favoriteGenre: topGenres[0] ? { genre: topGenres[0].genre, count: topGenres[0].count } : null,
          }}
          isMe={isMe}
          onEdit={() => router.push('/settings')}
          showFollow={!isMe}
          requiresAuth={!token}
          onShowFollowers={!profile.private ? () => setShowList(showList === 'followers' ? null : 'followers') : undefined}
          onShowFollowing={!profile.private ? () => setShowList(showList === 'following' ? null : 'following') : undefined}
        />

        {/* ─── Shared interests (visitors) ─────────── */}
        {!isMe && (profile.sharedGenres ?? []).length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-mv-border bg-mv-darker px-4 py-3">
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-mv-text-secondary">
              <Icon name="heart" size={12} className="text-mv-danger" /> You both love
            </span>
            {profile.sharedGenres!.map((g) => (
              <Link key={g} href={`/genre/${g}`} className="rounded-full border border-mv-violet/30 bg-mv-violet/10 px-2.5 py-1 text-[9px] font-medium text-mv-violet transition-colors hover:bg-mv-violet/20">
                {g.replace(/_/g, ' ')}
              </Link>
            ))}
            {typeof profile.mutualCount === 'number' && profile.mutualCount > 0 && (
              <span className="ml-auto text-[9px] text-mv-text-dim">{profile.mutualCount} mutual readers</span>
            )}
          </div>
        )}

        {/* ─── Private notice ──────────────────────── */}
        {profile.private && !isMe && (
          <div className="card mt-6 flex flex-col items-center rounded-3xl px-6 py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-mv-surface">
              <Icon name="lock" size={24} className="text-mv-text-dim" />
            </div>
            <p className="text-sm font-medium text-mv-text">This reader keeps their profile private</p>
            <p className="mt-1 max-w-sm text-xs text-mv-text-muted">Follow them to show some love — they'll still see your follow.</p>
          </div>
        )}

        {/* ─── Followers / Following panel ─────────── */}
        {showList && (
          <section aria-label={showList} className="mt-5 animate-fade-in rounded-2xl border border-mv-border bg-mv-darker p-5">
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
                        <FollowInline userId={u.id} isFollowing={u.isFollowing ?? false} token={token} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ─── Content (public or self) ────────────── */}
        {!profile.private && (
          <>
            {/* Tab bar */}
            <div className="scrollbar-none -mx-4 mt-6 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Profile sections">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-medium transition-all',
                    tab === t.key
                      ? 'bg-gradient-to-r from-mv-purple to-mv-accent text-white shadow-glow-sm'
                      : 'border border-mv-border-light bg-mv-surface/60 text-mv-text-secondary hover:border-mv-violet/40 hover:text-mv-text',
                  )}
                >
                  <Icon name={t.icon} size={12} /> {t.label}
                </button>
              ))}
            </div>

            {/* ─── Overview ─────────────────────────── */}
            {tab === 'overview' && (
              <div className="mt-6 space-y-6">
                {/* Activity + journey */}
                <div className="grid gap-5 lg:grid-cols-2">
                  <section aria-label="Activity" className="rounded-2xl border border-mv-border bg-mv-darker p-5">
                    <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
                      <Icon name="history" size={13} /> Recent activity
                    </h2>
                    {!profile.activity || profile.activity.length === 0 ? (
                      <p className="py-6 text-center text-[11px] text-mv-text-dim">
                        {isMe ? 'Your story starts with your next chapter.' : 'No public activity yet.'}
                      </p>
                    ) : (
                      <div className="relative space-y-3 pl-8">
                        <div aria-hidden="true" className="absolute bottom-2 left-[13px] top-2 w-px bg-mv-border" />
                        {profile.activity.slice(0, 8).map((a: ActivityItem) => {
                          const meta = ACTIVITY_META[a.type] ?? ACTIVITY_META.library;
                          return (
                            <div key={a.id} className="relative">
                              <span aria-hidden="true" className={cn('absolute -left-8 top-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-mv-darker', meta.color)}>
                                <Icon name={meta.icon} size={11} />
                              </span>
                              <Link href={a.link} className="block rounded-xl border border-mv-border bg-mv-surface/40 px-4 py-3 transition-colors hover:border-mv-violet/40">
                                <p className="text-xs font-medium text-mv-text-secondary transition-colors hover:text-mv-violet">{a.title}</p>
                                {a.body && <p className="mt-0.5 line-clamp-1 text-[10px] text-mv-text-dim">{a.body}</p>}
                                <p className="mt-1 text-[9px] text-mv-text-dim">{meta.label} · {timeAgo(a.at)}</p>
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Journey (own view only — derived from private data) */}
                  {isMe && <JourneySection />}
                  {!isMe && sections.personality && (
                    <PersonalityCard primary={sections.personality} />
                  )}
                </div>

                {/* Current reading */}
                {profile.currentReading && profile.currentReading.length > 0 && (
                  <section aria-label="Currently reading" className="rounded-2xl border border-mv-border bg-mv-darker p-5">
                    <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
                      <Icon name="book" size={13} /> Currently reading
                    </h2>
                    <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                      {profile.currentReading.slice(0, 6).map((r: CurrentReadingItem) => (
                        <Link key={r.slug} href={`/reader/${r.chapterId}`} className="group w-28 shrink-0">
                          <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-mv-border bg-mv-surface transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-mv-violet/40">
                            <CoverImage src={r.coverUrl} title={r.title} type={r.type} className="h-full w-full" />
                            <div className="absolute inset-0 bg-gradient-to-t from-mv-dark/90 via-transparent to-transparent" />
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
                              <div className="h-full bg-gradient-to-r from-mv-purple to-mv-accent" style={{ width: `${Math.max(4, r.pct)}%` }} />
                            </div>
                            <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-2 py-0.5 text-[8px] font-semibold text-white">
                              Ch. {r.chapterNumber}
                            </span>
                          </div>
                          <p className="mt-1.5 truncate text-[10px] font-medium text-mv-text-secondary transition-colors group-hover:text-white">{r.title}</p>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {/* Favorite genres */}
                {topGenres.length > 0 && (
                  <section aria-label="Favorite genres" className="rounded-2xl border border-mv-border bg-mv-darker p-5">
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
                            <div className="h-full rounded-full bg-gradient-to-r from-mv-purple to-mv-accent transition-all duration-700" style={{ width: `${(g.count / maxGenreCount) * 100}%` }} />
                          </div>
                          <span className="w-6 text-right text-[10px] text-mv-text-dim">{g.count}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* ─── Statistics ───────────────────────── */}
            {tab === 'stats' && sections.stats && (
              <div className="mt-6">
                <StatsSection stats={sections.stats} />
              </div>
            )}

            {/* ─── Achievements ────────────────────── */}
            {tab === 'achievements' && (
              <div className="mt-6">
                {earnedBadges.length === 0 ? (
                  <EmptyState icon="trophy" title={isMe ? 'No badges yet' : 'No public badges yet'} body={isMe ? 'Complete chapters, keep streaks, and build your library to earn badges.' : 'Keep an eye out — badges appear here as they are earned.'} />
                ) : (
                  <div className="rounded-2xl border border-mv-border bg-mv-darker p-5">
                    <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
                      <Icon name="trophy" size={13} /> Badge cabinet · {earnedBadges.length}
                    </h2>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {earnedBadges.map((b, i) => (
                        <div key={b.badgeId} className="group animate-scale-in rounded-2xl border border-mv-gold/25 bg-gradient-to-b from-mv-gold/10 to-mv-darker p-4 text-center transition-all duration-300 hover:-translate-y-0.5 hover:border-mv-gold/50 hover:shadow-card-hover" style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }} title={b.description}>
                          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-mv-gold/25 to-mv-accent/15 text-2xl shadow-glow-sm" aria-hidden="true">{b.emoji}</span>
                          <p className="mt-2.5 truncate text-[11px] font-semibold text-white">{b.name}</p>
                          <p className="mt-1 line-clamp-2 text-[9px] leading-snug text-mv-text-dim">{b.description}</p>
                          <p className="mt-2 text-[8px] font-semibold uppercase tracking-wider text-mv-gold">{timeAgo(b.earnedAt)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── Collections ──────────────────────── */}
            {tab === 'collections' && (
              <div className="mt-6">
                {(sections.collections ?? []).length === 0 ? (
                  <EmptyState icon="sparkles" title="No public collections" body="Curated shelves shared by this reader will appear here." />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {sections.collections!.map((c) => (
                      <Link key={c.id} href={`/collection/${c.id}`} className="group rounded-2xl border border-mv-border bg-mv-darker p-4 transition-all duration-300 hover:border-mv-violet/40 hover:shadow-card-hover">
                        <div className="flex items-center gap-3">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-mv-purple/25 to-mv-accent/15 text-mv-violet">
                            <Icon name="sparkles" size={18} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-mv-text transition-colors group-hover:text-mv-violet">{c.name}</p>
                            <p className="text-[9px] text-mv-text-dim">{c.itemCount} titles</p>
                          </div>
                        </div>
                        {c.description && <p className="mt-3 line-clamp-2 text-[10px] text-mv-text-muted">{c.description}</p>}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── Reviews ──────────────────────────── */}
            {tab === 'reviews' && (
              <div className="mt-6">
                {(sections.reviews ?? []).length === 0 ? (
                  <EmptyState icon="star" title="No reviews yet" body="Thoughtful reviews shared by this reader will appear here." />
                ) : (
                  <div className="space-y-3">
                    {sections.reviews!.map((r) => (
                      <article key={r.id} className="rounded-2xl border border-mv-border bg-mv-darker p-5 transition-colors hover:border-mv-violet/40">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <Link href={`/title/${r.title.slug}`} className="min-w-0">
                            <p className="truncate text-xs font-medium text-mv-text-secondary transition-colors hover:text-mv-violet">{r.title.title}</p>
                          </Link>
                          <span className="flex shrink-0 items-center gap-1">
                            <span className="flex gap-0.5" aria-label={`${r.rating} out of 10`}>
                              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                                <span key={n} className={cn('text-[8px]', n <= r.rating ? 'text-mv-gold' : 'text-mv-text-dim/50')}>★</span>
                              ))}
                            </span>
                            <span className="ml-1 text-[10px] font-bold text-mv-gold">{r.rating}</span>
                          </span>
                        </div>
                        {r.headline && <h3 className="text-sm font-semibold text-white">{r.headline}</h3>}
                        {r.spoiler && (
                          <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-mv-warning/30 bg-mv-warning/10 px-2 py-0.5 text-[8px] font-medium text-mv-warning">
                            <Icon name="alert" size={9} /> Contains spoilers
                          </span>
                        )}
                        <p className="mt-2 text-[9px] text-mv-text-dim">{timeAgo(r.createdAt)} · {r.helpfulCount} helpful</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── Bookmarks / Reading ──────────────── */}
            {tab === 'bookmarks' && (
              <div className="mt-6">
                {(sections.bookmarks ?? []).length === 0 ? (
                  <EmptyState icon="library" title="No public reading yet" body="Series this reader saves to their library will appear here." />
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                    {sections.bookmarks!.map((b) => (
                      <Link key={b.slug} href={`/title/${b.slug}`} className="group">
                        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-mv-surface transition-transform duration-300 group-hover:scale-[1.03]">
                          <CoverImage src={b.coverUrl} title={b.title} type={b.type} className="h-full w-full" />
                          {b.rating != null && (
                            <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[8px] font-bold text-mv-gold">★ {b.rating.toFixed(1)}</span>
                          )}
                        </div>
                        <p className="mt-1.5 truncate text-[10px] font-medium text-mv-text-secondary transition-colors group-hover:text-white">{b.title}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── Goals ────────────────────────────── */}
            {tab === 'goals' && (
              <div className="mt-6">
                {(sections.goals ?? []).length === 0 ? (
                  <EmptyState icon="zap" title="No active goals" body="Reading goals this reader is chasing will appear here." />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {sections.goals!.map((g) => (
                      <div key={g.id} className="rounded-2xl border border-mv-border bg-mv-darker p-4">
                        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-mv-violet">
                          <Icon name="zap" size={11} /> {g.type.replace(/_/g, ' ')}
                        </p>
                        <p className="mt-2 text-xs font-medium text-mv-text">{g.title}</p>
                        <p className="mt-1 text-[9px] text-mv-text-dim">Target: {g.target.toLocaleString()}{g.endsAt ? ` · ends ${new Date(g.endsAt).toLocaleDateString()}` : ''}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── Lists ────────────────────────────── */}
            {tab === 'lists' && (
              <div className="mt-6">
                {lists.length === 0 ? (
                  <EmptyState icon="quote" title="No public lists" body="Curated lists shared by this reader will appear here." />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {lists.slice(0, 9).map((l) => (
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
                )}
              </div>
            )}
          </>
        )}

        {/* ─── Suggestions (own profile) ───────────── */}
        {isMe && suggestionsToShow.length > 0 && (
          <section aria-label="Suggested connections" className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Icon name="users" size={15} className="text-mv-violet" /> Readers like you
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

/** Own-view journey panel (private reading data — only for the owner). */
function JourneySection() {
  const { data: identity } = useOwnIdentity(true);
  return (
    <section aria-label="Reading journey" className="rounded-2xl border border-mv-border bg-mv-darker p-5">
      <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
        <Icon name="history" size={13} /> Reading journey
      </h2>
      <JourneyTimeline items={identity?.journey.items ?? []} limit={6} />
      {identity && identity.journey.count === 0 && (
        <p className="py-4 text-center text-[11px] text-mv-text-dim">Read your first chapter to start the timeline.</p>
      )}
    </section>
  );
}

function FollowInline({ userId, isFollowing, token }: { userId: string; isFollowing: boolean; token: string | null }) {
  const follow = useFollowUser();
  const unfollow = useUnfollowUser();
  return (
    <button
      onClick={() => (isFollowing ? unfollow.mutate(userId) : follow.mutate(userId))}
      className={cn(
        'shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all',
        isFollowing ? 'border border-mv-border-light text-mv-text-secondary hover:border-mv-danger/40 hover:text-mv-danger' : 'bg-gradient-to-r from-mv-purple to-mv-accent text-white hover:brightness-110',
      )}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </button>
  );
}

function EmptyState({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <div className="card flex flex-col items-center rounded-3xl px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-mv-surface">
        <Icon name={icon} size={24} className="text-mv-text-dim" />
      </div>
      <p className="text-sm font-medium text-mv-text">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-mv-text-muted">{body}</p>
    </div>
  );
}


'use client';

import Link from 'next/link';
import { Icon, type IconName } from '@/components/ui/Icon';
import { FollowButton } from '@/components/social/FollowButton';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   ProfileHero — the premium identity header (Phase 9).
   • Custom banner (image or theme gradient) + avatar with accent ring
   • Display name, @username, bio, location, website, social links
   • Member since, streak, reading level, reputation tier, personality
   • Follow / Message (future-ready) + follower/following actions
   Works for both the public profile (PublicProfile) and the owner's
   dashboard (OwnIdentity) via the normalized `profile` prop.
   ═══════════════════════════════════════════════════════════════ */

const THEME_BANNERS: Record<string, string> = {
  aurora: 'bg-gradient-to-br from-mv-purple/50 via-mv-accent/40 to-mv-darker',
  midnight: 'bg-gradient-to-br from-indigo-950 via-slate-900 to-mv-darker',
  sunset: 'bg-gradient-to-br from-orange-500/40 via-rose-500/30 to-mv-darker',
  forest: 'bg-gradient-to-br from-emerald-600/40 via-teal-500/20 to-mv-darker',
  ocean: 'bg-gradient-to-br from-sky-600/40 via-blue-500/20 to-mv-darker',
};

const SOCIAL_META: Record<string, { label: string; icon: IconName }> = {
  x: { label: 'X', icon: 'at' },
  instagram: { label: 'Instagram', icon: 'image' },
  discord: { label: 'Discord', icon: 'community' },
  youtube: { label: 'YouTube', icon: 'play' },
  twitch: { label: 'Twitch', icon: 'play' },
};

function socialHref(key: string, handle: string): string {
  switch (key) {
    case 'x': return `https://x.com/${handle}`;
    case 'instagram': return `https://instagram.com/${handle}`;
    case 'discord': return `https://discord.com/users/${handle}`;
    case 'youtube': return `https://youtube.com/@${handle}`;
    case 'twitch': return `https://twitch.tv/${handle}`;
    default: return handle;
  }
}

export interface ProfileHeroData {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  socialLinks: Record<string, string>;
  accentColor: string | null;
  profileTheme: string;
  createdAt: string;
  streakDays: number;
  role?: string;
  followerCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
  followsYou?: boolean;
  mutual?: boolean;
  readingLevel?: { current: { key: string; label: string; emoji: string; min: number }; next: { key: string; label: string; emoji: string; min: number } | null; progress: number } | null;
  personality?: { key: string; name: string; emoji: string; tagline: string; description: string; gradient: string } | null;
  reputationTier?: { key: string; label: string; emoji: string; min: number; description: string } | null;
  favoriteGenre?: { genre: string; count: number } | null;
}

interface ProfileHeroProps {
  profile: ProfileHeroData;
  isMe?: boolean;
  onEdit?: () => void;
  onShowFollowers?: () => void;
  onShowFollowing?: () => void;
  /** Set to render the follow button. */
  showFollow?: boolean;
  /** Redirect to /login when an anonymous visitor tries to follow. */
  requiresAuth?: boolean;
}

function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function ProfileHero({ profile, isMe, onEdit, onShowFollowers, onShowFollowing, showFollow, requiresAuth }: ProfileHeroProps) {
  const themeGradient = THEME_BANNERS[profile.profileTheme] ?? THEME_BANNERS.aurora;
  const hasBanner = !!profile.bannerUrl;
  const accent = profile.accentColor;

  return (
    <header className="relative overflow-hidden rounded-3xl border border-mv-border bg-mv-darker shadow-modal">
      {/* ─── Banner ─────────────────────────────── */}
      <div className={cn('relative h-36 md:h-44', hasBanner ? '' : themeGradient)}>
        {hasBanner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.bannerUrl!} alt="" className="h-full w-full object-cover" />
        ) : (
          <>
            <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-28 left-1/4 h-56 w-56 rounded-full bg-black/20 blur-3xl" aria-hidden="true" />
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-mv-darker via-mv-darker/40 to-transparent" aria-hidden="true" />
      </div>

      <div className="relative px-6 pb-6 md:px-8 md:pb-8">
        {/* ─── Avatar + identity row ─────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-4">
            <Avatar
              src={profile.avatarUrl}
              name={profile.displayName}
              size="2xl"
              rounded="3xl"
              ring="ring-4 ring-white/20"
              className="-mt-12 md:-mt-14"
              style={accent ? { boxShadow: `0 0 0 4px ${accent}33` } : undefined}
            />
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{profile.displayName}</h1>
                {profile.role === 'moderator' && (
                  <span className="flex items-center gap-1 rounded-full border border-mv-violet/40 bg-mv-violet/15 px-2 py-0.5 text-[9px] font-semibold text-mv-violet">
                    <Icon name="shield" size={9} /> Moderator
                  </span>
                )}
                {profile.mutual && (
                  <span className="flex items-center gap-1 rounded-full border border-mv-success/30 bg-mv-success/10 px-2 py-0.5 text-[9px] font-semibold text-mv-success" title="You follow each other">
                    <Icon name="arrowPath" size={9} /> Mutual
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-mv-text-dim">@{profile.username}</p>

              {/* Bio */}
              {profile.bio && <p className="mt-2 max-w-xl text-xs leading-relaxed text-mv-text-secondary">{profile.bio}</p>}

              {/* Location · website · member since */}
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-mv-text-dim">
                {profile.location && (
                  <span className="flex items-center gap-1"><Icon name="mapPin" size={11} /> {profile.location}</span>
                )}
                {profile.website && (
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-mv-violet transition-colors hover:text-mv-accent">
                    <Icon name="link" size={11} /> {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                )}
                <span className="flex items-center gap-1"><Icon name="calendar" size={11} /> Reader since {formatMemberSince(profile.createdAt)}</span>
              </div>

              {/* Social links */}
              {Object.keys(profile.socialLinks ?? {}).length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {Object.entries(profile.socialLinks).map(([key, handle]) => {
                    const meta = SOCIAL_META[key];
                    if (!meta || !handle) return null;
                    return (
                      <a
                        key={key}
                        href={socialHref(key, handle)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${meta.label}: ${handle}`}
                        title={`${meta.label}: ${handle}`}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-mv-border-light bg-mv-surface/60 text-mv-text-dim transition-all hover:border-mv-violet/40 hover:text-mv-violet"
                      >
                        <Icon name={meta.icon} size={13} />
                      </a>
                    );
                  })}
                </div>
              )}

              {/* Showcase chips */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {profile.streakDays > 0 && (
                  <span className="flex items-center gap-1 rounded-full border border-mv-orange/30 bg-mv-orange/10 px-2.5 py-1 text-[10px] font-semibold text-mv-orange">
                    <Icon name="flame" size={11} className="fill-current" /> {profile.streakDays}-day streak
                  </span>
                )}
                {profile.readingLevel && (
                  <span className="flex items-center gap-1 rounded-full border border-mv-violet/30 bg-mv-violet/10 px-2.5 py-1 text-[10px] font-semibold text-mv-violet">
                    {profile.readingLevel.current.emoji} {profile.readingLevel.current.label}
                  </span>
                )}
                {profile.reputationTier && (
                  <span className="flex items-center gap-1 rounded-full border border-mv-gold/30 bg-mv-gold/10 px-2.5 py-1 text-[10px] font-semibold text-mv-gold" title={profile.reputationTier.description}>
                    {profile.reputationTier.emoji} {profile.reputationTier.label}
                  </span>
                )}
                {profile.personality && (
                  <span className="flex items-center gap-1 rounded-full border border-mv-purple/30 bg-mv-purple/10 px-2.5 py-1 text-[10px] font-semibold text-mv-purple" title={profile.personality.tagline}>
                    {profile.personality.emoji} {profile.personality.name}
                  </span>
                )}
                {profile.favoriteGenre && (
                  <span className="flex items-center gap-1 rounded-full border border-mv-border-light bg-mv-surface/60 px-2.5 py-1 text-[10px] font-medium text-mv-text-secondary">
                    <Icon name="heart" size={10} className="text-mv-danger" /> {profile.favoriteGenre.genre.replace(/_/g, ' ')}
                  </span>
                )}
                {profile.followsYou && !isMe && (
                  <span className="rounded-full border border-mv-success/30 bg-mv-success/10 px-2.5 py-1 text-[10px] font-medium text-mv-success">Follows you</span>
                )}
              </div>
            </div>
          </div>

          {/* ─── Actions ─────────────────────────── */}
          <div className="flex shrink-0 flex-col items-end gap-2.5">
            <div className="flex items-center gap-2">
              {isMe ? (
                onEdit && (
                  <button onClick={onEdit} className="flex items-center gap-1.5 rounded-xl border border-mv-border-light bg-mv-surface/60 px-4 py-2 text-[11px] font-medium text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet">
                    <Icon name="edit" size={12} /> Edit profile
                  </button>
                )
              ) : (
                <>
                  {showFollow && <FollowButton userId={profile.id} isFollowing={profile.isFollowing ?? false} mutual={profile.mutual} requiresAuth={requiresAuth} />}
                  <button
                    title="Messaging is coming soon"
                    className="flex items-center gap-1.5 rounded-xl border border-mv-border-light bg-mv-surface/60 px-4 py-2 text-[11px] font-medium text-mv-text-muted transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
                    aria-label="Message (coming soon)"
                  >
                    <Icon name="send" size={12} /> Message
                  </button>
                </>
              )}
            </div>
            {(onShowFollowers || onShowFollowing) && (
              <div className="flex gap-2">
                {onShowFollowers && (
                  <button onClick={onShowFollowers} className="rounded-xl border border-mv-border-light bg-mv-surface/60 px-3.5 py-2 text-[10px] font-medium text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet">
                    {profile.followerCount ?? 0} Followers
                  </button>
                )}
                {onShowFollowing && (
                  <button onClick={onShowFollowing} className="rounded-xl border border-mv-border-light bg-mv-surface/60 px-3.5 py-2 text-[10px] font-medium text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet">
                    {profile.followingCount ?? 0} Following
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

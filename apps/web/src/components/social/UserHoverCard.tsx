'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { usePublicProfile } from '@/lib/hooks/useSocial';
import { useAuthStore } from '@/store/authStore';
import { FollowButton } from './FollowButton';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   UserHoverCard — hover/focus a username to preview the reader
   (Phase 8). Shows avatar, name, streak, mutual badge, quick stats,
   favorite genres, current reading, and a follow button. The profile
   is only fetched while the card is open, so feeds stay light.
   Keyboard: focusing the trigger opens it; Escape / blur closes it.
   ═══════════════════════════════════════════════════════════════ */

interface UserHoverCardProps {
  userId: string;
  /** The trigger element (usually a username/avatar). */
  children: React.ReactNode;
  /** Which edge of the trigger the card anchors to. */
  side?: 'left' | 'right';
  className?: string;
}

export function UserHoverCard({ userId, children, side = 'left', className }: UserHoverCardProps) {
  const { token, user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const { data: profile, isLoading } = usePublicProfile(userId, open);

  const openCard = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const closeCard = () => {
    closeTimer.current = window.setTimeout(() => setOpen(false), 220);
  };

  const isMe = !!user && user.id === userId;

  return (
    <span
      className={cn('relative inline-block', className)}
      onMouseEnter={openCard}
      onMouseLeave={closeCard}
      onFocus={openCard}
      onBlur={() => window.setTimeout(() => setOpen(false), 150)}
    >
      {children}

      {open && (
        <span
          role="tooltip"
          onMouseEnter={openCard}
          onMouseLeave={closeCard}
          className={cn(
            'absolute top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-mv-border-light bg-mv-darker shadow-modal backdrop-blur-xl animate-fade-in',
            side === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {isLoading || !profile ? (
            <div className="space-y-2.5 p-4">
              <div className="flex items-center gap-3">
                <div className="skeleton h-11 w-11 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3 w-24 rounded" />
                  <div className="skeleton h-2 w-16 rounded" />
                </div>
              </div>
              <div className="skeleton h-3 w-full rounded" />
              <div className="skeleton h-3 w-2/3 rounded" />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-start gap-3 border-b border-mv-border/60 p-4">
                <Link href={`/user/${profile.id}`} className="block h-11 w-11 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-mv-purple to-mv-accent">
                  {profile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-bold text-white">{profile.displayName.charAt(0).toUpperCase()}</span>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/user/${profile.id}`} className="block">
                    <p className="truncate text-sm font-semibold text-white transition-colors hover:text-mv-violet">{profile.displayName}</p>
                  </Link>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[9px] text-mv-text-dim">
                    {profile.streakDays > 0 && (
                      <span className="flex items-center gap-0.5 text-mv-orange">
                        <Icon name="flame" size={9} /> {profile.streakDays}-day streak
                      </span>
                    )}
                    {profile.mutual && <span className="rounded-full bg-mv-success/15 px-1.5 py-0.5 font-medium text-mv-success">Mutual</span>}
                    {profile.followsYou && !profile.mutual && <span className="text-mv-success">Follows you</span>}
                  </p>
                </div>
                {!isMe && (
                  <FollowButton userId={profile.id} isFollowing={profile.isFollowing} requiresAuth={!token} compact className="shrink-0" />
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 border-b border-mv-border/60 bg-mv-surface/30 px-4 py-2.5 text-center">
                {[
                  { v: profile.followerCount, l: 'Followers' },
                  { v: profile.followingCount, l: 'Following' },
                  { v: profile.reviewCount, l: 'Reviews' },
                ].map((s) => (
                  <div key={s.l}>
                    <p className="text-xs font-bold text-white">{s.v}</p>
                    <p className="text-[8px] uppercase tracking-wider text-mv-text-dim">{s.l}</p>
                  </div>
                ))}
              </div>

              <div className="p-3.5">
                {profile.private ? (
                  <p className="text-[10px] text-mv-text-dim">Private profile — activity is hidden.</p>
                ) : (
                  <>
                    {(profile.favoriteGenres ?? []).length > 0 && (
                      <div className="mb-2.5">
                        <p className="mb-1.5 text-[8px] font-semibold uppercase tracking-wider text-mv-text-dim">Favorite genres</p>
                        <div className="flex flex-wrap gap-1">
                          {profile.favoriteGenres!.slice(0, 3).map((g) => (
                            <span key={g.genre} className="rounded-full bg-white/5 px-2 py-0.5 text-[8px] text-mv-text-secondary">
                              {g.genre.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {(profile.currentReading ?? []).length > 0 && (
                      <div>
                        <p className="mb-1.5 text-[8px] font-semibold uppercase tracking-wider text-mv-text-dim">Reading now</p>
                        <Link href={`/reader/${profile.currentReading![0].chapterId}`} className="flex items-center gap-2 rounded-lg bg-mv-surface/40 px-2.5 py-1.5 transition-colors hover:bg-mv-surface">
                          <span className="flex h-7 w-5 shrink-0 items-center justify-center overflow-hidden rounded bg-mv-darker">
                            {profile.currentReading![0].coverUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={profile.currentReading![0].coverUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-[8px] text-mv-text-dim">{profile.currentReading![0].title.charAt(0)}</span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[10px] font-medium text-mv-text-secondary">{profile.currentReading![0].title}</span>
                            <span className="text-[8px] text-mv-text-dim">Ch. {profile.currentReading![0].chapterNumber} · {profile.currentReading![0].pct}%</span>
                          </span>
                        </Link>
                      </div>
                    )}
                    {!profile.activity?.length && !profile.currentReading?.length && !profile.favoriteGenres?.length && (
                      <p className="text-[10px] text-mv-text-dim">New reader — building their shelf.</p>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </span>
      )}
    </span>
  );
}

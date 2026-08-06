'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFollowUser, useUnfollowUser } from '@/lib/hooks/useSocial';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   FollowButton — one follow/unfollow affordance used across profiles,
   hover cards, and follower lists. Shows "Following · Mutual" states
   and a "Unfollow" hint on hover. Signed-out users get pointed at
   the login page.
   ═══════════════════════════════════════════════════════════════ */

interface FollowButtonProps {
  userId: string;
  isFollowing: boolean;
  mutual?: boolean;
  compact?: boolean;
  /** When true, the button is a login link instead (no auth token). */
  requiresAuth?: boolean;
  className?: string;
}

export function FollowButton({ userId, isFollowing, mutual = false, compact = false, requiresAuth = false, className }: FollowButtonProps) {
  const follow = useFollowUser();
  const unfollow = useUnfollowUser();
  const [hovering, setHovering] = useState(false);
  const busy = follow.isPending || unfollow.isPending;

  if (requiresAuth) {
    return (
      <Link
        href="/login"
        className={cn(
          'flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-mv-purple to-mv-accent font-semibold text-white transition-all hover:brightness-110',
          compact ? 'px-3 py-1 text-[9px]' : 'px-5 py-2 text-[11px]',
          className,
        )}
      >
        + Follow
      </Link>
    );
  }

  const toggle = () => {
    if (busy) return;
    if (isFollowing) void unfollow.mutate(userId);
    else void follow.mutate(userId);
  };

  if (isFollowing) {
    return (
      <button
        onClick={toggle}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        disabled={busy}
        aria-pressed="true"
        className={cn(
          'flex items-center justify-center gap-1.5 rounded-full border font-semibold transition-all',
          compact ? 'px-3 py-1 text-[9px]' : 'px-5 py-2 text-[11px]',
          hovering
            ? 'border-mv-danger/40 bg-mv-danger/10 text-mv-danger'
            : mutual
              ? 'border-mv-success/40 bg-mv-success/10 text-mv-success'
              : 'border-mv-border-light bg-mv-surface/60 text-mv-text-secondary hover:border-mv-border-light',
          'disabled:opacity-50',
          className,
        )}
      >
        {busy ? '…' : hovering ? 'Unfollow' : mutual ? 'Following · Mutual' : 'Following'}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed="false"
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-mv-purple to-mv-accent font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50',
        compact ? 'px-3 py-1 text-[9px]' : 'px-5 py-2 text-[11px]',
        className,
      )}
    >
      {busy ? '…' : '+ Follow'}
    </button>
  );
}

'use client';

import { useState, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Avatar — the single identity primitive (Phase 16).
   • Image fades in over a shimmer placeholder (no grey flash)
   • Gradient + initial fallback when no image (or load failure)
   • Optional presence dot · optional ring · skeleton loading state
   • Sizes: xs 24 · sm 32 · md 40 · lg 48 · xl 64 · 2xl 96 (responsive)
   ═══════════════════════════════════════════════════════════════ */

const SIZE_MAP = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
  '2xl': 'h-24 w-24 text-3xl md:h-28 md:w-28 md:text-4xl',
} as const;

const ROUNDED_MAP = {
  full: 'rounded-full',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  '3xl': 'rounded-3xl',
} as const;

export interface AvatarProps {
  src?: string | null;
  /** Display name — used for the alt text and the fallback initial. */
  name: string;
  size?: keyof typeof SIZE_MAP;
  rounded?: keyof typeof ROUNDED_MAP;
  /** Presence dot (bottom-right). */
  status?: 'online' | 'offline';
  /** Skeleton placeholder while the image is unknown (data still loading). */
  loading?: boolean;
  /** Ring around the avatar. Pass a string to override the default classes. */
  ring?: boolean | string;
  /** Fallback glyph when no image and no initial is wanted (system avatars). */
  emoji?: string;
  className?: string;
  style?: CSSProperties;
}

export function Avatar({
  src,
  name,
  size = 'md',
  rounded = 'full',
  status,
  loading,
  ring,
  emoji,
  className,
  style,
}: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const showImg = !!src && !failed && !loading;

  const ringClass = typeof ring === 'string' ? ring : ring ? 'ring-2 ring-mv-border-light' : '';

  return (
    <span className={cn('relative inline-flex shrink-0', className)} style={style}>
      <span
        className={cn(
          'flex items-center justify-center overflow-hidden font-bold text-white',
          SIZE_MAP[size],
          ROUNDED_MAP[rounded],
          ringClass,
          !showImg ? 'bg-gradient-to-br from-mv-purple to-mv-accent' : 'bg-mv-surface',
        )}
      >
        {showImg ? (
          <>
            {!loaded && <span className="skeleton absolute inset-0" aria-hidden="true" />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src!}
              alt={name}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
              className={cn('h-full w-full object-cover transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0')}
            />
          </>
        ) : loading ? (
          <span className="skeleton absolute inset-0" aria-hidden="true" />
        ) : (
          <span aria-hidden="true" className="truncate px-1 text-center">
            {emoji ?? name.charAt(0).toUpperCase()}
          </span>
        )}
      </span>

      {/* Presence dot */}
      {status && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-mv-darker',
            status === 'online' ? 'bg-mv-success' : 'bg-mv-text-dim',
          )}
        />
      )}
    </span>
  );
}

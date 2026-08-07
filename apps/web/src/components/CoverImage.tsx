'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

interface CoverImageProps {
  src: string | null | undefined;
  alt?: string;
  title: string;
  type?: string;
  className?: string;
  /** Render the type emoji instead of the first letter in the fallback */
  emojiFallback?: boolean;
}

function typeEmoji(type?: string): string {
  switch ((type || '').toUpperCase()) {
    case 'MANHWA':
      return '🇰🇷';
    case 'MANHUA':
      return '🇨🇳';
    case 'LIGHT_NOVEL':
      return '📕';
    default:
      return '📖';
  }
}

/**
 * Cover image with a styled gradient + series initial fallback when no
 * cover exists (or the image fails to load). Images fade in on load
 * over a shimmer placeholder — no flash of grey, no layout shift.
 */
export function CoverImage({
  src,
  alt = '',
  title,
  type,
  className = '',
  emojiFallback = false,
}: CoverImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const showImg = !!src && !failed;

  // Reset state if a new src arrives on the same mounted instance
  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {showImg ? (
        <>
          {!loaded && <div className="skeleton absolute inset-0" aria-hidden="true" />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src as string}
            alt={alt}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={cn(
              'h-full w-full object-cover transition-opacity duration-500',
              loaded ? 'opacity-100' : 'opacity-0',
            )}
          />
        </>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-mv-surface via-mv-darker to-[#241242]">
          <span className="text-2xl">{emojiFallback ? typeEmoji(type) : title?.charAt(0)?.toUpperCase() || '?'}</span>
          {!emojiFallback && (
            <span className="max-w-[85%] text-center text-[9px] leading-tight text-mv-text-dim">
              {title}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

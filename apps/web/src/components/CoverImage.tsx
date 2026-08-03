'use client';

import { useEffect, useState } from 'react';

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
  switch (type) {
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
 * cover exists (or the image fails to load). Replaces the bare-text
 * fallback blocks scattered across Home/Browse/Library.
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
  const showImg = !!src && !failed;

  // Reset the error state if a new src arrives on the same mounted instance
  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
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

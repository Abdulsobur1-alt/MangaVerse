'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   PageImage — the image layer of the reader.
   • Fade-in: the sharp layer starts transparent and fades in once
     loaded — no flash, no layout shift (the container keeps size)
   • Shimmer placeholder behind the sharp layer while it loads
   • Retry: a failed image gets an inline retry button (never a dead
     hole in the middle of a chapter)
   Preloading of adjacent pages is handled by the reader page itself
   (new Image() warm-up), so this component stays single-purpose.
   ═══════════════════════════════════════════════════════════════ */

interface PageImageProps {
  src: string;
  alt: string;
  /** Fade in once loaded (page mode). Strip mode keeps images eager-visible. */
  fadeIn?: boolean;
  /** Show a shimmer while loading. */
  shimmer?: boolean;
  className?: string;
  eager?: boolean;
}

export function PageImage({ src, alt, fadeIn = true, shimmer = true, className, eager = false }: PageImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Reset state if the src changes (chapter/page navigation)
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src, attempt]);

  if (failed) {
    return (
      <div className={cn('flex min-h-[320px] w-full flex-col items-center justify-center gap-3 bg-mv-darker', className)}>
        <p className="text-xs text-mv-text-muted">This page couldn't load.</p>
        <button
          onClick={() => {
            setFailed(false);
            setLoaded(false);
            setAttempt((a) => a + 1);
          }}
          className="rounded-full border border-mv-border-light bg-mv-surface px-4 py-1.5 text-[11px] font-medium text-mv-text-secondary transition-colors hover:border-mv-violet/50 hover:text-mv-violet"
        >
          ↻ Retry page
        </button>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {/* Shimmer placeholder — no second network request */}
      {shimmer && !loaded && (
        <div className="absolute inset-0 h-full w-full animate-pulse bg-mv-darker" aria-hidden="true" />
      )}
      {/* Sharp image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={`${src}-${attempt}`}
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false);
          setFailed(true);
        }}
        className={cn(
          'relative h-auto w-full object-contain transition-opacity duration-300',
          fadeIn && !loaded && 'opacity-0',
          fadeIn && loaded && 'opacity-100',
        )}
      />
    </div>
  );
}

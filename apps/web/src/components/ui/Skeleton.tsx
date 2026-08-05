'use client';

import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Skeleton — shimmer placeholder. Always pair with a real aspect
   ratio on the parent so layouts never shift once data arrives.
   ═══════════════════════════════════════════════════════════════ */

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

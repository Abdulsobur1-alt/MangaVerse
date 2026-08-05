'use client';

import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Spinner — the single loading indicator. Inherits currentColor so
   it works on any background (pass text-* to tint).
   ═══════════════════════════════════════════════════════════════ */

export interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

export function Spinner({ size = 18, className, label = 'Loading' }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn('inline-block animate-spin rounded-full border-2 border-current border-t-transparent', className)}
      style={{ width: size, height: size }}
    />
  );
}

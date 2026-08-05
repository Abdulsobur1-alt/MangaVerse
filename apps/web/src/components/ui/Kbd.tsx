'use client';

import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Kbd — keyboard-shortcut hint. Used in the command palette, search
   affordances, and reader hints.
   ═══════════════════════════════════════════════════════════════ */

export interface KbdProps {
  className?: string;
  children: React.ReactNode;
}

export function Kbd({ className, children }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-mv-border bg-mv-darker px-1.5 text-[9px] font-medium text-mv-text-dim',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

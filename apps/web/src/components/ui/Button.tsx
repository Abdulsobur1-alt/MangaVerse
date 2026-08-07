'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

/* ═══════════════════════════════════════════════════════════════
   Button — one primitive for every call-to-action.
   Variants: primary (brand fill) · secondary (ghost) · subtle ·
             outline · danger
   Sizes:    sm (10px) · md (12px) · lg (14px)
   Pass `href` to render as a next/link anchor.
   ═══════════════════════════════════════════════════════════════ */

export const buttonVariants = {
  primary: 'btn-primary select-none',
  secondary: 'btn-ghost select-none',
  subtle:
    'inline-flex select-none items-center justify-center gap-2 rounded-tile text-mv-text-secondary font-medium transition-all duration-150 active:scale-[0.98] hover:text-mv-text',
  outline:
    'inline-flex select-none items-center justify-center gap-2 rounded-tile border border-mv-border-strong bg-transparent text-mv-text-secondary font-medium transition-all duration-150 hover:border-mv-violet/50 hover:text-mv-text active:scale-[0.98]',
  danger:
    'inline-flex select-none items-center justify-center gap-2 rounded-tile border border-mv-danger/30 bg-mv-danger/10 text-mv-danger font-medium transition-all duration-150 hover:bg-mv-danger/20 active:scale-[0.98]',
} as const;

export const buttonSizes = {
  sm: 'px-3.5 py-1.5 text-[10px]',
  md: 'px-4 py-2 text-xs',
  lg: 'px-6 py-3 text-sm',
} as const;

export const buttonBase =
  'cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 disabled:pointer-events-none';

export type ButtonVariant = keyof typeof buttonVariants;
export type ButtonSize = keyof typeof buttonSizes;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Show an inline spinner and disable the control. */
  loading?: boolean;
  /** When set, renders as <Link href> instead of <button>. */
  href?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  href,
  className,
  children,
  disabled,
  type,
  ...rest
}: ButtonProps) {
  const classes = cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);

  if (href) {
    const anchorProps = rest as React.AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <Link href={href} className={classes} {...anchorProps}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type ?? 'button'} disabled={disabled || loading} aria-busy={loading} className={classes} {...rest}>
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
}

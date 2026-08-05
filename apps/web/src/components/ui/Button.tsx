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
  primary: 'btn-primary',
  secondary: 'btn-ghost',
  subtle:
    'inline-flex items-center justify-center gap-2 rounded-tile text-mv-text-secondary font-medium transition-colors hover:text-mv-text',
  outline:
    'inline-flex items-center justify-center gap-2 rounded-tile border border-mv-border-strong bg-transparent text-mv-text-secondary font-medium transition-colors hover:border-mv-violet/50 hover:text-mv-text',
  danger:
    'inline-flex items-center justify-center gap-2 rounded-tile bg-mv-danger/10 border border-mv-danger/30 text-mv-danger font-medium transition-colors hover:bg-mv-danger/20',
} as const;

export const buttonSizes = {
  sm: 'px-3.5 py-1.5 text-[10px]',
  md: 'px-4 py-2 text-xs',
  lg: 'px-6 py-3 text-sm',
} as const;

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
  const classes = cn(buttonVariants[variant], buttonSizes[size], className);

  if (href) {
    const anchorProps = rest as React.AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <Link href={href} className={classes} {...anchorProps}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type ?? 'button'} disabled={disabled || loading} className={classes} {...rest}>
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
}

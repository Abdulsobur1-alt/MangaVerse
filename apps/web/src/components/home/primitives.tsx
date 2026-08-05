'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Home discovery primitives — micro-interaction wrappers + the
   section header every rail shares.
   ═══════════════════════════════════════════════════════════════ */

/** Cursor-following magnetic wrapper (hero CTAs). */
export function Magnetic({ children, strength = 0.25 }: { children: React.ReactNode; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.transform = `translate(${(e.clientX - (rect.left + rect.width / 2)) * strength}px, ${(e.clientY - (rect.top + rect.height / 2)) * strength}px)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = 'translate(0, 0)';
  };
  return (
    <div ref={ref} className="magnetic" onMouseMove={onMove} onMouseLeave={onLeave}>
      {children}
    </div>
  );
}

/** Radial cursor-follow glow behind cards. */
export function Spotlight({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  };
  return (
    <div ref={ref} onMouseMove={onMove} className={`spotlight-card ${className}`}>
      {children}
    </div>
  );
}

/** 3D tilt wrapper for grids. */
export function Tilt({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${px * 6}deg) rotateX(${-py * 6}deg)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg)';
  };
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={`tilt-card ${className}`}>
      {children}
    </div>
  );
}

/** Section header with eyebrow icon, title, subtitle, and "View all". */
export function SectionHeader({
  title,
  href,
  sub,
  icon,
  className,
}: {
  title: string;
  href: string;
  sub?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-5 flex items-end justify-between gap-4', className)}>
      <div>
        <h2 className="flex items-center gap-2.5 text-lg font-bold text-white md:text-xl">
          <span className="flex h-6 w-1.5 items-center justify-center rounded-full bg-gradient-to-b from-mv-purple to-mv-accent" aria-hidden="true" />
          {icon}
          <span>{title}</span>
        </h2>
        {sub && <p className="mt-1 pl-4 text-[11px] text-mv-text-muted">{sub}</p>}
      </div>
      <Link
        href={href}
        className="group flex shrink-0 items-center gap-1 rounded-full border border-mv-border-light bg-mv-surface/50 px-3.5 py-1.5 text-[11px] text-mv-text-secondary transition-all hover:border-mv-violet/40 hover:text-mv-violet"
      >
        View all
        <Icon name="chevronRight" size={12} className="transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

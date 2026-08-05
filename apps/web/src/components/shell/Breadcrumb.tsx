'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';

/* ═══════════════════════════════════════════════════════════════
   Breadcrumb — "where am I / where did I come from" trail in the
   top bar. Known routes map to friendly labels; dynamic segments
   (slugs) are humanized. Renders desktop-only (lg+).
   ═══════════════════════════════════════════════════════════════ */

const ROUTE_MAP: Record<string, string> = {
  '/browse': 'Discover',
  '/library': 'Library',
  '/history': 'History',
  '/community': 'Community',
  '/notifications': 'Alerts',
  '/dashboard': 'Profile',
  '/settings': 'Settings',
  '/reviews': 'Reviews',
  '/download': 'Get the App',
  '/admin': 'Admin',
};

function humanize(segment: string): string {
  if (segment === 'title') return 'Title';
  return segment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Breadcrumb() {
  const pathname = usePathname();
  // The reader is a fully immersive surface — no breadcrumbs there.
  if (pathname === '/' || pathname.startsWith('/reader')) return null;

  const parts = pathname.split('/').filter(Boolean);
  const crumbs: { href?: string; label: string }[] = [{ href: '/', label: 'Home' }];
  let acc = '';
  parts.forEach((seg, i) => {
    acc += `/${seg}`;
    const isLast = i === parts.length - 1;
    const label = ROUTE_MAP[acc] ?? humanize(seg);
    // Only known routes and the root become links — avoids 404 stubs.
    crumbs.push({ href: !isLast && (acc === '/' || ROUTE_MAP[acc]) ? acc : undefined, label });
  });

  return (
    <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 text-xs lg:flex">
      {crumbs.map((crumb, i) => (
        <span key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
          {i > 0 && <Icon name="chevronRight" size={12} className="text-mv-text-dim" />}
          {crumb.href ? (
            <Link href={crumb.href} className="text-mv-text-muted transition-colors hover:text-mv-violet">
              {crumb.label}
            </Link>
          ) : (
            <span className="font-medium text-mv-text-secondary" aria-current="page">
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

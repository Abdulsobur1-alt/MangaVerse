'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Kbd } from '@/components/ui/Kbd';
import { Breadcrumb } from '@/components/shell/Breadcrumb';
import { ThemeSwitcher } from '@/components/shell/ThemeSwitcher';
import { NotificationCenter } from '@/components/shell/NotificationCenter';
import { ProfileMenu } from '@/components/shell/ProfileMenu';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   TopBar — the global top navigation: mobile logo, breadcrumbs,
   search affordances, get-app, theme switch, notifications, avatar.
   The reader reuses this bar in its loading/error/lock states.
   ═══════════════════════════════════════════════════════════════ */

interface TopBarProps {
  /** Opens the global search palette (⌘K). Hidden when not provided. */
  onOpenSearch?: () => void;
  /** Use the immersive variant (reader). */
  immersive?: boolean;
}

export function TopBar({ onOpenSearch, immersive }: TopBarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex min-h-12 items-center gap-1 border-b border-mv-border/70 px-2.5 py-1.5 backdrop-blur-xl sm:min-h-14 sm:gap-2 sm:px-4 pt-safe',
        immersive ? 'bg-black/80' : 'bg-mv-darker/75',
      )}
    >
      {/* Mobile logo (desktop logo lives in the sidebar) */}
      <Link href="/" className="group flex items-center gap-2 md:hidden">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-mv-purple to-mv-accent shadow-glow-sm transition-transform group-hover:scale-105">
          <Icon name="library" size={16} strokeWidth={2.2} className="text-white" />
        </span>
        <span className="text-lg font-bold tracking-tight">
          <span className="bg-gradient-to-r from-mv-violet to-mv-purple bg-clip-text text-transparent">Manga</span>
          <span className="text-white">Verse</span>
        </span>
      </Link>

      {/* Breadcrumb — desktop context trail */}
      <Breadcrumb />

      <div className="ml-auto flex items-center gap-1 sm:gap-2.5">
        {/* Search — desktop pill */}
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            className="hidden h-9 items-center gap-2 rounded-xl border border-mv-border-light bg-mv-surface px-3 text-xs text-mv-text-muted transition-colors hover:border-mv-violet/40 hover:text-mv-text-secondary lg:flex"
          >
            <Icon name="search" size={16} />
            Search titles…
            <Kbd className="ml-4">⌘K</Kbd>
          </button>
        )}
        {/* Search — mobile icon */}
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            aria-label="Search"
            className="tap-target h-10 w-10 rounded-xl text-mv-text-secondary transition-colors hover:bg-white/5 hover:text-white lg:hidden"
          >
            <Icon name="search" size={18} />
          </button>
        )}

        {/* Get the App */}
        <Link
          href="/download"
          className="hidden items-center gap-1.5 rounded-full border border-mv-violet/30 bg-mv-violet/10 px-3.5 py-1.5 text-[10px] font-medium text-mv-violet transition-all hover:border-mv-violet/60 hover:bg-mv-violet/20 sm:flex"
        >
          <Icon name="download" size={12} />
          Get App
        </Link>

        {/* Theme switch — visible at every size so mobile isn't locked to one theme */}
        <ThemeSwitcher />

        {/* Notifications */}
        <NotificationCenter />

        {/* Avatar / account */}
        <ProfileMenu />
      </div>
    </header>
  );
}

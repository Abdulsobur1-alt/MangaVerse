'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   ThemeSwitcher — flips <html data-theme="light"> (see globals.css
   light-theme layer) and persists the choice. Multiple instances
   (top bar + sidebar) stay in sync via localStorage storage events
   and a same-tab custom event. Dark is the default; light flips
   the semantic tokens and native chrome for migrated pages.
   ═══════════════════════════════════════════════════════════════ */

const THEME_KEY = 'mangaverse_theme';
const THEME_EVENT = 'mangaverse:theme';

function applyTheme(theme: 'dark' | 'light') {
  const root = document.documentElement;
  if (theme === 'light') root.setAttribute('data-theme', 'light');
  else root.removeAttribute('data-theme');
}

export interface ThemeSwitcherProps {
  /** Show the label next to the icon (expanded sidebar mode). */
  labelled?: boolean;
  className?: string;
}

export function ThemeSwitcher({ labelled = false, className }: ThemeSwitcherProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // Hydrate from storage and keep every instance in sync
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') {
        setTheme(saved);
        applyTheme(saved);
      }
    } catch {
      // ignore storage errors
    }

    const onThemeEvent = (e: Event) => {
      const next = (e as CustomEvent).detail as 'dark' | 'light';
      setTheme(next);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
        setTheme(e.newValue);
      }
    };
    window.addEventListener(THEME_EVENT, onThemeEvent);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(THEME_EVENT, onThemeEvent);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const toggle = () => {
    const next: 'dark' | 'light' = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore storage errors
    }
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
  };

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={!isDark}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      className={cn(
        'flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-mv-text-muted transition-colors hover:bg-white/5 hover:text-mv-text',
        labelled ? 'w-full' : 'tap-target h-10 w-10 justify-center hover:text-white',
        className,
      )}
    >
      <Icon name={isDark ? 'brightness' : 'moon'} size={20} strokeWidth={1.8} className="shrink-0" />
      {labelled && (
        <span className="whitespace-nowrap text-xs font-medium opacity-0 transition-opacity duration-200 group-hover/side:opacity-100">
          {isDark ? 'Light theme' : 'Dark theme'}
        </span>
      )}
    </button>
  );
}

'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { Sidebar } from '@/components/shell/Sidebar';
import { BottomNav } from '@/components/shell/BottomNav';
import { CommandPalette } from '@/components/shell/CommandPalette';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   AppShell — the operating system every page renders inside.
   • Desktop:  collapsible sectioned sidebar (hover expands)
   • Mobile:   bottom navigation + floating search + Continue pill
   • Global:   ⌘K + "/" command palette · top loading bar ·
               subtle page transitions on route change
   Pages render <AppShell>…content…</AppShell>.
   ═══════════════════════════════════════════════════════════════ */

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);

  // ── Keyboard shortcuts: ⌘K toggles palette, "/" opens it ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === '/' && !typing && !paletteOpen) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [paletteOpen]);

  // ── Global loading bar + page transition on route change ──
  useEffect(() => {
    setNavigating(true);
    const t = setTimeout(() => setNavigating(false), 500);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-app text-ink">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Content column */}
      <div className="md:pl-14">
        <TopBar onOpenSearch={() => setPaletteOpen(true)} />
        <main
          key={pathname}
          tabIndex={-1}
          className="animate-page-enter min-h-[calc(100vh-56px)] pb-24 md:pb-0 outline-none"
        >
          {children}
        </main>
      </div>

      {/* Mobile bottom nav + floating search + Continue pill */}
      <BottomNav onOpenSearch={() => setPaletteOpen(true)} />

      {/* Global search palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Route-change loading bar */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 transition-opacity duration-300',
          navigating ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div className="animate-loading-bar h-full w-full bg-gradient-to-r from-mv-purple via-mv-accent to-mv-violet" />
      </div>
    </div>
  );
}

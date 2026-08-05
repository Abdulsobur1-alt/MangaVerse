'use client';

import { Icon } from '@/components/ui/Icon';
import { Kbd } from '@/components/ui/Kbd';

/* ═══════════════════════════════════════════════════════════════
   ShortcutHelp — "?" dialog listing every reader shortcut, grouped.
   ═══════════════════════════════════════════════════════════════ */

const GROUPS: { title: string; rows: [string, string][] }[] = [
  {
    title: 'Navigation',
    rows: [
      ['← / →', 'Previous / next page or chapter'],
      ['↑ / ↓', 'Scroll (strip & prose)'],
      ['Space', 'Next page / scroll'],
      ['PgUp / PgDn', 'Jump a viewport'],
      ['Home / End', 'Chapter start / end'],
    ],
  },
  {
    title: 'Reader',
    rows: [
      ['F', 'Toggle fullscreen'],
      ['C', 'Chapter list'],
      ['A', 'Auto-scroll on / off'],
      ['M', 'Prose mode (light novels)'],
      ['B', 'Bookmark this page'],
      ['T', 'Cycle prose theme'],
      ['Z', 'Focus mode (hide UI)'],
      ['Esc', 'Close UI / exit fullscreen'],
    ],
  },
  {
    title: 'Controls',
    rows: [
      ['?', 'Show this dialog'],
      ['Tap edges', 'Turn pages (page mode)'],
      ['Double-tap', 'Zoom (strip) / toggle UI'],
    ],
  },
];

export function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-mv-border bg-mv-darker shadow-modal animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-mv-border px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white">
            <Icon name="zap" size={15} className="text-mv-violet" />
            Shortcuts
          </h2>
          <button onClick={onClose} aria-label="Close shortcuts" className="flex h-7 w-7 items-center justify-center rounded-lg text-mv-text-muted transition-colors hover:bg-white/5 hover:text-white">
            <Icon name="close" size={14} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {GROUPS.map((group) => (
            <div key={group.title} className="mb-4 last:mb-0">
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">{group.title}</p>
              <div className="space-y-1.5">
                {group.rows.map(([keys, desc]) => (
                  <div key={keys} className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-mv-text-secondary">{desc}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {keys.split(' / ').map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

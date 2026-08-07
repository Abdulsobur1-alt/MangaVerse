import Link from 'next/link';

/* ═══════════════════════════════════════════════════════════════
   LegalFooter — the quiet links row at the bottom of AppShell.
   ═══════════════════════════════════════════════════════════════ */

export function LegalFooter() {
  return (
    <footer className="border-t border-mv-border/40 px-4 py-4">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[9px] text-mv-text-dim">
        <span>© {new Date().getFullYear()} MangaVerse</span>
        <span aria-hidden="true" className="opacity-40">·</span>
        <Link href="/privacy" className="transition-colors hover:text-mv-text">
          Privacy
        </Link>
        <span aria-hidden="true" className="opacity-40">·</span>
        <Link href="/terms" className="transition-colors hover:text-mv-text">
          Terms
        </Link>
        <span aria-hidden="true" className="opacity-40">·</span>
        <Link href="/dmca" className="transition-colors hover:text-mv-text">
          DMCA
        </Link>
      </div>
    </footer>
  );
}

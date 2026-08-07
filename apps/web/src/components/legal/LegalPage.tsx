import Link from 'next/link';

/* ═══════════════════════════════════════════════════════════════
   LegalPage — consistent shell for /privacy, /terms and /dmca.
   Server-safe (no hooks) so the pages stay lightweight & crawlable.
   ═══════════════════════════════════════════════════════════════ */

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-mv-dark text-mv-text">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16">
        <nav className="mb-10 flex items-center gap-2 text-[10px] text-mv-text-dim">
          <Link href="/" className="transition-colors hover:text-mv-accent">
            MangaVerse
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-mv-text-secondary">{title}</span>
        </nav>
        <h1 className="text-2xl font-bold text-white md:text-3xl">{title}</h1>
        <p className="mt-1.5 text-[10px] text-mv-text-dim">Last updated: {updated}</p>
        <div className="mt-8 space-y-7 text-[13px] leading-relaxed text-mv-text-secondary">
          {children}
        </div>
        <p className="mt-14 border-t border-mv-border/50 pt-6 text-[10px] text-mv-text-dim">
          Questions? Contact{' '}
          <a href="mailto:legal@mangaverse.app" className="text-mv-accent hover:underline">
            legal@mangaverse.app
          </a>
        </p>
      </div>
    </main>
  );
}

export function LegalH2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-white">{children}</h2>;
}

export function LegalP({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

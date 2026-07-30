import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-mv-dark">
      {/* Top Bar */}
      <header className="flex h-12 items-center border-b border-mv-border bg-mv-darker px-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight text-mv-accent">
            Manga<span className="text-mv-purple">Verse</span>
          </span>
        </div>
        <nav className="ml-8 hidden items-center gap-1 md:flex">
          {['Home', 'Browse', 'Reader', 'Community', 'Dashboard'].map(
            (item) => (
              <Link
                key={item}
                href="#"
                className="rounded-md px-3 py-1.5 text-xs text-mv-text-secondary transition-colors hover:bg-mv-surface hover:text-mv-text"
              >
                {item}
              </Link>
            ),
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-mv-border-light bg-mv-surface px-3 py-1.5">
            <span className="text-xs font-medium text-mv-gold">120</span>
          </div>
          <button className="rounded-md bg-mv-accent px-3 py-1.5 text-xs font-medium text-white">
            Go Premium
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative flex h-[280px] items-end overflow-hidden bg-gradient-to-br from-[#0f0820] via-[#1a0535] to-[#0d1040]">
        <div className="absolute inset-0 opacity-30">
          <div className="grid h-full grid-cols-4 gap-2 p-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="rounded-md"
                style={{
                  background: [
                    '#2d1b69',
                    '#1b3a69',
                    '#69201b',
                    '#1b6940',
                    '#5e1b69',
                    '#1b5269',
                    '#693a1b',
                    '#1b6969',
                    '#3d1b69',
                    '#1b2d5e',
                    '#5e1b2d',
                    '#1b5e3d',
                  ][i],
                }}
              />
            ))}
          </div>
        </div>
        <div className="relative z-10 max-w-xl p-8">
          <span className="mb-3 inline-block rounded-full bg-mv-accent px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            🔥 Trending #1 Worldwide
          </span>
          <h1 className="text-2xl font-bold leading-tight text-white">
            Solo Leveling: Ragnarök
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Manhwa · Action · Fantasy · Ch. 182 just dropped
          </p>
          <div className="mt-4 flex gap-3">
            <button className="rounded-md bg-mv-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500">
              Read Now
            </button>
            <button className="rounded-md border border-gray-600 bg-transparent px-5 py-2 text-sm text-gray-300 transition-colors hover:border-gray-500">
              + Library
            </button>
          </div>
        </div>
      </section>

      {/* Content Sections */}
      <div className="mx-auto max-w-7xl space-y-8 p-6">
        {/* Continue Reading */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-medium text-white">
              Continue Reading
            </h2>
            <span className="cursor-pointer text-xs text-mv-accent">
              View all
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[
              {
                title: "Omniscient Reader's Viewpoint",
                ch: 'Ch.198 · 89% done',
                color: '#2d1b69',
              },
              {
                title: 'Solo Leveling: Ragnarök',
                ch: 'Just updated',
                color: '#69201b',
              },
              {
                title: 'Sword Art Online LN',
                ch: 'Up to date',
                color: '#1b3a69',
              },
              {
                title: 'Blue Lock',
                ch: 'Updated 8h ago',
                color: '#1b6940',
              },
              {
                title: 'Chainsaw Man',
                ch: 'Updated 5h ago',
                color: '#5e1b69',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="w-[100px] flex-shrink-0 cursor-pointer"
              >
                <div
                  className="relative h-[140px] rounded-lg transition-transform hover:-translate-y-1"
                  style={{ background: item.color }}
                >
                  <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                    {item.ch.split('·')[0]}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-gray-400 line-clamp-2">
                  {item.title}
                </p>
                <p className="text-[10px] text-mv-text-muted">{item.ch}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Browse by Genre */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-medium text-white">
              Browse by Genre
            </h2>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              'All',
              'Action',
              'Romance',
              'Isekai',
              'Horror',
              'Fantasy',
              'Cultivation',
              'Slice of Life',
            ].map((genre) => (
              <span
                key={genre}
                className="cursor-pointer rounded-full bg-mv-surface px-3 py-1 text-[10px] text-mv-text-secondary transition-colors hover:border-mv-accent hover:text-mv-accent"
              >
                {genre}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {[
              { title: "Omniscient Reader's Viewpoint", sub: 'Manhwa · Ch.221' },
              { title: 'Tower of God', sub: 'Manhwa · Ch.600' },
              { title: 'Demon Slayer', sub: 'Manga · Ch.205' },
              {
                title: 'Beginning After the End',
                sub: 'Manhwa · Ch.195',
              },
            ].map((item) => (
              <div key={item.title} className="cursor-pointer">
                <div className="aspect-[3/4] w-full rounded-lg bg-mv-darker" />
                <p className="mt-1.5 text-xs text-gray-400 line-clamp-2">
                  {item.title}
                </p>
                <p className="text-[10px] text-mv-text-muted">{item.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Hot This Week */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-medium text-white">Hot This Week</h2>
            <span className="cursor-pointer text-xs text-mv-accent">
              Full chart
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[
              { title: 'My Hero Academia', ch: 'Ch.432', color: '#1b2d5e' },
              { title: 'Jujutsu Kaisen', ch: 'Ch.266', color: '#5e1b2d' },
              { title: 'Eleceed', ch: 'Ch.270', color: '#3d1b69' },
              { title: 'Tales of Demons', ch: 'Ch.488', color: '#1b5e3d' },
              { title: 'One Piece', ch: 'Ch.1115', color: '#5e3d1b' },
            ].map((item, idx) => (
              <div
                key={item.title}
                className="w-[100px] flex-shrink-0 cursor-pointer"
              >
                <div
                  className="relative h-[140px] rounded-lg"
                  style={{ background: item.color }}
                >
                  <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                    #{idx + 1}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-gray-400 line-clamp-2">
                  {item.title}
                </p>
                <p className="text-[10px] text-mv-text-muted">{item.ch}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-mv-border bg-mv-darker py-8 text-center text-xs text-mv-text-muted">
        <p>MangaVerse © {new Date().getFullYear()}</p>
      </footer>
    </main>
  );
}

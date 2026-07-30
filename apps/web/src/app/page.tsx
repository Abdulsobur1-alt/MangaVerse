'use client';

import Link from 'next/link';
import { TopBar } from '@/components/TopBar';
import { useTrendingTitles, useTitles } from '@/lib/hooks/useTitles';

const GENRES = [
  'All', 'Action', 'Romance', 'Isekai', 'Horror', 'Fantasy',
  'Cultivation', 'Slice of Life', 'Mystery', 'Sports', 'Mecha',
];

export default function HomePage() {
  const { data: trending } = useTrendingTitles();
  const { data: latest } = useTitles({ sort: 'newest', limit: 10 });

  const heroTitle = trending?.[0];

  return (
    <main className="min-h-screen bg-mv-dark">
      <TopBar />

      {/* Hero Section */}
      <section className="relative flex h-[300px] items-end overflow-hidden bg-gradient-to-br from-[#0f0820] via-[#1a0535] to-[#0d1040]">
        <div className="absolute inset-0 opacity-20">
          <div className="grid h-full grid-cols-4 gap-2 p-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="rounded-md"
                style={{ background: ['#2d1b69','#1b3a69','#69201b','#1b6940','#5e1b69','#1b5269','#693a1b','#1b6969','#3d1b69','#1b2d5e','#5e1b2d','#1b5e3d'][i] }}
              />
            ))}
          </div>
        </div>
        <div className="relative z-10 w-full max-w-2xl p-8">
          <span className="mb-3 inline-block rounded-full bg-mv-accent px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            🔥 Trending #1
          </span>
          <h1 className="text-2xl font-bold leading-tight text-white md:text-3xl">
            {heroTitle?.title || 'Solo Leveling: Ragnarök'}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {heroTitle?.genres?.slice(0, 3).join(' · ') || 'Action · Fantasy · Manhwa'}
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href={heroTitle ? `/title/${heroTitle.slug}` : '#'}
              className="rounded-md bg-mv-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
            >
              Read Now
            </Link>
            <button className="rounded-md border border-gray-600 bg-transparent px-5 py-2 text-sm text-gray-300 transition-colors hover:border-gray-500">
              + Library
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-10 p-6">
        {/* Trending Carousel */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-medium text-white">Trending Now</h2>
            <Link href="/browse?sort=trending" className="cursor-pointer text-xs text-mv-accent hover:underline">
              View all
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {trending?.slice(0, 10).map((item, idx) => (
              <Link key={item.id} href={`/title/${item.slug}`} className="w-[100px] flex-shrink-0 cursor-pointer group">
                <div className="relative h-[140px] rounded-lg bg-mv-darker transition-transform group-hover:-translate-y-1 flex items-center justify-center overflow-hidden">
                  <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                    #{idx + 1}
                  </span>
                  <span className="text-center text-[10px] text-mv-text-muted px-2 leading-tight">{item.title}</span>
                </div>
                <p className="mt-1.5 text-xs text-gray-400 line-clamp-2">{item.title}</p>
                <p className="text-[10px] text-mv-text-muted">{item.type} · {item.totalChapters || '?'} ch</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Genre Pills */}
        <section>
          <h2 className="mb-3 text-base font-medium text-white">Browse by Genre</h2>
          <div className="mb-6 flex flex-wrap gap-2">
            {GENRES.map((genre) => (
              <Link
                key={genre}
                href={genre === 'All' ? '/browse' : `/browse?genre=${genre.toLowerCase()}`}
                className="rounded-full bg-mv-surface px-4 py-1.5 text-[11px] text-mv-text-secondary transition-all hover:border-mv-accent hover:text-mv-accent hover:bg-mv-darker border border-transparent"
              >
                {genre}
              </Link>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {latest?.items?.slice(0, 10).map((item) => (
              <Link key={item.id} href={`/title/${item.slug}`} className="group cursor-pointer">
                <div className="aspect-[3/4] w-full rounded-lg bg-mv-darker flex items-center justify-center transition-transform group-hover:scale-[1.02]">
                  <span className="text-xs text-mv-text-muted text-center px-2">{item.title}</span>
                </div>
                <p className="mt-1.5 text-xs text-gray-400 line-clamp-2">{item.title}</p>
                <p className="text-[10px] text-mv-text-muted">{item.type} · ⭐ {item.rating?.toFixed(1) || 'N/A'}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <footer className="border-t border-mv-border bg-mv-darker py-8 text-center text-xs text-mv-text-muted">
        <p>MangaVerse © {new Date().getFullYear()} — The Ultimate Reading Ecosystem</p>
      </footer>
    </main>
  );
}

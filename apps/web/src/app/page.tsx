'use client';

import { useMemo, type CSSProperties } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { Reveal } from '@/components/Reveal';
import { CoverImage } from '@/components/CoverImage';
import { Hero } from '@/components/home/Hero';
import { HomeSearch } from '@/components/home/HomeSearch';
import { TitleCard, TitleCardSkeleton } from '@/components/home/TitleCard';
import { ContinueRail, ContinueRailSkeleton } from '@/components/home/ContinueRail';
import { GenreExplorer } from '@/components/home/GenreExplorer';
import { Magnetic, SectionHeader } from '@/components/home/primitives';
import { buildResumeMap, genreLabel, type HomeTitle, type ResumeInfo } from '@/components/home/types';
import { useTrendingTitles, useTitles, useRecentlyUpdated } from '@/lib/hooks/useTitles';
import { useReadingProgress } from '@/lib/hooks/useReading';
import { useReadingHistory, useReadingStats } from '@/lib/hooks/useReadingStats';
import { useLibrary } from '@/lib/hooks/useLibrary';
import { useAuthStore } from '@/store/authStore';
import { formatTimeAgo } from '@/lib/format';

/* ═══════════════════════════════════════════════════════════════
   Home — the discovery experience (Phase 3).
   Answers, in order:
     1. Where do I continue?  → Continue Reading / Unread Updates
     2. What should I read?    → Because You Read / Trending / Picks
     3. Why should I read it?  → editorial hero + synopsis + meta
     4. What did I miss?       → Recently Updated / New Releases
   Guests get a curated onboarding shelf instead of dead rails.
   ═══════════════════════════════════════════════════════════════ */

const CATEGORY_RAILS = [
  { key: 'manga', label: 'Manga', emoji: '🇯🇵', desc: 'Page-flip comics', href: '/browse?format=manga', accent: 'from-mv-purple to-mv-accent' },
  { key: 'manhwa', label: 'Manhwa', emoji: '🇰🇷', desc: 'Vertical webtoons', href: '/browse?format=manhwa', accent: 'from-mv-violet to-mv-purple' },
  { key: 'manhua', label: 'Manhua', emoji: '🇨🇳', desc: 'Long-form webtoons', href: '/browse?format=manhua', accent: 'from-mv-accent to-mv-violet' },
  { key: 'light_novel', label: 'Light Novels', emoji: '📕', desc: 'Prose, not pages', href: '/browse?format=light_novel', accent: 'from-mv-purple to-mv-violet' },
];

/** Compact "recently viewed" item — history is per-chapter, so dedupe by series. */
function useRecentlyViewed() {
  const { data } = useReadingHistory(1, 30);
  return useMemo(() => {
    const seen = new Map<string, { chapterId: string; chapterNumber: number; updatedAt: string; slug: string; title: string; coverUrl: string | null }>();
    (data?.items ?? []).forEach((h) => {
      const series = h.chapter.series;
      const existing = seen.get(series.slug);
      if (existing && h.chapter.number <= existing.chapterNumber) return;
      seen.set(series.slug, {
        chapterId: h.chapter.id,
        chapterNumber: h.chapter.number,
        updatedAt: h.updatedAt,
        slug: series.slug,
        title: series.title,
        coverUrl: series.coverUrl,
      });
    });
    return [...seen.values()].slice(0, 8);
  }, [data]);
}

export default function HomePage() {
  const { token } = useAuthStore();
  const { data: trending, isLoading: trendingLoading } = useTrendingTitles();
  const { data: latest } = useTitles({ sort: 'newest', limit: 12 });
  const { data: editorsPicks, isLoading: picksLoading } = useTitles({ sort: 'rating', limit: 12 });
  const { data: recentlyUpdated, isLoading: updatesLoading } = useRecentlyUpdated();
  const { data: readingData, isLoading: readingLoading } = useReadingProgress(!!token);
  const { data: stats } = useReadingStats();
  const { data: libraryData } = useLibrary(undefined, !!token);
  const recentlyViewed = useRecentlyViewed();

  // ── Derived pools ────────────────────────────────────────
  const trendingList = (trending ?? []).slice(0, 10) as HomeTitle[];
  const heroTitles = trendingList.slice(0, 5);
  const picks = (editorsPicks?.items ?? []).slice(0, 10) as HomeTitle[];
  const newReleases = (latest?.items ?? []).slice(0, 12) as HomeTitle[];
  // Recently-updated items omit author/createdAt — TitleCard only needs the subset.
  const recentUpdates = (recentlyUpdated ?? []) as unknown as HomeTitle[];

  const resumeMap = useMemo(() => buildResumeMap(readingData as any), [readingData]);

  // Pool for the genre explorer: trending + picks + new + recent (deduped).
  const discoveryPool = useMemo(() => {
    const map = new Map<string, HomeTitle>();
    [...trendingList, ...picks, ...newReleases, ...recentUpdates].forEach((t) => map.set(t.id, t));
    return [...map.values()];
  }, [trendingList, picks, newReleases, recentUpdates]);

  // ── Personalization ──────────────────────────────────────
  const resumeEntries = useMemo(() => [...resumeMap.values()].sort((a, b) => (b.lastReadAt ?? '').localeCompare(a.lastReadAt ?? '')), [resumeMap]);
  // In-progress series only — finished ones belong to the library, not Continue Reading.
  const continueEntries = resumeEntries.filter((e) => !e.completed).slice(0, 5);
  const readTitleIds = new Set(resumeMap.keys());

  // Because You Read — top genre from reading stats.
  const topGenre = stats?.genreDistribution?.sort((a, b) => b.count - a.count)[0]?.genre;
  const { data: becauseData } = useTitles({ genre: topGenre, limit: 10, sort: 'rating', enabled: !!topGenre });
  const becauseYouRead = useMemo(
    () => ((becauseData?.items ?? []) as HomeTitle[]).filter((t) => !readTitleIds.has(t.id)).slice(0, 8),
    [becauseData, readTitleIds],
  );

  // Unread updates — library titles with a newer chapter than you've read.
  // Approximation: intersects the user's library with the (cached, top-12)
  // recently-updated feed. A title must have been started to count as an
  // "update", so brand-new saves are excluded on purpose.
  const unreadUpdates = useMemo(() => {
    if (!token || !libraryData) return [] as HomeTitle[];
    const recentMap = new Map(recentUpdates.map((t) => [t.id, t]));
    return (libraryData.items ?? [])
      .map((b) => recentMap.get(b.titleId))
      .filter((t): t is HomeTitle => {
        if (!t?.latestChapter) return false;
        const resume = resumeMap.get(t.id);
        if (!resume) return false; // never started → not an "update"
        return t.latestChapter.number > resume.chapterNumber;
      })
      .slice(0, 8);
  }, [token, libraryData, recentUpdates, resumeMap]);

  const streak = stats?.streakDays ?? 0;
  const isGuest = !token;

  return (
    <AppShell>
      {/* ─── Hero ──────────────────────────────────────────── */}
      {trendingLoading || heroTitles.length === 0 ? (
        <div className="relative h-[520px] overflow-hidden md:h-[560px]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#150b2e] via-[#1a0f38] to-[#0d0d12]" />
          <div className="skeleton absolute inset-x-8 bottom-16 h-40 max-w-2xl rounded-2xl" />
        </div>
      ) : (
        <Hero titles={heroTitles} resume={resumeMap} />
      )}

      {/* ─── Hot this week marquee ─────────────────────────── */}
      {trendingList.length > 0 && (
        <div className="relative overflow-hidden border-y border-mv-border/60 bg-mv-darker/60 py-2.5">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-mv-darker to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-mv-darker to-transparent" />
          <div className="marquee">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex shrink-0 items-center">
                {trendingList.map((item, idx) => (
                  <Link key={`${dup}-${item.id}`} href={`/title/${item.slug}`} className="flex items-center gap-2 px-5 text-[11px] text-mv-text-secondary transition-colors hover:text-mv-violet">
                    <span className="text-[9px] font-bold text-mv-violet">#{idx + 1}</span>
                    <span className="max-w-[180px] truncate">{item.title}</span>
                    {item.latestChapter && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-mv-text-muted">Ch. {item.latestChapter.number}</span>}
                    <span className="text-mv-text-dim">·</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl space-y-14 px-5 py-10 sm:px-6 md:px-8">
        {/* ─── Search preview ──────────────────────────────── */}
        <Reveal>
          <section aria-label="Search">
            <p className="eyebrow mb-3 justify-center sm:justify-start">Discover</p>
            <HomeSearch />
          </section>
        </Reveal>

        {/* ─── Personalized zone ───────────────────────────── */}
        {isGuest ? (
          /* Onboarding: no data yet — curated handoff + sign-in CTA */
          <Reveal>
            <section className="relative overflow-hidden rounded-3xl border border-mv-border bg-gradient-to-br from-mv-darker via-mv-surface/60 to-mv-darker p-7 md:p-10">
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-mv-accent/20 blur-3xl" />
              <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
                <div className="max-w-xl">
                  <span className="inline-flex items-center gap-2 rounded-full border border-mv-violet/30 bg-mv-violet/10 px-3 py-1 text-[10px] font-medium text-mv-violet">
                    ✨ Your shelf is waiting
                  </span>
                  <h2 className="mt-4 text-2xl font-bold tracking-tight text-white md:text-3xl">
                    Read anything, <span className="text-gradient">anywhere</span> — we'll remember your place.
                  </h2>
                  <p className="mt-3 text-sm text-mv-text-secondary">
                    Sign in to sync progress, build a library, and get picks tuned to your taste. Until then, dive into what's trending below.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Magnetic>
                      <Link href="/login" className="btn-primary px-6 py-2.5 text-sm">
                        Sign in — it's free
                      </Link>
                    </Magnetic>
                    <Magnetic>
                      <Link href="/signup" className="btn-ghost px-6 py-2.5 text-sm">Create account</Link>
                    </Magnetic>
                  </div>
                </div>
                <div className="hidden shrink-0 text-6xl opacity-80 md:block" aria-hidden="true">📚</div>
              </div>
            </section>
          </Reveal>
        ) : (
          <>
            {/* Continue Reading */}
            <Reveal>
              {readingLoading ? (
                <ContinueRailSkeleton />
              ) : continueEntries.length > 0 ? (
                <ContinueRail entries={continueEntries} showStreak={streak} />
              ) : (
                <section className="card flex flex-col items-center rounded-3xl px-6 py-12 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-mv-purple/20 to-mv-accent/10">
                    <svg className="h-7 w-7 text-mv-violet" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-mv-text">Nothing in progress yet</p>
                  <p className="mt-1 max-w-sm text-xs text-mv-text-muted">Open any title and start reading — your place will be saved automatically.</p>
                  <Link href="/browse" className="btn-primary mt-6 px-5 py-2.5 text-xs">Start Reading</Link>
                </section>
              )}
            </Reveal>

            {/* Unread updates */}
            {unreadUpdates.length > 0 && (
              <Reveal>
                <section aria-label="Unread updates">
                  <SectionHeader title="Unread Updates" href="/library" sub="New chapters for your shelf" icon={<span aria-hidden="true">🔔</span>} />
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                    {unreadUpdates.map((item) => (
                      <TitleCard key={item.id} item={item} badge={`New · Ch. ${item.latestChapter?.number}`} progress={resumeMap.get(item.id)?.pct} />
                    ))}
                  </div>
                </section>
              </Reveal>
            )}

            {/* Because You Read */}
            {topGenre && becauseYouRead.length > 0 && (
              <Reveal>
                <section aria-label="Recommended for you">
                  <SectionHeader title={`Because you read ${genreLabel(topGenre)}`} href={`/browse?genres=${topGenre}`} sub="Tuned to your taste" icon={<span aria-hidden="true">🎯</span>} />
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                    {becauseYouRead.map((item) => (
                      <TitleCard key={item.id} item={item} progress={resumeMap.get(item.id)?.pct} />
                    ))}
                  </div>
                </section>
              </Reveal>
            )}

            {/* Recently viewed */}
            {recentlyViewed.length > 0 && (
              <Reveal>
                <section aria-label="Recently viewed">
                  <SectionHeader title="Recently Viewed" href="/history" sub="Jump back in" icon={<span aria-hidden="true">🕘</span>} />
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                    {recentlyViewed.map((v) => (
                      <Link key={v.slug} href={`/reader/${v.chapterId}`} className="group w-[150px] shrink-0">
                        <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-mv-border bg-mv-surface">
                          <CoverImage src={v.coverUrl} title={v.title} type="MANGA" className="h-full w-full" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                          <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
                            Ch. {v.chapterNumber}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs text-mv-text-secondary transition-colors group-hover:text-white">{v.title}</p>
                        <p className="mt-0.5 text-[9px] text-mv-text-muted">{formatTimeAgo(v.updatedAt)}</p>
                      </Link>
                    ))}
                  </div>
                </section>
              </Reveal>
            )}
          </>
        )}

        {/* ─── Trending Today ──────────────────────────────── */}
        <Reveal>
          <section aria-label="Trending now">
            <SectionHeader title="Trending Today" href="/browse?sort=trending" sub="What everyone is reading this week" icon={<span aria-hidden="true">🔥</span>} />
            {trendingLoading ? (
              <div className="flex gap-3 overflow-hidden"><TitleCardSkeleton count={8} /></div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                {trendingList.map((item, idx) => (
                  <TitleCard key={item.id} item={item} rank={idx + 1} progress={resumeMap.get(item.id)?.pct} />
                ))}
              </div>
            )}
          </section>
        </Reveal>

        {/* ─── Editor's Picks ──────────────────────────────── */}
        {picks.length > 0 && (
          <Reveal>
            <section aria-label="Editor's picks">
              <SectionHeader title="Editor's Picks" href="/browse?sort=rating" sub="Hand-picked, top-rated series" icon={<span aria-hidden="true">⭐</span>} />
              {picksLoading ? (
                <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i}><div className="skeleton aspect-[3/4] rounded-xl" /><div className="skeleton mt-2 h-3 w-4/5 rounded" /></div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5">
                  {picks.map((item) => (
                    <TitleCard key={item.id} item={item} fluid progress={resumeMap.get(item.id)?.pct} />
                  ))}
                </div>
              )}
            </section>
          </Reveal>
        )}

        {/* ─── Recently Updated ────────────────────────────── */}
        <Reveal>
          <section aria-label="Recently updated">
            <SectionHeader title="Recently Updated" href="/browse?sort=updated" sub="Fresh chapters, just dropped" icon={<span aria-hidden="true">🆕</span>} />
            {updatesLoading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i}><div className="skeleton aspect-[3/4] rounded-xl" /><div className="skeleton mt-2 h-3 w-4/5 rounded" /></div>
                ))}
              </div>
            ) : recentUpdates.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {recentUpdates.slice(0, 12).map((item) => (
                  <TitleCard key={item.id} item={item} fluid progress={resumeMap.get(item.id)?.pct} badge={item.latestChapter ? `Ch. ${item.latestChapter.number}` : undefined} />
                ))}
              </div>
            ) : (
              <div className="card rounded-2xl p-10 text-center">
                <p className="text-sm text-mv-text-muted">No recent updates yet</p>
                <p className="mt-1 text-xs text-mv-text-dim">Check back soon for new chapters</p>
              </div>
            )}
          </section>
        </Reveal>

        {/* ─── Browse by Format ────────────────────────────── */}
        <Reveal>
          <section aria-label="Browse by format">
            <SectionHeader title="Browse by Format" href="/browse" sub="Four ways to read" icon={<span aria-hidden="true">🗂️</span>} />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {CATEGORY_RAILS.map((cat) => (
                <Link key={cat.key} href={cat.href} className="group relative overflow-hidden rounded-2xl border border-mv-border-light bg-mv-surface/50 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-mv-violet/40 hover:shadow-card-hover">
                  <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${cat.accent} opacity-15 blur-2xl transition-opacity duration-300 group-hover:opacity-30`} />
                  <div className="text-2xl transition-transform duration-300 group-hover:scale-110">{cat.emoji}</div>
                  <p className="mt-3 text-sm font-bold text-white">{cat.label}</p>
                  <p className="mt-0.5 text-[10px] text-mv-text-muted">{cat.desc}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-medium text-mv-violet opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    Explore
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" /></svg>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ─── Genre Explorer ──────────────────────────────── */}
        <Reveal>
          <GenreExplorer pool={discoveryPool} />
        </Reveal>

        {/* ─── New Releases ────────────────────────────────── */}
        <Reveal>
          <section aria-label="New releases">
            <SectionHeader title="New Releases" href="/browse?sort=newest" sub="Fresh on the shelf" icon={<span aria-hidden="true">🎉</span>} />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {newReleases.map((item) => (
                <TitleCard key={item.id} item={item} fluid progress={resumeMap.get(item.id)?.pct} badge={item.latestChapter ? `Ch. ${item.latestChapter.number}` : undefined} />
              ))}
            </div>
          </section>
        </Reveal>
      </div>

      {/* ─── App Download CTA ──────────────────────────────── */}
      <section className="px-5 py-16 sm:px-6 md:px-8">
        <div className="relative mx-auto max-w-4xl rounded-3xl bg-gradient-to-r from-mv-accent via-mv-purple to-mv-violet p-[1.5px] shadow-glow">
          <span className="animate-float absolute -left-4 -top-4 hidden text-2xl sm:block" style={{ '--float-rot': '-8deg' } as CSSProperties}>📖</span>
          <span className="animate-float absolute -bottom-4 -right-4 hidden text-2xl sm:block" style={{ '--float-rot': '10deg', animationDelay: '-3s' } as CSSProperties}>🔔</span>
          <div className="relative overflow-hidden rounded-[calc(1.5rem-1.5px)] bg-mv-darker/95 px-8 py-12 text-center backdrop-blur-xl md:p-14">
            <div className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-mv-accent/25 blur-3xl" />
            <div className="pointer-events-none absolute -right-20 bottom-0 h-56 w-56 rounded-full bg-mv-purple/20 blur-3xl" />
            <div className="relative mb-5 inline-flex items-center gap-2 rounded-full border border-mv-success/30 bg-mv-success/10 px-4 py-1.5">
              <span className="animate-pulse-dot h-2 w-2 rounded-full bg-mv-success" />
              <span className="text-[10px] font-medium text-mv-success">Android APK Available</span>
            </div>
            <h2 className="relative text-3xl font-bold tracking-tight text-white md:text-4xl">
              Take MangaVerse <span className="text-gradient">Everywhere</span>
            </h2>
            <p className="relative mx-auto mt-4 max-w-lg text-sm text-mv-text-secondary">
              Get the native Android app for offline reading, push notifications, and a silky-smooth touch experience. Your library syncs automatically.
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Magnetic>
                <Link href="/download" className="btn-primary px-7 py-3.5 text-sm">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download for Android
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">v0.1.0</span>
                </Link>
              </Magnetic>
              <Magnetic>
                <Link href="/browse" className="btn-ghost px-7 py-3.5 text-sm">Browse Online Instead</Link>
              </Magnetic>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-mv-border/60 bg-mv-darker/50 py-12 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-6 h-px w-full bg-gradient-to-r from-transparent via-mv-accent/40 to-transparent" />
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <div className="text-center sm:text-left">
              <p className="text-sm font-bold">
                <span className="bg-gradient-to-r from-mv-violet to-mv-purple bg-clip-text text-transparent">Manga</span>
                <span className="text-white">Verse</span>
                <span className="ml-2 text-[10px] font-normal text-mv-text-muted">© {new Date().getFullYear()}</span>
              </p>
              <p className="mt-1 text-[10px] text-mv-text-dim">Read manga, manhwa, manhua & light novels online or on the go.</p>
            </div>
            <div className="flex items-center gap-5">
              <Link href="/download" className="flex items-center gap-1.5 rounded-lg border border-mv-violet/25 bg-mv-violet/10 px-3 py-1.5 text-[10px] text-mv-violet transition-all hover:border-mv-violet/50 hover:bg-mv-violet/20">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download APK
              </Link>
              <Link href="/browse" className="text-[10px] text-mv-text-muted transition-colors hover:text-mv-text">Browse</Link>
              <Link href="/community" className="text-[10px] text-mv-text-muted transition-colors hover:text-mv-text">Community</Link>
            </div>
          </div>
        </div>
      </footer>
    </AppShell>
  );
}

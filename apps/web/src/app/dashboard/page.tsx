'use client';

import { TopBar } from '@/components/TopBar';

const GENRE_DATA = [
  { label: 'Action', pct: 78, color: '#e94560' },
  { label: 'Fantasy', pct: 55, color: '#7b2fbe' },
  { label: 'Romance', pct: 30, color: '#e94560' },
  { label: 'Horror', pct: 18, color: '#7b2fbe' },
  { label: 'Sci-Fi', pct: 12, color: '#0066ff' },
];

const ACTIVITY = [
  { title: "Omniscient Reader's Viewpoint", detail: 'Read 28 pages · Ch. 198', time: '2h ago', color: '#2d1b69' },
  { title: 'Solo Leveling: Ragnarök', detail: 'Read 32 pages · Ch. 44', time: '5h ago', color: '#5e1b2d' },
  { title: 'Blue Lock', detail: 'Read 21 pages · Ch. 289', time: 'Yesterday', color: '#1b5e3d' },
  { title: 'Chainsaw Man', detail: 'Read 18 pages · Ch. 168', time: 'Yesterday', color: '#5e1b3a' },
];

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-mv-dark">
      <TopBar />

      <div className="mx-auto max-w-7xl p-6">
        <h1 className="mb-6 text-xl font-semibold text-white">Dashboard</h1>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Stats Cards */}
          <div className="rounded-xl bg-mv-darker border border-mv-border p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted mb-1">Chapters Read</p>
            <p className="text-2xl font-bold text-white">1,<span className="text-mv-accent">247</span></p>
            <p className="text-[10px] text-mv-text-muted mt-1">+48 this week</p>
          </div>
          <div className="rounded-xl bg-mv-darker border border-mv-border p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted mb-1">Reading Streak</p>
            <p className="text-2xl font-bold text-white">🔥 <span className="text-mv-accent">34</span></p>
            <p className="text-[10px] text-mv-text-muted mt-1">days in a row</p>
          </div>
          <div className="rounded-xl bg-mv-darker border border-mv-border p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted mb-1">Coin Balance</p>
            <p className="text-2xl font-bold text-mv-gold">120</p>
            <p className="text-[10px] text-mv-text-muted mt-1">+30 earned today</p>
          </div>

          {/* Genre Breakdown */}
          <div className="rounded-xl bg-mv-darker border border-mv-border p-5 md:col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted mb-4">Genre Breakdown</p>
            <div className="space-y-3">
              {GENRE_DATA.map((genre) => (
                <div key={genre.label} className="flex items-center gap-3">
                  <span className="w-14 text-[10px] text-mv-text-muted flex-shrink-0">{genre.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-mv-surface overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${genre.pct}%`, background: genre.color }}
                    />
                  </div>
                  <span className="w-8 text-right text-[10px] text-mv-text-secondary">{genre.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Series Count */}
          <div className="rounded-xl bg-mv-darker border border-mv-border p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted mb-1">Series In Library</p>
            <p className="text-2xl font-bold text-white">48</p>
            <p className="text-[10px] text-mv-text-muted mt-1">12 completed</p>
          </div>

          {/* Streak Calendar */}
          <div className="rounded-xl bg-mv-darker border border-mv-border p-5 md:col-span-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted mb-3">7-Day Streak Calendar</p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 28 }).map((_, i) => (
                <div
                  key={i}
                  className="h-4 w-4 rounded-[3px] transition-colors"
                  style={{ background: i < 21 ? '#2d1040' : '#1a1a2e' }}
                />
              ))}
            </div>
            <p className="text-[9px] text-mv-text-muted mt-2">Last 28 days · Purple = reading day</p>
          </div>

          {/* Recent Activity */}
          <div className="rounded-xl bg-mv-darker border border-mv-border p-5 md:col-span-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted mb-4">Recent Activity</p>
            <div className="space-y-1">
              {ACTIVITY.map((item) => (
                <div key={item.title} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-mv-surface transition-colors cursor-pointer">
                  <div className="h-10 w-8 rounded bg-mv-surface flex-shrink-0" style={{ background: item.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-mv-text">{item.title}</p>
                    <p className="text-[10px] text-mv-text-muted">{item.detail}</p>
                  </div>
                  <span className="text-[9px] text-mv-text-dim flex-shrink-0">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

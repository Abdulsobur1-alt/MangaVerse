'use client';

import { TopBar } from '@/components/TopBar';

const POSTS = [
  {
    id: 1, initials: 'SK', color: '#2d1b69', user: 'ShinKim', tag: 'Theory', tagColor: 'bg-[#1a0535] text-[#a05bdf]',
    title: "Sung Jinwoo's shadow army will be the key to defeating the Monarchs",
    preview: "After re-reading the last 3 chapters carefully, I noticed something subtle in the panel composition...",
    replies: 142, views: '8.4K', upvotes: 892,
  },
  {
    id: 2, initials: 'AR', color: '#5e1b2d', user: 'Adaora_R', tag: 'Prediction', tagColor: 'bg-[#1a1400] text-[#d4a017]',
    title: 'Will Kim Dokja reveal his true identity in the next 5 chapters?',
    preview: "I'm going all in on YES. The narrative foreshadowing in chapters 195-198 has been building...",
    replies: 234, views: '12K', upvotes: 445,
  },
  {
    id: 3, initials: 'TM', color: '#1b5e3d', user: 'TobiM', tag: 'Discussion', tagColor: 'bg-[#0d2035] text-[#4aa0e0]',
    title: 'Chapter 289 discussion — Isagi\'s new awakening is the most insane power-up',
    preview: "I've been reading sports manga for 10 years and nothing has hit me like this chapter...",
    replies: 389, views: '22K', upvotes: 2104,
  },
  {
    id: 4, initials: 'NK', color: '#3d1b69', user: 'NebulaK', tag: 'Theory', tagColor: 'bg-[#1a0535] text-[#a05bdf]',
    title: 'The true identity of the Outer God in ORV — complete analysis',
    preview: "I've compiled evidence from all 551 chapters to build a comprehensive theory...",
    replies: 567, views: '45K', upvotes: 3201,
  },
];

export default function CommunityPage() {
  return (
    <main className="min-h-screen bg-mv-dark">
      <TopBar />

      <div className="mx-auto max-w-7xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-xl font-semibold text-white">Community</h1>
          <div className="flex items-center gap-1.5 rounded-md bg-mv-darker border border-red-900/30 px-2.5 py-1">
            <div className="h-2 w-2 rounded-full bg-mv-accent animate-pulse" />
            <span className="text-[10px] text-mv-accent">1,240 online</span>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Main Feed */}
          <div className="flex-1 space-y-3">
            {POSTS.map((post) => (
              <div
                key={post.id}
                className="rounded-xl bg-mv-darker border border-mv-border p-4 cursor-pointer transition-all hover:border-mv-border-light hover:bg-mv-surface group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white flex-shrink-0"
                    style={{ background: post.color }}
                  >
                    {post.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-mv-text">{post.user}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[8px] font-medium ${post.tagColor}`}>
                        {post.tag}
                      </span>
                    </div>
                    <p className="text-[10px] text-mv-text-muted">15 minutes ago · Solo Leveling</p>
                  </div>
                </div>

                <h3 className="text-sm font-medium text-white mb-1.5 group-hover:text-mv-accent transition-colors">
                  {post.title}
                </h3>
                <p className="text-xs text-mv-text-muted leading-relaxed line-clamp-2">{post.preview}</p>

                <div className="mt-3 flex items-center gap-4">
                  <span className="flex items-center gap-1 text-[10px] text-mv-text-dim">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    {post.replies} replies
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-mv-text-dim">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    {post.views} views
                  </span>
                  <div className="ml-auto flex items-center gap-1.5 rounded-md bg-mv-surface px-2 py-1">
                    <svg className="h-3 w-3 text-mv-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    <span className="text-[10px] font-medium text-mv-accent">{post.upvotes}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-56 flex-shrink-0 space-y-6">
            {/* Top Theories */}
            <div>
              <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">🔥 Top Theories</h3>
              <div className="space-y-2">
                {[
                  { rank: '#1', title: 'Jinwoo is Ashborn reborn', score: '⬆ 892' },
                  { rank: '#2', title: 'ORV true ending theory', score: '⬆ 445' },
                  { rank: '#3', title: 'Isagi\'s final form', score: '⬆ 210' },
                ].map((item) => (
                  <div key={item.rank} className="flex items-center gap-2 rounded-lg bg-mv-darker px-3 py-2 cursor-pointer hover:bg-mv-surface transition-colors">
                    <span className="text-[10px] font-bold text-mv-accent">{item.rank}</span>
                    <span className="flex-1 text-[10px] text-mv-text-secondary line-clamp-1">{item.title}</span>
                    <span className="text-[9px] text-mv-text-muted">{item.score}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reading Clubs */}
            <div>
              <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">📚 Reading Clubs</h3>
              <div className="space-y-2">
                {[
                  { name: 'ORV Deep Dive', members: 840 },
                  { name: 'Weekly Blue Lock', members: 612 },
                  { name: 'Manhua Monday', members: 340 },
                ].map((club) => (
                  <div key={club.name} className="flex items-center justify-between rounded-lg bg-mv-darker px-3 py-2 cursor-pointer hover:bg-mv-surface transition-colors">
                    <span className="text-[10px] text-mv-text-secondary">{club.name}</span>
                    <span className="text-[9px] text-mv-text-muted">{club.members} members</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Predictors */}
            <div>
              <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">🎯 Top Predictors</h3>
              <div className="space-y-2">
                {[
                  { name: 'Oracle_san', acc: '91%' },
                  { name: 'WeebProphet', acc: '87%' },
                  { name: 'Adaora_R', acc: '83%' },
                ].map((p) => (
                  <div key={p.name} className="flex items-center justify-between rounded-lg bg-mv-darker px-3 py-2 cursor-pointer hover:bg-mv-surface transition-colors">
                    <span className="text-[10px] text-mv-text-secondary">{p.name}</span>
                    <span className="text-[9px] text-green-400">{p.acc} accuracy</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

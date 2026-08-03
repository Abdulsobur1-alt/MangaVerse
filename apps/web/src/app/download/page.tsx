'use client';

import { TopBar } from '@/components/TopBar';
import Link from 'next/link';

const APP_FEATURES = [
  { icon: '📖', title: 'Read Offline', desc: 'Download chapters and read anywhere, even without internet.' },
  { icon: '⚡', title: 'Lightning Fast', desc: 'Native performance with smooth page transitions and preloading.' },
  { icon: '🌙', title: 'Dark Mode', desc: 'Eye-friendly dark theme optimized for long reading sessions.' },
  { icon: '📱', title: 'Touch Optimized', desc: 'Tap-to-navigate, pinch-to-zoom, and swipe gestures.' },
  { icon: '🔔', title: 'Push Notifications', desc: 'Get notified when your favorite series get new chapters.' },
  { icon: '💾', title: 'Auto Sync', desc: 'Reading progress syncs seamlessly across all your devices.' },
];

const VERSIONS = [
  { version: 'v0.1.0', date: 'July 30, 2026', size: '18 MB', label: 'Latest', notes: 'Initial public release — reader, library, search, and bookmarks.' },
];

export default function DownloadPage() {
  return (
    <main className="min-h-screen bg-mv-dark">
      <TopBar />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/5 bg-gradient-to-br from-[#0f0820] via-[#1a0535] to-[#0d1040] py-16">
        <div className="animate-aurora absolute -left-24 top-0 h-72 w-72 rounded-full bg-mv-purple/40 blur-3xl" />
        <div className="animate-aurora absolute right-0 top-8 h-80 w-80 rounded-full bg-mv-accent/25 blur-3xl" style={{ animationDelay: '-6s' }} />
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div className="mx-auto max-w-5xl px-6 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-mv-purple/30 bg-mv-purple/10 px-4 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
            <span className="text-[10px] font-medium text-green-400">Android APK Available</span>
          </div>

          <h1 className="text-3xl font-bold text-white md:text-5xl">
            MangaVerse <span className="text-mv-accent">Mobile</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-mv-text-secondary">
            Take your library everywhere. The MangaVerse Android app gives you the full reading 
            experience with offline support, push notifications, and smooth touch navigation.
          </p>

          {/* Download Buttons */}
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href="/api/download/mangaverse-v0.1.0.apk"
              className="btn-primary px-8 py-4 text-sm"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="text-left">
                <p className="text-sm font-semibold">Download APK</p>
                <p className="text-[10px] text-white/70">v0.1.0 · 18 MB · Android 8+</p>
              </div>
            </a>

            <div className="flex gap-3">
              <button
                disabled
                className="flex items-center gap-2 rounded-xl border border-mv-border-light bg-mv-surface/50 px-5 py-4 text-left opacity-50 cursor-not-allowed"
                title="Coming soon"
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                <div className="text-left">
                  <p className="text-xs font-medium text-mv-text-muted">iOS</p>
                  <p className="text-[10px] text-mv-text-dim">Coming soon</p>
                </div>
              </button>

              <button
                disabled
                className="flex items-center gap-2 rounded-xl border border-mv-border-light bg-mv-surface/50 px-5 py-4 text-left opacity-50 cursor-not-allowed"
                title="Coming soon"
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 3v18h18V3H3zm16 16H5V5h14v14z" />
                  <path d="M9 7h2v10H9zm4 0h2v10h-2z" />
                </svg>
                <div className="text-left">
                  <p className="text-xs font-medium text-mv-text-muted">Google Play</p>
                  <p className="text-[10px] text-mv-text-dim">Coming soon</p>
                </div>
              </button>
            </div>
          </div>

          <p className="mt-4 text-[10px] text-mv-text-dim">
            By downloading you agree to our{' '}
            <Link href="/terms" className="text-mv-accent hover:underline">Terms of Service</Link>
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="mb-8 text-center text-lg font-semibold text-white">
          Why Download the App?
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {APP_FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group card-lift rounded-2xl border border-white/5 bg-mv-darker p-5"
            >
              <span className="text-2xl">{feature.icon}</span>
              <h3 className="mt-3 text-sm font-medium text-white">{feature.title}</h3>
              <p className="mt-1 text-xs text-mv-text-secondary leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Web vs App Comparison */}
      <section className="border-t border-mv-border bg-mv-darker/50 py-12">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-6 text-center text-lg font-semibold text-white">
            Web vs Mobile App
          </h2>
          <div className="overflow-hidden rounded-xl border border-mv-border">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-mv-border bg-mv-surface">
                  <th className="px-5 py-3 font-medium text-mv-text-secondary">Feature</th>
                  <th className="px-5 py-3 font-medium text-mv-text-secondary">Web App</th>
                  <th className="px-5 py-3 font-medium text-mv-text-secondary">Mobile App</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mv-border">
                {[
                  ['Browse & Discover', '✅ Full access', '✅ Full access'],
                  ['Read Chapters', '✅ Full access', '✅ Full access'],
                  ['Search & Filter', '✅ Full access', '✅ Full access'],
                  ['Library & Bookmarks', '✅ Full access', '✅ Full access'],
                  ['Offline Reading', '❌ Limited', '✅ Download chapters'],
                  ['Push Notifications', '❌ Browser only', '✅ Native push'],
                  ['Touch Navigation', '✅ Mouse + Keyboard', '✅ Optimized gestures'],
                  ['Background Download', '❌', '✅ Download in background'],
                ].map(([feature, web, mobile]) => (
                  <tr key={feature} className="transition-colors hover:bg-mv-surface/50">
                    <td className="px-5 py-3 font-medium text-mv-text">{feature}</td>
                    <td className="px-5 py-3 text-mv-text-secondary">{web}</td>
                    <td className="px-5 py-3 text-mv-text-secondary">{mobile}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-center text-[10px] text-mv-text-dim">
            The website has 100% of the reading features. The app adds offline, notifications, and native performance.
          </p>
        </div>
      </section>

      {/* Version History */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <h2 className="mb-6 text-center text-lg font-semibold text-white">
          Version History
        </h2>
        <div className="space-y-3">
          {VERSIONS.map((v) => (
            <div
              key={v.version}
              className="card-lift flex items-center justify-between rounded-2xl border border-white/5 bg-mv-darker p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{v.version}</span>
                  <span className="rounded-full bg-mv-accent/20 px-2 py-0.5 text-[9px] font-medium text-mv-accent">{v.label}</span>
                </div>
                <p className="mt-1 text-xs text-mv-text-secondary">{v.date} · {v.size}</p>
                <p className="mt-0.5 text-[10px] text-mv-text-muted">{v.notes}</p>
              </div>
              <a
                href="/api/download/mangaverse-v0.1.0.apk"
                className="flex items-center gap-1.5 rounded-lg border border-mv-accent/30 bg-mv-accent/10 px-3 py-2 text-[10px] font-medium text-mv-accent transition-all hover:border-mv-accent/60 hover:bg-mv-accent hover:text-white hover:shadow-lg hover:shadow-mv-accent/25"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Instructions */}
      <section className="border-t border-mv-border bg-mv-darker/30 py-12">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-6 text-center text-lg font-semibold text-white">
            How to Install the APK
          </h2>
          <div className="space-y-4 text-sm">
            {[
              { num: '1', title: 'Download the APK', desc: 'Tap the download button above to get the latest MangaVerse APK file.' },
              { num: '2', title: 'Enable Unknown Sources', desc: 'Go to Settings → Security → Install unknown apps, and allow your file manager or browser to install APKs.' },
              { num: '3', title: 'Open & Install', desc: 'Open the downloaded APK file and tap "Install". The process takes about 10 seconds.' },
              { num: '4', title: 'Sign In & Read', desc: 'Open MangaVerse, sign in with your account, and your library and progress will sync instantly.' },
            ].map((step) => (
              <div key={step.num} className="flex gap-4 rounded-xl border border-mv-border bg-mv-darker p-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-mv-accent/20 text-xs font-bold text-mv-accent">
                  {step.num}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white">{step.title}</h3>
                  <p className="mt-1 text-xs text-mv-text-secondary leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-mv-border bg-mv-darker py-8 text-center text-xs text-mv-text-muted">
        <p>MangaVerse © {new Date().getFullYear()} — Read Anywhere, Anytime</p>
        <div className="mt-2 flex items-center justify-center gap-4">
          <Link href="/" className="hover:text-mv-text transition-colors">Home</Link>
          <Link href="/browse" className="hover:text-mv-text transition-colors">Browse</Link>
          <span className="text-mv-accent">Get the App</span>
        </div>
      </footer>
    </main>
  );
}

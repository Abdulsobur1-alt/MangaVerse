# MangaVerse — Product Redesign Strategy

> **Mission:** Make MangaVerse *"the Apple + Netflix + Spotify experience for manga"* — premium, cinematic, minimal, fast, and emotionally resonant. Not flashy, not cluttered, not anime-themed — premium software.
>
> This document is the single source of truth for the redesign. It covers the full audit, the information architecture, the design system, and the implementation roadmap. Code changes land in `apps/web` and follow this document.

---

## 1. UX Audit — Findings (as-built, verified against the codebase)

### ✅ What already works
- **Design tokens** exist in `apps/web/src/app/globals.css` ("Obsidian" system): full dark palette (`#09090b → #fafafa`), Space Grotesk display + Inter body, shadow/elevation scale, motion tokens (`--ease-out-expo`, `--duration-*`).
- **Global shell** (`AppShell.tsx`): collapsible desktop sidebar, mobile bottom nav with floating search button, ⌘K command palette with live search + trending fallback.
- **Homepage** (`app/page.tsx`): hero carousel with word-stagger, aurora/grid backdrops, trending marquee, Continue Reading with progress bars, Editor's Picks, Recently Updated, format rails, genre cloud, download CTA.
- **Title page** (`app/title/[slug]/page.tsx`): cinematic blur backdrop, ratings/meta row, progress tracking, chapters with read-state icons, community wiki, reviews.
- **Reader** (`app/reader/[chapterId]/page.tsx`): format-aware (manga page-flip RTL, manhwa/manhua strip, light-novel prose), keyboard shortcuts, auto-scroll, fullscreen, prose themes (dark/sepia/light), font controls, persisted prefs, coin-lock gate, reading progress sync.
- **Micro-interactions**: Lenis smooth scroll, reveal-on-scroll, magnetic buttons, spotlight cards, tilt cards, shimmer skeletons, film grain, marquee.

### 🔴 Critical inconsistencies
1. **Split navigation systems.** Only `/`, `/browse`, and `/title/[slug]` render inside `AppShell`. **Nine pages** still use the legacy standalone layout (`<TopBar />` without sidebar/bottom-nav/⌘K): `library`, `history`, `dashboard`, `notifications`, `settings`, `reviews`, `community`, `community/[id]`, `admin`, `download`. Users lose search, navigation, and the command palette the moment they visit their own library or profile.
2. **Template artifact: violet → red hover.** 16+ buttons use `hover:bg-red-500` on violet primary buttons (`login`, `signup`, `settings`, `reviews`, `community`, `notifications`, `reader`, `ReportButton`, `history`). This reads as destructive on every non-destructive action.
3. **Library is the weakest screen.** Plain 3-column card grid, no stats, no shelf tabs (the API supports `listName` shelves but the UI flattens them), no search, no grid/list views, no per-shelf empty states.
4. **Inconsistent headers.** Legacy pages use small `text-xl` headers; shell pages use editorial `text-2xl/3xl` display headers with gradients. Hierarchy signal is uneven across the app.
5. **Duplicate UI patterns.** Stats cards, list rows, and badges are re-implemented per page (dashboard vs history) instead of shared components.
6. **Small a11y gaps:** some icon-only buttons lack `aria-label`; the reader bottom bar hides context on mobile; focus rings rely on `:focus-visible` only in a few spots.

### 📊 Audit scorecard (1–10)

| Area | Score | Notes |
|---|---|---|
| Visual polish / tokens | 8 | Strong system, uneven application |
| Navigation consistency | 4 | Split shell; 9 pages stranded |
| Homepage | 9 | Curated, cinematic, rich |
| Title details | 8 | Cinematic; sidebar could carry more |
| Reader | 9 | Already flagship-grade |
| Browse / Search | 7 | Functional; needs polish pass |
| Library | 4 | Plain grid, no shelves/stats |
| Profile (dashboard) | 6 | Good data, flat presentation |
| Accessibility | 6 | Good base, inconsistent focus/labels |
| Performance | 7 | Lazy images, skeletons; more streaming possible |

---

## 2. Product Design Principles

Every screen answers: **"What is the most important thing the user should do here?"**

1. **Content is the hero.** Covers, not chrome. Let art fill the frame.
2. **One primary action per view.** Start Reading, Continue, Unlock — never compete.
3. **Consistency is trust.** One shell, one header language, one component set.
4. **Motion explains, never distracts.** 150–450ms, expo curves, reduced-motion respected.
5. **Dark by default, light-ready.** The palette is authored for both.
6. **Keyboard is first-class.** ⌘K, ← → reading, / to focus search.
7. **Fast feels premium.** Skeletons, preloading, no layout shift.

---

## 3. Information Architecture & Sitemap

```
MangaVerse
├── /                        Home — hero, trending, continue reading, picks
├── /browse                  Browse — search, format/status/genre filters, sort, grid/list
│   └── ?search=, ?genres=, ?format=, ?sort=   (deep-linkable filters)
├── /title/[slug]            Title details — cinematic hero, chapters, wiki, reviews
├── /reader/[chapterId]      Reader — page / strip / prose, locked-gate
├── /library                 Personal bookshelf — shelf tabs + stats + progress
├── /history                 Reading history — timeline + stats + heatmap
├── /dashboard               Profile — achievements, streak, activity
├── /community               Community feed
│   └── /community/[id]      Post thread
├── /notifications           Alerts inbox
├── /reviews                 My reviews
├── /settings                Profile, preferences, account, subscription
├── /download                Mobile app download
├── /admin                   Admin console
└── /login · /signup         Auth (intentionally shell-less)
```

**Navigation model**
- **Desktop:** collapsible sidebar (icons → full labels on hover). Primary: Home, Browse, Library, Community. Secondary: History, Dashboard, Alerts, Settings.
- **Mobile:** 5-slot bottom nav + floating search + persistent reader shortcut.
- **Global:** ⌘K command palette on every shell page.

**Primary user flows**
1. **Discovery:** Home hero → Title → Start Reading → progress auto-saves → "Continue" on next visit.
2. **Resume:** Anywhere → Library/Home Continue card → Reader resumes at saved page.
3. **Collect:** Title → Add to Library (shelf picker) → Library shelf tabs → progress ring.
4. **Search:** ⌘K → type → arrow-key → Enter → Title (debounced, trending fallback).
5. **Unlock:** Locked chapter → coin gate → unlock → read → progress sync.

---

## 4. Design System (as shipped + gaps to close)

### Color — "Obsidian"
| Token | Value | Use |
|---|---|---|
| `mv-dark` | `#09090b` | App background |
| `mv-darker` | `#111113` | Surfaces |
| `mv-surface` / `mv-card` | `#18181b` | Cards, inputs |
| `mv-border` / `mv-border-light` | `#27272a` / `#3f3f46` | Hairlines, raised borders |
| `mv-accent` / `mv-purple` / `mv-violet` | `#7c3aed` / `#8b5cf6` / `#a78bfa` | Primary / secondary / accent |
| `mv-gold` | `#f59e0b` | Ratings, highlights |
| `mv-success` / `mv-warning` / `mv-danger` | `#10b981` / `#f59e0b` / `#ef4444` | State |
| `mv-text` … `mv-text-dim` | `#fafafa` → `#52525b` | Type ramp |

**Gap to close (roadmap):** the light theme variant now ships as gated semantic tokens (`html[data-theme="light"]` flips `--color-app`/`--color-surface`/`--color-text-*`; see `DESIGN_SYSTEM.md` §3.2) — components migrate from hard-coded value tokens to semantic tokens before a theme toggle is exposed.

### Typography
- **Display:** Space Grotesk — headings, hero, chapter numbers. Tight tracking (`-0.02em`).
- **Body:** Inter — UI + prose. Weights 400/500/600/700.
- Scale: `10 / 12 / 14 / 16 / 18 / 24 / 30 / 36 / 48 / 60`.

### Elevation, Radius, Motion
- Shadows: `card`, `card-hover`, `glow`, `glow-sm`, `modal`.
- Radius: `sm 8 / md 12 / lg 16 / xl 20 / full`.
- Durations: `fast 150 / base 250 / slow 450ms`; curves `--ease-out-expo`, `--ease-out-quart`.
- Keyframes: fadeIn, fadeUp, scaleIn, shimmer, auroraShift, marquee, float, grainShift, pulse-dot.

### Component inventory
| Component | Status |
|---|---|
| AppShell (sidebar, bottom nav, ⌘K) | ✅ live |
| TopBar (search, bell, avatar menu) | ✅ live |
| CoverImage (fallback states) | ✅ live |
| Button (`.btn-primary`, `.btn-ghost`) | ✅ live |
| Card / spotlight / tilt / magnetic / reveal | ✅ live |
| Status pill, eyebrow, field, skeleton | ✅ live |
| **Shelf tabs / bookshelf card** (library) | 🆕 this pass |
| **Segment control, empty state, stat tile** | 🆕 pattern this pass |
| Toast system | ⏳ roadmap |

---

## 5. Motion Guidelines

- **Purpose:** orient (transitions), reward (micro), inform (state).
- **Speeds:** hover 150ms · in-page 250ms · hero/carousel 450–1000ms · page load stagger ≤ 600ms.
- **Curves:** `expo-out` for entrances, `quart` for cards, linear only for marquee/loops.
- **Respect:** `prefers-reduced-motion: reduce` already zeroes durations app-wide (globals.css).
- **Image loading:** shimmer skeleton → fade-in on load (`opacity` + tiny `scale`), never layout shift (reserve aspect-ratio boxes).
- **Scroll:** Lenis smooth scroll; reveal-on-scroll for section headers only, not every card.

---

## 6. Accessibility Checklist (target: WCAG AA)

- [x] Color contrast ≥ 4.5:1 for body text (zinc ramp on near-black).
- [x] `prefers-reduced-motion` global guard.
- [x] `:focus-visible` rings (violet, 2px, offset).
- [x] Semantic landmarks: `header`, `nav`, `main`, `aside`, `footer` in shell.
- [ ] Ensure every icon-only button has `aria-label` (audit pass in roadmap).
- [ ] Keyboard: `Esc` closes all overlays; `Tab` order follows visual order (⌘K already arrow-key driven).
- [ ] Screen reader: `role="dialog"` + `aria-modal` on palette (done); add `aria-live` to reader page-turn and toast.
- [ ] High-contrast: verify focus on violet-on-black; keep text on `mv-text-secondary` ≥ 11px.

---

## 7. Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| `< md (768)` | Bottom nav (5 slots) + floating search; hero stacks; grids collapse 2-col; reader = full-bleed immersive |
| `md–lg` | Sidebar icons-only (14 col); content offset `md:pl-14` |
| `≥ lg` | Sidebar expands on hover (60 col); 4–8 col grids; title page 2-col with sidebar |
| Reader | Same immersive chrome at all sizes; prose max-w 42rem; strip max-w 700px |

---

## 8. Folder & Component Architecture (recommended target)

```
apps/web/src/
├── components/          ← shared UI (AppShell, TopBar, CoverImage, …)
│   └── ui/              ← roadmap: Button, Badge, Tabs, Dialog, Tooltip, Toast, Skeleton
├── lib/
│   ├── hooks/           ← one hook file per domain (titles, library, reading, …)
│   ├── api.ts           ← single axios client
│   └── format.ts        ← shared formatters
├── app/                 ← routes; each page composes shared sections
└── store/               ← zustand (auth)
```

**Refactoring plan**
1. **Now:** unify every page onto `AppShell`; kill the legacy `<TopBar />` layout. ✅ this pass.
2. **Now:** extract shared "section header" + "stat tile" + "empty state" patterns used by dashboard/history/library. ✅ partially this pass.
3. **Next:** extract `TitleCard` (currently duplicated in home/browse) into `components/TitleCard.tsx`.
4. **Next:** promote `StatCard`, `ShelfTabs`, `SegmentedControl` into `components/ui/`.
5. **Next:** replace per-page formatters with `format.ts` / `@mangaverse/shared`.

---

## 9. Implementation Roadmap

- **Phase 1 — Foundation (this pass):** shell consolidation, library bookshelf, design-bug sweep, this document.
- **Phase 2 — Consistency:** extract TitleCard, shared headers, empty states; polish browse (sticky filter bar, active-filter chips); light theme tokens.
- **Phase 3 — Flagship reader v2:** brightness control, preload-next-chapter, chapter-progress scrubber, edge-tap zones on mobile, immersive auto-hide chrome.
- **Phase 4 — Profile & community:** dashboard stat tiles + heatmap polish, community composer, notifications grouping.
- **Phase 5 — Performance & a11y:** streaming/Suspense for shells, image `srcSet`, a11y label audit, Toast system.

---

## 10. Testing Strategy

- **Type safety:** `pnpm turbo run typecheck` across workspace after every phase (guardrail for the refactors).
- **Lint:** `next lint` in `apps/web`.
- **Manual smoke (browser):** home → title → reader (page/strip/prose + RTL), library shelves, ⌘K on every shell page, mobile bottom nav, locked-chapter gate.
- **A11y:** run axe on home, browse, title, reader; keyboard-only pass (Tab/Enter/Esc).
- **Regression focus:** reader progress persistence, bookmark toggle, coin unlock, community voting, notifications mark-read.
- **Perf budget:** home LCP < 2.5s (hero image preload), no CLS from skeletons (aspect-ratio boxes), reader page-turn < 100ms.

---

## 11. Deliverables Map (this brief → this document)

1 UX audit → §1 · 2 Redesign strategy → §2 · 3 IA → §3 · 4 Sitemap → §3 · 5 User flows → §3 · 6 Design system → §4 · 7 Color system → §4 · 8 Typography → §4 · 9 Component inventory → §4 · 10 Wireframes → §3/§4 (high-fidelity in code) · 11 High-fidelity UI → this pass's code · 12 Motion → §5 · 13 A11y checklist → §6 · 14 Responsive → §7 · 15 Folder structure → §8 · 16 Component architecture → §8 · 17 Refactoring plan → §8 · 18 Roadmap → §9 · 19 Production code → this pass's changes · 20 Testing → §10.

---

## 12. Phase 3 — Home & Discovery (as shipped)

> The homepage was rebuilt into a curated, intelligent discovery experience. It answers four questions in order: **where do I continue? → what should I read? → why should I read it? → what did I miss?** Design intent: Netflix hero × Spotify recommendations × Steam discovery queue — curated, cinematic, and personal, never a generic wall of covers.

### 12.1 Homepage UX audit (pre-pass)

| Area | Pre | Post | Notes |
|---|---|---|---|
| Hero | 7 | 9.5 | Was a static banner; now editorial + progress-aware |
| Continue Reading | 6 | 9 | Was compact cards; now premium rail with ETA + last-read |
| Manga cards | 6 | 9 | Inline markup per page → reusable `TitleCard` system |
| Personalization | 4 | 8.5 | Now: Continue, Unread Updates, Because-You-Read, Recently Viewed |
| Search | 6 | 8.5 | Global ⌘K kept + new inline HomeSearch preview |
| Genre discovery | 5 | 8 | Chips → rich GenreExplorer cards with artwork + counts |
| Empty states | 3 | 8 | Per-shelf/onboarding/guest states; skeleton loaders everywhere |
| A11y (carousel) | 5 | 8 | ARIA carousel region, keyboard ←/→, touch swipe, pause on focus |

### 12.2 Architecture (new `components/home/`)

| File | Role |
|---|---|
| `Hero.tsx` | Editorial showcase: ken-burns artwork, aurora wash, live synopsis (fetched), genre tags, rating, status, progress-aware CTA (Continue → reader when resume exists), Save CTA, prev/next + autoplay progress dots, keyboard/touch, pause-on-hover/focus, reduced-motion aware |
| `HomeSearch.tsx` | Inline discovery search: debounced live results, trending now, popular genres, quick format filters, recent searches (shared key with ⌘K), ↑↓/↵/esc, `combobox` semantics |
| `TitleCard.tsx` | The reusable manga card system: rank/rating/status overlays, reading-progress bar, hover quick actions (bookmark + context menu for shelf actions), author/genres meta, fluid rail + grid variants, `TitleCardSkeleton` |
| `BookmarkButton.tsx` | Library save/remove toggle (icon + pill variants); guests see nothing (no authed request) |
| `ContinueRail.tsx` | Premium resume: blurred cover backdrop, chapter, progress bar, last-read date, estimated time left (pageCount-aware, LN ≈ 2.5 min/page else 1.25), one-click Resume; `ContinueRailSkeleton` |
| `GenreExplorer.tsx` | Rich genre cards: emoji, blurb, representative artwork from the live discovery pool, on-shelf title counts, hover lift/glow/zoom |
| `primitives.tsx` | Shared `Magnetic` / `Spotlight` / `Tilt` + `SectionHeader` (icons, subs, View-all) |
| `types.ts` | `HomeTitle`, `ResumeInfo`, `buildResumeMap` (per-series latest progress), ETA helpers, `GENRES_META` |

### 12.3 Personalization model (client-derived, no new endpoints)

- **Continue Reading** — latest in-progress chapter per series from `/reading/progress`, newest first, up to 5; 🔥 streak chip when `streakDays > 1`.
- **Unread Updates** — library titles whose `latestChapter.number` is newer than the last read chapter (intersection of `/library` × `/titles/recently-updated`).
- **Because You Read** — top genre from `/reading/stats` `genreDistribution`, rated titles in that genre, excluding titles already in progress.
- **Recently Viewed** — deduped per-series from `/reading/history`, resume links.
- **Guests** — no empty rails: a curated onboarding card (sign-in CTA) + full discovery rails below.

### 12.4 Motion (hero & rails)

- Hero autoplay 8s, `hero-autoplay` progress fill on active dot; artwork `ken-burns` slow zoom; slide crossfade on the existing `opacity` transition; all pause under `:hover`, `:focus-within`, and `prefers-reduced-motion`.
- Cards: 150–300ms lift/glow/zoom; image zoom 500ms expo; bookmark pop (`scale 1.3 → 1`).
- Rails keep `scrollbar-none` horizontal scroll; grids keep `Reveal` on section containers only.

### 12.5 Accessibility (hero/cards/search)

- Hero: `role="region"` + `aria-roledescription="carousel"`, labelled controls, `role="tablist"` dots with per-slide labels, slide counter `aria-live="polite"`, keyboard ←/→, touch swipe, focus pauses autoplay.
- Cards: full-cover `Link` with accessible name; bookmark/context buttons `aria-label` + `aria-pressed`/`aria-expanded`; context menu closes on outside click/Esc.
- Search: `combobox` + `listbox` semantics, arrow-key + Enter + Esc, visible focus states, results have text labels.
- All overlays respect `prefers-reduced-motion` via the global guard.

### 12.6 Performance

- Hero artwork and rail images all lazy via `CoverImage`; synopsis fetched only for the active slide (single request, cache-friendly).
- `TitleCardSkeleton` / `ContinueRailSkeleton` reserve aspect-ratio boxes → no CLS.
- Personalization queries are gated by auth (`enabled: !!token`) — guests never fire authed requests.
- Genre counts derive from the already-fetched discovery pool — zero extra requests.

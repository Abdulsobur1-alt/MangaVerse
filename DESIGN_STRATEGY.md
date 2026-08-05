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

---

## 13. Phase 4 — Cinematic Manga Details (as shipped)

> The title page is now a signature experience: it sells the story before chapter one. Every design decision reduces uncertainty — rating, taste-fit (genres), time-to-finish, community signal, and the one correct action to start reading. Design intent: Netflix title pages × Apple TV+ restraint × Steam store pages × Letterboxd reviews.

### 13.1 Details-page UX audit (pre-pass)

| Area | Pre | Post | Notes |
|---|---|---|---|
| Above the fold | 6 | 9.5 | Static blurred backdrop → adaptive cover-color hero |
| Metadata | 5 | 9 | Flat `<dl>` table → glass info cards, honest "not listed" |
| Chapters | 6 | 9 | Plain rows → search / sort / states / ETA / load-more |
| Reading CTA | 6 | 9 | One button → state-aware action system |
| Synopsis | 5 | 8.5 | Plain paragraph → editorial quote + spoiler guard + highlights |
| Recommendations | 4 | 8 | None → Readers-Also-Enjoyed + same-author rails |
| Community | 6 | 8.5 | Reviews wiki preserved, restyled + spoiler collapse + verified |
| Share | 0 | 8 | None → share dialog with copy / native share / QR |
| Statistics | 4 | 8 | Derived tiles + rating bar + genre ranking |

### 13.2 Architecture (new `components/title/`)

| File | Role |
|---|---|
| `useAdaptiveColors.ts` | Canvas-sampled palette from cover/banner art (dependency-free): base + accent + soft + luminance; drives the hero's per-title identity; graceful fallback |
| `TitleHero.tsx` | Cinematic above-the-fold: adaptive gradient backdrop, blurred artwork, glass stats row (rating/views/saved/chapters), credits, alt titles, genres, ETA + reading-direction chips, CTA row, progress bar, cover tilt + shine sweep |
| `ReadingCta.tsx` | State machine → Start / Continue · Ch. X / Re-read / Read Latest, with an animated SVG progress ring and locked-chapter hint |
| `CollectionMenu.tsx` | One-click shelf picker (Reading / Plan to Read / Completed / On Hold / Dropped), current-shelf aware, remove-on-tap-again; sign-in CTA for guests |
| `StoryPreview.tsx` | Editorial synopsis: pull-quote intro, spoiler guard (blur → reveal), expandable, genre-derived highlights |
| `MetadataGrid.tsx` | Glass info cards (format/author/artist/year/updated/language/saved/views/chapters/reviews/schedule/age) with honest "Not listed" fallbacks + reading-direction strip |
| `ChapterList.tsx` | Search by number/title, ↑/↓ sort, read ✓ / in-progress % / locked 🔒 states, per-chapter ETA + date, keyboard ↑↓/↵ with scroll-into-view, load-more (append pages, dedupe) |
| `Recommendations.tsx` | Readers-Also-Enjoyed (same top-2 genres, rated) + More-from-author rails, reusing the homepage `TitleCard` |
| `StatsDashboard.tsx` | Community rating bar (0–10 gradient fill), six stat tiles (rating/saved/views/chapters/progress/genre rank), genre ranking pills |
| `CommunityPanel.tsx` | Reviews (stars, sub-scores sliders, spoiler collapse, helpful, verified badge, delete-own) + wiki (read/edit/history/revert/flag) |
| `ShareDialog.tsx` | Modal with rich preview card, copy-link (clipboard + fallback), native Web Share, QR code, Esc/outside-click close |

### 13.3 Reading-CTA state machine

| User state | Primary action | Secondary |
|---|---|---|
| No chapters | disabled "No chapters yet" | — |
| Fresh visitor | Start Reading (ch. 1) | Read Latest · locked hint |
| In progress (0 < % < 100) | Continue · Ch. N (+ progress ring) | Read Latest |
| Fully read | Re-read | Read Latest |
| Guest | same as fresh + "Add to Library" → sign-in | Share · Read Offline |

### 13.4 Motion & a11y

- Hero: 1s color transition on palette swap, cover rotateY 3°→0 on hover with shine sweep, 700ms progress fill.
- Chapters: 150ms hover, progress ring 600ms stroke-dashoffset, list keyboard-driven (↑/↓/↵) with `aria-selected` + scroll-into-view.
- Share dialog: `role="dialog"` + `aria-modal`, Esc/outside-click, scroll lock, focusable actions.
- Adaptive colors respect `prefers-reduced-motion` (color change is instant, no layout shift).
- All icon-only buttons carry `aria-label`; rating stars are read as `N out of 10`.

### 13.5 Performance

- Chapters load 50 at a time and append via `useTitleChapters` (per-page react-query cache, dedupe by id) — no full-list fetch.
- Color sampling runs on a 32×32 scratch canvas (`willReadFrequently`), blob-safe, and aborts on unmount.
- Images stay lazy via `CoverImage`; skeletons reserve aspect-ratio boxes (no CLS); the hero blur uses the already-fetched cover.

### 13.6 Honesty note

The catalog doesn't model publisher / volume / characters / age rating, so those rows render an explicit "Not listed" chip instead of invented values — and the docs flag them as future data-model additions (see §4).

## 14. Phase 5 — The Ultimate Reading Experience (as shipped)

### 14.1 Reader UX audit (pre-pass)

The pre-existing reader had strong bones (3 modes, RTL, prose themes, auto-scroll, coin-lock, progress sync) but presented chrome as a static top/bottom stack, made users hunt for chapter navigation (no in-reader list), and offered no image failure recovery, preloading, focus immersion, bookmarking, or offline awareness.

| Dimension | Before | After |
|---|---|---|
| Chrome | Static bars | Floating, auto-hiding after 3.2s idle, re-poked by mouse/touch |
| Focus immersion | — | Focus mode (Z) hides all chrome; tap/move to reveal |
| Chapter navigation | No in-reader list | ChapterDrawer: full list, current ✓, search, sort, quick jump |
| Controls | Dispersed | ControlCenter: brightness, zoom, mode, RTL, themes, font, line-height, auto-scroll, gestures, opacity |
| Images | Bare `<img>` | PageImage: blur-up fade, retry on error, eager preload of adjacent pages |
| Gestures | — | Tap zones (RTL-aware), swipe, double-tap zoom/toggle, pinch via browser |
| Keyboard | — | ←→↑↓ space PgUp/PgDn Home/End F B T C A M Z ? Esc + help dialog |
| Bookmarks | — | Per-chapter page bookmark (B), persisted locally, resumes page mode |
| Offline | Blind | Offline badge in the floating bar; progress save fails silently |

### 14.2 Architecture (new `components/reader/`)

| File | Role |
|---|---|
| `readerPrefs.ts` | Typed prefs store (mode, theme, brightness, zoom, RTL, font size/line-height/family, auto-scroll speed, control opacity, auto-hide, gestures) + per-chapter page bookmarks; localStorage persistence with safe JSON parsing |
| `PageImage.tsx` | Image with blur-up fade-in, `loading`/`decoding` hints, click-to-retry on failure (small ❌ chip + retry), preloading of neighbors via `new Image()` |
| `ControlCenter.tsx` | Floating bottom-sheet panel: brightness slider, zoom toggle, mode picker, RTL flip, prose theme swatches, font controls, auto-scroll speed, gesture toggle, opacity, fullscreen, help link; respects effective mode |
| `ShortcutHelp.tsx` | `role="dialog"` keyboard-map table (global + mode-specific), Esc/outside-click close |
| `ChapterDrawer.tsx` | Right-side drawer fetching the real chapter list via `/api/titles/:slug/chapters`, current-chapter highlight, read state dots, search + asc/desc sort, one-tap jump |

### 14.3 Mode & layout

- `page` (manga, default): single-page with RTL-aware prev/next, tap thirds, swipe, preloaded neighbors, resume-at-saved-page.
- `strip` (manhwa/manhua/webtoon): continuous vertical, optional zoom (fit-width → full), auto-scroll with speed 1–3 that advances to next chapter at the end.
- `prose` (light novels): themed typography (dark/black/sepia/paper/contrast), adjustable font size, line-height, serif toggle, reading-time estimate (220 wpm) and minutes-left in the bar.

### 14.4 Focus & gestures

- Chrome auto-hides after 3.2s idle when `autoHideChrome` is on; any mouse-move/touch pokes it back.
- Focus mode (Z): chrome never renders; a faint "move or tap to reveal" hint fades in; Esc or a tap returns.
- Tap zones: left/right thirds navigate (mirrored under RTL); center toggles chrome. Double-tap zooms strip mode / toggles UI in page mode. Swipes only in page mode (threshold 60px, dominant axis).

### 14.5 Keyboard map

`←/→` page or scroll · `↑/↓` · `Space` next · `PageUp/PageDown` · `Home/End` · `F` fullscreen · `B` bookmark · `T` prose theme cycle · `C` chapter list · `A` auto-scroll · `M` prose toggle (LN) · `Z` focus · `?` help · `Esc` cascade (help → drawer → controls → fullscreen → focus → reveal chrome). Inputs are ignored while typing in a field.

### 14.6 Performance & resilience

- Adjacent pages preload via `new Image()` in page mode; strip mode eagers the first two pages.
- Scroll progress throttled through `requestAnimationFrame`; progress POST debounced 2s and fails silently offline.
- `PageImage` keeps its own loading/error state per index (no re-render storms); retry re-creates the `src`.
- Programmatic auto-scroll is flagged so the "manual scroll stops auto-scroll" listener ignores its own ticks.
- Fullscreen on the reader element, `fullscreenchange` tracked for the toggle icon state.

### 14.7 Honesty note

True offline reading (downloading chapters) is out of scope for the current API (no download endpoints); the reader delivers an offline *indicator*, graceful failure, and client-side page bookmarks instead. Custom key bindings, notes/highlights, and the statistics dashboard are flagged as roadmap items (see §9).

## 15. Phase 6 — Search, Discovery & Browse (as shipped)

> The browse page stopped being a search page and became a discovery platform. It answers one question — **"what should I read next?"** — through a layered experience: a search bar that is never empty, curated collections, a future-ready AI teaser, dedicated genre and author pages, and a filter system where every state is a shareable URL. Design intent: Spotify Discovery × Steam store × Letterboxd genre pages — curated, transparent, and delightful at every zoom level.

### 15.1 Discovery UX audit (pre-pass)

| Area | Pre | Post | Notes |
|---|---|---|---|
| Search | 6 | 9 | Static input + suggestion list → premium combobox (recents/trending/genres/instant results) |
| Browse page | 6 | 9 | Single results page → two-mode Discovery Hub (browse ↔ catalog) |
| Filters | 5 | 9 | Format/status/genre/static sort → URL-synced FilterBar (genre counts, year range, rating slider, bookmarks sort) |
| Genre discovery | 5 | 9 | Chip → dedicated /genre/[slug] pages with hero, stats, 4 rails, related genres |
| Author discovery | 0 | 8 | None → /author/[name] pages with derived stats + honest creator section |
| Collections | 0 | 8 | None → CuratedCollections (every card a real, shareable filter set) |
| AI discovery | 0 | 7 | None → honest AiSearchCard teaser (no fake results) |
| Empty states | 4 | 8.5 | Generic → per-context guidance (too-strict filters, no results, no genre data) |
| Loading | 5 | 9 | Pagination buttons → skeletons, infinite load-more (IntersectionObserver) |
| URL deep-linking | 3 | 9 | Read-once on mount → URL is the source of truth, filters shareable |

### 15.2 Architecture (new `components/discover/` + pages)

| File | Role |
|---|---|
| `utils.ts` | Genre slug bridging (`sci-fi` ↔ `sci_fi`), `FilterState` parse/serialize helpers, curated `COLLECTIONS` defs, sort/format/status option tables |
| `DiscoverSearch.tsx` | Never-empty combobox: recents (shared key with ⌘K), trending searches, popular genres, debounced instant results with covers, smart genre fallbacks, keyboard nav (↑↓ ↵ esc), honest AI teaser modal |
| `FilterBar.tsx` | Format/status chips, genre multi-select popover with LIVE counts, year range, rating slider, bookmarks-aware sort — all URL-synced, active-filter chips with one-tap removal |
| `CuratedCollections.tsx` | 8 editorial cards (Completed Masterpieces, Critically Acclaimed, Most Bookmarked, …) each mapping to real /browse filters, with copy-share |
| `GenreGrid.tsx` | 15 genre cards with live title counts, deep-linking to /genre/[slug] |
| `AiSearchCard.tsx` | Future-ready semantic-search teaser: fake prompt bar, example prompts, honest "coming soon" modal — zero invented results |
| `/browse` | Discovery Hub: discovery mode (collections → AI → genre grid → live rails) and catalog mode (FilterBar + infinite grid), URL as source of truth, per-mode skeletons/empty states |
| `/genre/[slug]` | Gradient hero with count + derived stats strip (avg rating/top format/year/latest), Popular / Newest / Community Favorites / Hidden Gems rails, related genres, empty state |
| `/author/[name]` | Works grid (top 100 by rating), derived stats (avg rating, dominant genre, formats, statuses), honest creator section, empty state |

### 15.3 API extensions (already shipped in `apps/api/src/routes/titles.ts`)

- New list filters: `author` (partial, case-insensitive), `yearFrom`/`yearTo` (1900–2100), `minRating` (0–10), `search` now also matches `artist`.
- New sort: `bookmarks` (`bookmarks: { _count: 'desc' }`).
- New endpoint `GET /api/titles/genres` → genre → title-count aggregation (Redis-cached 10 min).
- Richer list select: `artist`, `releaseYear`, `_count.bookmarks`.

### 15.4 Search model

- **Instant**: 180ms debounce, live `/titles?search=` results with covers/author/rating, `aria-live`-friendly headers.
- **Never empty**: idle state surfaces recent searches, trending titles, popular genres, quick genre links, and the AI teaser.
- **Smart fallback**: when a term matches no titles, suggest matching genres by label.
- **Recents**: localStorage key `mangaverse_recent_searches` — shared with the homepage search and ⌘K palette.
- **Keyboard**: ↑↓ navigate, ↵ open (result → commit term; else search-all), esc close; combobox/listbox semantics.

### 15.5 Filter system (all delightful, all URL-synced)

Genre multi-select (live counts, "matches ALL" semantics), format, status, year range, min-rating slider, sort incl. Most Bookmarked. Every change rewrites the URL via `router.replace` (no scroll jump); filter sets are shareable (`/browse?genres=action&minRating=8&sort=bookmarks`). Search typing stays local and commits on Enter so history isn't spammed. Active-filter chips remove one at a time.

### 15.6 Genre & author pages (honesty by design)

- **Genre**: accepts either slug form (`sci-fi`/`sci_fi`); unknown genres get a neutral synthesized card instead of broken styling. Stats are explicitly labelled as derived from the sampled rails.
- **Author**: the catalog has no biography/portrait/awards data — the page says so and derives everything verifiable (works, avg rating, dominant genre, formats, statuses) from the works themselves. No invented "About" copy, no fake follower counts.
- **AI**: the teaser promises nothing false — the modal explains exactly what's coming (story-graph embeddings) and points to what already works.

### 15.7 Performance & a11y

- Catalog results accumulate via `useTitlesPages` (per-page react-query cache, dedupe by id, no full-list refetch); load-more fires 600px before the viewport bottom; only the first page triggers skeletons.
- Discovery rails fetch only when in discovery mode (`enabled: !active`).
- Genre counts are a single cached request shared by FilterBar + GenreGrid + genre pages.
- Combobox keyboard support, focus-visible styles everywhere, `aria-expanded`/`aria-pressed` on toggles, dialog semantics on modals (Esc/outside-click close), reduced-motion respected globally.

### 15.8 Roadmap (flagged, not faked)

Semantic/AI search (story-graph embeddings), voice search, publisher & character search, author biographies, real collection (list) models with community curation, and per-title "reading time" filters all need data-model additions first (see §4/§9).

## 16. Phase 7 — Library, Collections & Personalization (as shipped)

> The library stopped being a generic favorites page and became a personal reading hub. It answers five questions — what am I reading, what should I read next, what have I completed, how much have I read, and what kind of reader am I. Design intent: a digital bookshelf × reading journal × analytics dashboard — organized, motivating, and honest about what the data can actually say.

### 16.1 Library UX audit (pre-pass)

| Area | Pre | Post | Notes |
|---|---|---|---|
| Library home | 6 | 9 | Shelf page → personal hub: welcome header, Continue rail, collections strip, five shelves with stats |
| Shelves | 7 | 8.5 | Existing 5 lists retained; added compact view + card density + prefs-synced default view |
| Custom collections | 0 | 8.5 | New `Collection`/`CollectionItem` model, manager + detail pages, add-titles search flow |
| Reading goals | 0 | 8 | New `ReadingGoal` model, six derivable goal types, live progress, quick-starts, archive |
| Dashboard | 5 | 9 | Stats cards → premium reader command center (heatmap, genres/authors, activity, goals, badges) |
| History | 6 | 8.5 | Flat list → day-grouped timeline + Recently Finished rail |
| Personalization | 4 | 8 | View/density/preferred-genres/recs prefs on the User row — syncs across devices |
| Empty states | 6 | 8.5 | Per-context guidance (empty shelf, empty collection, no goals, no history) with next-action CTAs |

### 16.2 Data model (`apps/api/prisma`, migration `20260805120000_phase7_library`)

| Table | Purpose |
|---|---|
| `collections` | User-curated shelves: name, description, tags[], is_private, cover |
| `collection_items` | (collection_id, title_id) unique membership + note + sort_order |
| `reading_goals` | title, type, target, active, ends_at — progress derived, never stored |
| `users.prefs` (JSONB) | library view mode, card density, preferred genres, homepage-recs toggle |

Apply with `docker compose up -d postgres && cd apps/api && npx prisma migrate deploy`.

### 16.3 API surface (new routes)

- `GET/POST/PATCH/DELETE /api/collections` — full CRUD, scoped to the owner, item counts + first-cover previews.
- `POST /api/collections/:id/items`, `DELETE /api/collections/:id/items/:titleId`, `PATCH /api/collections/:id/items` (reorder) — idempotent adds.
- `GET/POST/PATCH/DELETE /api/goals` — progress computed live from reading data per type (week resets Monday UTC, day resets midnight UTC).
- `GET/PUT /api/users/prefs` — merge-based personalization prefs.
- `GET /api/reading/stats` now returns `author` per title (powers favorite-author analytics).

### 16.4 Goal types (all derivable, zero drift)

`chapters_week` (rolling calendar week), `chapters_day`, `chapters_total`, `series_total` (distinct series with ≥1 completed chapter), `series_completed` (read the final known chapter), `streak_days` (hold a current streak). No counters to go stale — the API recomputes every read.

### 16.5 Dashboard analytics (derived, labelled)

90-day GitHub-style heatmap, favorite genres (colored bars), favorite authors (aggregated from per-title stats), recent activity feed, active-goals summary and achievement progress. Everything comes from existing `reading/stats` + `history` + `achievements` + `goals` — no new analytics endpoints.

### 16.6 Personalization (synced, not local)

Default library view (grid/list/compact), card density (cozy/compact), preferred genres (15 max, stored as DB slugs) and a homepage-recommendations toggle live on the User row via `/users/prefs`, so they follow the user across devices. Reader/theme prefs remain local (they're device-rendering concerns).

### 16.7 Performance & a11y

Library fetches up to 100 titles per request (API page cap); shelves filter client-side; dialog semantics (Esc/outside-click) on every modal; `aria-pressed` on view/shelf toggles; focus-visible everywhere; reduced-motion respected; empty states always teach the next action.

### 16.8 Roadmap (flagged, not faked)

Public/shared collections (is_private is ready but no public routing), per-title "Add to collection" menu on the details page, reading-session tracking for real reading-time analytics, bookmark folders/notes/export, download management for offline chapters (no download API exists), goal achievements, and pagination for libraries beyond 100 titles. Social layers (profiles, follows, shared lists) need the user-relationship model first.

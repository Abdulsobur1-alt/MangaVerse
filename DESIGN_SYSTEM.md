# MangaVerse Design System — Phase 1

> **"Obsidian"** — premium, cinematic, minimal. Apple × Netflix × Spotify × Kindle.
> This document is the single source of truth for every screen built after Phase 1.
> Companion to [`DESIGN_STRATEGY.md`](./DESIGN_STRATEGY.md) (product strategy & roadmap).

**Stack note:** Tailwind CSS v4, CSS-first theming. All tokens live in `apps/web/src/app/globals.css` inside `@theme {}`. There is no `tailwind.config.js` — **the `@theme` block IS the configuration** (see §14).

---

## 1. Brand Identity

**Personality:** Knowledgeable · Elegant · Confident · Modern · Immersive · Friendly · Fast.

**Values**
| Value | Meaning in product terms |
|---|---|
| Craft | Every pixel is intentional; nothing ships "good enough". |
| Respect | Reader-first: no clutter, no dark patterns, no fake urgency. |
| Momentum | Reading streaks, Continue everywhere, zero-friction resumption. |
| Belonging | Community feels like a fandom, not a forum. |

**Tone of voice:** Direct, warm, expert. "Continue where you left off." Not "Welcome back, user!" → "Good to see you again." Avoid anime-slang and hype; use precise, confident microcopy.

**Emotional goals:** *Arrival* (home feels curated), *Flow* (reader disappears), *Progress* (streaks & shelves make reading feel like an investment), *Discovery* (finding a new obsession is the product).

**Design philosophy:** *Content is the hero.* Covers fill frames, chrome recedes, one primary action per screen, motion explains rather than decorates.

**UX principles**
1. One primary action per view.
2. Resume > restart — always surface the last position.
3. Consistency is trust — one shell, one header language, one component set.
4. Fast feels premium — skeletons reserve space, images preload, zero CLS.
5. Keyboard is first-class — ⌘K, ←→ reading, Esc closes.

---

## 2. UI / UX Audit (Phase 1 baseline)

Verified findings from the codebase (fixed in Phase 0 work; tracked here for the record):

- **Navigation split** — 9 pages used a legacy standalone `TopBar` layout without sidebar/bottom-nav/⌘K; all now render inside `AppShell`. *(fixed)*
- **Template artifact** — 16+ violet primary buttons turned red on hover (`hover:bg-red-500`); replaced with `hover:brightness-110` / system buttons. *(fixed)*
- **Library was a flat grid** — rebuilt as a bookshelf (stats, shelf tabs, search, grid/list, progress). *(fixed)*
- **Inconsistent headers** — legacy pages used `text-xl`; all pages now use the editorial header language (eyebrow + display title). *(fixed)*
- **Remaining (Phase 2+):** value tokens (`mv-*`) still used widely — migrate to semantic tokens (§4) to enable the light theme; duplicate `TitleCard`/`StatTile` markup → extract to shared components (§13); icon-only buttons need an a11y label sweep (§11); reader chrome needs mobile edge-tap zones (Phase 3).

---

## 3. Design Tokens — Full Reference

All tokens are defined in `@theme {}` in `globals.css`. Utilities are generated automatically.

### 3.1 Color — dark (value tokens, "Obsidian")
| Token | Value | Use |
|---|---|---|
| `mv-dark` | `#09090b` | app background |
| `mv-darker` | `#111113` | surfaces |
| `mv-surface` / `mv-card` | `#18181b` | cards / inputs |
| `mv-border` | `#27272a` | hairline borders |
| `mv-border-light` | `#3f3f46` | raised borders |
| `mv-accent` | `#7c3aed` | primary (violet-600) |
| `mv-purple` | `#8b5cf6` | secondary (violet-500) |
| `mv-violet` | `#a78bfa` | accent (violet-400) |
| `mv-gold` | `#f59e0b` | ratings / highlights |
| `mv-success` / `mv-warning` / `mv-danger` | `#10b981` / `#f59e0b` / `#ef4444` | state |
| `mv-text` → `mv-text-dim` | `#fafafa` → `#52525b` | type ramp |

### 3.2 Semantic color tokens (theme-aware — use these going forward)
*Light theme is gated behind `<html data-theme="light">` — it does **not** auto-flip on OS preference, so nothing renders as a light/dark hybrid mid-migration. A theme toggle sets the attribute in a later phase.*

| Token | Dark | Light | Use |
|---|---|---|---|
| `app` | `#09090b` | `#fafafa` | page background |
| `app-elevated` | `#0d0d10` | `#ffffff` | shell / topbar |
| `surface` | `#111113` | `#f4f4f5` | raised surfaces |
| `surface-raised` | `#18181b` | `#ffffff` | cards / inputs |
| `border-soft` | `#27272a` | `#e4e4e7` | hairlines |
| `border-strong` | `#3f3f46` | `#d4d4d8` | raised borders |
| `text-ink` | `#fafafa` | `#18181b` | primary text |
| `text-secondary` | `#a1a1aa` | `#52525b` | secondary |
| `text-muted` | `#71717a` | `#71717a` | tertiary |
| `text-faint` | `#52525b` | `#a1a1aa` | placeholders / disabled |
| `brand` | `#7c3aed` | `#7c3aed` | primary action |
| `brand-hover` | `#8b5cf6` | `#6d28d9` | primary hover |
| `brand-soft` | `#a78bfa` | `#7c3aed` | links / accents |
| `on-brand` | `#ffffff` | `#ffffff` | text on brand |
| `info` | `#3b82f6` | `#2563eb` | info state |

Generated utilities: `bg-app`, `bg-surface-raised`, `text-ink`, `border-soft`, `bg-brand`, `hover:bg-brand-hover`, …

**State colors**
- Hover: `brand-hover` (fills) · `border-strong→violet/50` (borders) · `white/5` (ghost bg).
- Pressed: translateY(0) + reduced glow (`.btn-primary:active`).
- Disabled: `opacity-50` + `cursor-not-allowed`, no hover change.
- Skeleton: `#17171a` base + `white/6` shimmer sweep (`.skeleton`).
- Scrollbar: `#2a2a2f` thumb on `mv-dark` track (WebKit + Firefox `scrollbar-color`).
- Selection: `rgba(124,58,237,.45)` bg, white text.
- Reader: `--reader-bg-*` / `--reader-text-*` / `--reader-muted-*` for dark · sepia · light prose themes.
- Comments/community: author avatar = brand gradient; tag chips use per-tag tone (see `Badge`).
- Badges: 7 tones (neutral/accent/success/warning/danger/gold/info) via `Badge` primitive.

### 3.3 Typography scale
| Token / utility | Size | Line-height | Tracking | Use |
|---|---|---|---|---|
| `text-display` | clamp(1.875→3rem) | 1.08 | −0.03em | hero (30px mobile → 48px desktop) |
| `text-h1` | clamp(1.75→2.25rem) | 1.15 | −0.02em | page titles |
| `text-h2` | clamp(1.375→1.75rem) | 1.2 | −0.02em | sections |
| `text-h3` | 1.375rem | 1.25 | — | cards |
| `text-h4` | 1.1875rem | 1.3 | — | sub-cards |
| `text-h5` | 1.0625rem | 1.35 | — | list titles |
| `text-overline` | 0.6875rem | 1.2 | +0.14em | eyebrows (`.eyebrow`) |

**Mobile-first rule:** headings use `text-2xl sm:text-3xl md:text-4xl` (28→36→40px) — never `text-3xl` at the base width. Hero titles: 30–34px mobile → 48px desktop (`text-[1.875rem] sm:text-4xl md:text-6xl` or the `text-display` token).
| body | 14px (`text-sm`) | 1.5 | — | default |
| caption | 12px (`text-xs`) | 1.5 | — | secondary |
| label | 10–11px | 1.4 | — | meta, badges |

Display face: **Space Grotesk** (`font-display`, headings). Body: **Inter** (`font-sans`).
Reader prose: serif (Georgia) default for light novels, 18–20px, line-height 1.9; sans option; dark/sepia/light themes.

### 3.4 Radius / Elevation / Motion / Layout tokens
| Group | Tokens |
|---|---|
| Radius | `rounded-tile` 12 (buttons/covers) · `rounded-control` 8 (inputs) · `rounded-card` 16 · `rounded-panel` 20 · `rounded-pill` ∞ |
| Elevation | `shadow-card`, `shadow-card-hover`, `shadow-glow`, `shadow-glow-sm`, `shadow-modal`, `shadow-float`, `shadow-overlay`, `shadow-inset` |
| Motion | `duration-fastest 100` · `fast 150` · `base 250` · `slow 450` · `slowest 700ms`; `ease-out-expo`, `ease-out-quart`, `ease-spring` |
| Z-index | `z-floating 30` · `z-topbar 40` · `z-sidebar 50` · `z-overlay 90` · `z-toast 100` |
| Containers | `max-w-content` 80rem · `max-w-compact` 48rem · `max-w-prose` 42rem |
| Focus | `--focus-ring-color` `rgba(167,139,250,.75)` · width 2 · offset 2 (`.focus-ring` + `:focus-visible`) |
| Icon sizes | 16 inline · 20 default · 24 hero (enforced by `Icon` primitive) |

**Spacing rule:** 4px base grid. Scale: 4·8·12·16·20·24·32·40·48·64·80·96. Page padding: `px-5 sm:px-6 md:px-8`; section rhythm `space-y-14` on home, `mb-8` headers.

---

## 4. Layout System

| Breakpoint | Nav | Grid |
|---|---|---|
| `< 768 (mobile)` | Bottom nav (5 slots) + floating search | 2-col cover grids |
| `768–1023 (md)` | Sidebar icons (14px rail) | 3–4 col |
| `1024–1279 (lg)` | Sidebar expands on hover | 4–6 col |
| `≥ 1280 (xl)` | Sidebar expanded | 6+ col |

- Page column: `max-w-content` (80rem), centered.
- Forms/settings: `max-w-compact` (48rem). Reader prose: `max-w-prose` (42rem). Strip reader: 700px.
- Desktop shell: fixed sidebar (`w-14` → `w-60` on hover) + `md:pl-14` content offset + sticky topbar.
- Mobile: bottom nav `h-16` + `pb-[calc(4rem+env(safe-area-inset-bottom)+3.5rem)]` content buffer (clears Continue pill + floating search) + `safe-area-inset-bottom`.

---

## 5. Iconography

- **System:** stroke-based 24×24 outline set (heroicons-style), single source: `components/ui/Icon.tsx`.
- **Sizes:** 16 (inline/meta) · 20 (nav/buttons, default) · 24 (hero/empty states).
- **Stroke widths:** 1.8 default · 2 emphasis · 2.2 bold/active.
- **Filled vs outlined:** outlined by default; **fill only for active/selected state** (e.g., bookmark saved, star rating).
- **Usage rules:** one icon per action; pair with text when the meaning isn't obvious; never invent meanings.
- **Accessibility:** icons are `aria-hidden` by default; interactive icons must live inside a labelled `<button>`/`<Link>` or carry a `title`. Never rely on color alone.
- Migration: swap inline `<svg>`s to `<Icon name="…" />` as pages are touched in later phases.

---

## 6. Component Inventory

| Component | Status | Location |
|---|---|---|
| Button (5 variants × 3 sizes, loading, link) | ✅ new | `components/ui/Button.tsx` |
| Icon (registry, sizes, strokes) | ✅ new | `components/ui/Icon.tsx` |
| Badge (7 tones + dot/pulse) | ✅ new | `components/ui/Badge.tsx` |
| Skeleton · Spinner · Kbd | ✅ new | `components/ui/` |
| AppShell (sidebar, bottom nav, ⌘K) | ✅ live | `components/AppShell.tsx` |
| TopBar · CoverImage · Reveal · SmoothScroll · ProtectedRoute | ✅ live | `components/` |
| TitleCard, StatTile, SectionHeader, EmptyState | ⚠️ duplicated per page | extract → `components/` (Phase 2) |
| Tabs / SegmentedControl, Select, Switch | 📋 adopt from shadcn | §15 |
| Dialog, DropdownMenu, Tooltip, Toast, Popover | 📋 adopt from shadcn | §15 |
| CommentCard, GenreCard, MangaCard, Pagination | 📋 composite (Phase 2–4) | — |
| Modal / Drawer / ContextMenu systems | ⏳ deferred — planned as shadcn/Radix wrappers (`ui/dialog`, `ui/drawer`, `ui/context-menu`) when overlays are needed by features | §15 |
| Sidebar favorites / collections | ⏳ covered by Library shelves today; pinned collections can slot into the sidebar's DISCOVER group later | §7 |

**Architecture:** `primitives (ui/) → composites (components/) → features (pages)`. Primitives are dependency-free, token-driven, accessible.

---

## 7. Navigation Spec (Phase 2)

### 7.1 Navigation UX audit (as-built)

- **Fixed:** pages stranded on a legacy layout — all render inside `AppShell` (Phase 0).
- **Fixed:** no breadcrumbs, no theme switch, no global route-change feedback.
- **Fixed:** shell was one monolith — extracted into reusable `components/shell/*`.
- **Resolved in this phase:** mobile lacked a persistent reader shortcut → sticky Continue pill; sidebar lacked reading progress + recently viewed → added; search lacked recents/trending/genres → added.

### 7.2 Information architecture

```
DISCOVER    Home · Discover(browse) · Library · Community
CONTINUE    Reading progress (top 3, per-series)      ← reader shortcut
OVERVIEW    History · Profile · Alerts · Settings
RECENT      Recently viewed (top 3, authed)
FOOTER      Get the App · Theme · Offline chip · Account
```

- Everything reachable in ≤ 2 clicks; no dead ends (breadcrumbs + "View all" links + empty states).
- Scales: new sections slot into a group; the rail collapses to icons on tablet.

### 7.3 Shell component map

| Component | Role |
|---|---|
| `Sidebar` | Desktop rail → expands on hover: sections, Continue Reading, Recently Viewed, unread badges, theme, offline chip |
| `TopBar` | Logo (mobile) · Breadcrumb (desktop) · search · Get App · theme · bell · avatar |
| `BottomNav` | Mobile: 5 thumb slots + floating search + sticky Continue pill with progress ring |
| `CommandPalette` | Universal search overlay (⌘K / "/"): recents, trending, genre chips, live results, focus trap |
| `Breadcrumb` | Pathname-derived trail; known routes mapped, slugs humanized |
| `NotificationCenter` / `ProfileMenu` | Glass dropdowns, outside-click + Esc + route-change close |
| `ThemeSwitcher` | Toggles `html[data-theme]`, persisted; labelled (sidebar) + icon (topbar) |
| `ContinueReading` | `useResumeData` hook + list; powers sidebar + mobile pill |

### 7.4 Keyboard experience

| Key | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Toggle command palette |
| `/` | Open command palette (when not typing) |
| `↑↓` + `↵` | Navigate / open in palette |
| `Esc` | Close palette, dropdowns, overlays |
| `← →` `A` `F` `C` `M` | Reader: navigate · auto-play · strip · chapters · prose |

Focus: palette traps Tab, restores focus on close; dropdowns close on Esc; `aria-current="page"` on active nav.

### 7.5 Motion (navigation)

- Sidebar expand: 300ms `ease-out` width + 200ms label fade (via `group-hover/side`).
- Palette/dropdowns: `scaleIn` 280ms `ease-out-expo`; overlay `fadeIn`.
- Page transition: `pageEnter` 350ms (fade + 6px rise) keyed on `pathname`.
- Route loading bar: 500ms gradient sweep, top of viewport, fades out.
- Bottom Continue pill: `fadeUp`; progress ring animates via `stroke-dasharray`.
- All durations zero out under `prefers-reduced-motion`.

---

## 8. Motion System

| Context | Duration | Curve |
|---|---|---|
| Hover (buttons, cards) | 150–250ms | `ease-out` / `expo` |
| Card lift | 250ms | `ease-out-quart` |
| Modal/palette entrance | 280ms | `ease-out-expo` (`scaleIn`) |
| Page content reveal | 600ms | `ease-out-expo` |
| Hero cross-fade | 1000ms | `ease` |
| Marquee loop | 32s linear | linear (pauses on hover) |
| Image load | fade 300ms | `ease-out` |
| Progress bars | 500–700ms | `ease-out` |

- Skeletons: 1.6s shimmer, `prefers-reduced-motion` zeroes all durations globally.
- Lenis smooth scroll with `data-lenis-prevent` on scroll containers.
- Rule: entrance animations only for the first viewport (hero, section headers) — never every card.

---

## 9. Accessibility Checklist (WCAG AA)

- [ ] Color contrast ≥ 4.5:1 body · 3:1 large type (zinc ramp verified on dark).
- [x] `prefers-reduced-motion` global guard.
- [x] `:focus-visible` rings + `.focus-ring` utility.
- [x] Semantic landmarks (`header/nav/main/aside/footer`) in AppShell.
- [x] Dialogs: `role="dialog"`, `aria-modal`, Esc to close (palette).
- [ ] Icon-only buttons: `aria-label` audit sweep (Phase 2).
- [ ] Tabs: toggle-button pattern with `aria-pressed` (library shelves) — or full ARIA tabs with `aria-controls`.
- [ ] Toast live regions: `role="status"`/`aria-live`.
- [ ] Touch targets ≥ 44×44px on mobile nav/actions.
- [ ] Images: alt text; decorative covers `alt=""`.

---

## 10. Figma-style Usage Notes (components)

- **Button:** primary for the single main action; secondary for alternatives; danger only for destructive confirmations; `loading` swaps to spinner; never two primaries in one view.
- **Badge:** status pills on covers (Ongoing/Completed/Hiatus), shelf labels, notification type chips; `pulse` only for live/online.
- **Icon:** keep strokeWidth consistent within a view; use 2.2 for active nav states; fill for selected bookmarks/stars.
- **Skeleton:** always reserve aspect-ratio space (`aspect-[3/4]` covers, fixed-height rows) to avoid CLS.
- **Spacing:** `mb-8` page headers, `gap-4` grids, `space-y-14` home sections, `p-5` cards, `p-6` panels.

---

## 11. Folder Structure (target)

```
apps/web/src/
├── app/                  # routes — pages only compose shared pieces
├── components/
│   ├── ui/               # primitives: Button, Icon, Badge, Skeleton, Spinner, Kbd, …
│   │   ├── dialog.tsx    # (Phase 2, shadcn-based)
│   │   └── …
│   ├── AppShell.tsx, TopBar.tsx, CoverImage.tsx, …
│   ├── TitleCard.tsx     # (extract Phase 2)
│   ├── StatCard.tsx      # (extract Phase 2)
│   └── EmptyState.tsx    # (extract Phase 2)
├── lib/
│   ├── api.ts, format.ts, cn.ts
│   └── hooks/
└── store/                # zustand (auth)
```

## 12. Suggested Refactors

1. **Semantic token migration** — replace `bg-mv-dark/…` value utilities with `bg-app/…` etc. page-by-page; then enable light theme (§3.2). Highest leverage, low risk per page.
2. **Extract `TitleCard`** (duplicated in home/browse) — one component with cover, rank, rating, status, progress variants.
3. **Extract `StatCard`** (dashboard/history/library duplicate) — value + label + accent + hint.
4. **Extract `SectionHeader`** (home/title/library) — eyebrow-less variant with gradient title + "View all".
5. **Icon sweep** — replace inline SVGs with `<Icon>`; gives consistent strokes/sizes and enables future lucide swap.
6. **Reader palette** — consume `--reader-*` tokens instead of hardcoded hex.

## 13. Tailwind v4 Theme Configuration

Tailwind v4 is CSS-first — no `tailwind.config.js`. The `@theme {}` block in `globals.css` is the configuration:

```css
@import 'tailwindcss';
@theme {
  --color-brand: #7c3aed;      /* → bg-brand, text-brand, border-brand, … */
  --text-h1: 2.25rem;          /* → text-h1 + --line-height/--letter-spacing modifiers */
  --radius-tile: 0.75rem;      /* → rounded-tile */
  --container-content: 80rem;  /* → max-w-content */
  --z-toast: 100;              /* → z-toast */
  --duration-slow: 450ms;      /* → duration-slow */
  --ease-out-expo: …;          /* → ease-out-expo */
}
```

Utilities layer: custom component classes (`.btn-primary`, `.card`, `.glass`, `.eyebrow`, `.skeleton`, …) live in `@layer components`; keyframes in plain CSS.

## 14. shadcn/ui Customization Plan

- **Adopt (Phase 2):** Dialog, DropdownMenu, Tooltip, Toast/Sonner, Tabs, Select, Switch, Popover, Progress, Slider.
- **Skip:** Button, Badge, Skeleton, Input — already covered by our primitives.
- **Setup (Tailwind v4, CSS-first):** shadcn's v4 flow reads theme from CSS variables. Map `oklch` variables to Obsidian values: `--background → #09090b`, `--foreground → #fafafa`, `--primary → #7c3aed`, `--primary-foreground → #fff`, `--ring → #a78bfa`, `--radius → 0.75rem`, `--secondary → #111113`, `--muted → #18181b`, `--border → #27272a`. Keep `baseColor: "zinc"` and override via the `@theme inline` mapping so `bg-primary` etc. resolve to our tokens.
- **Why:** shadcn gives us bulletproof a11y (Radix primitives) for overlays/forms without re-inventing focus traps or popper logic; our primitives stay dependency-free where Radix isn't needed.

## 15. Reusable Component Architecture

```
ui/ (primitives, no deps)
├── Button · Icon · Badge · Skeleton · Spinner · Kbd · Field
└── (Phase 2) Dialog · Tooltip · Toast · Select · Switch  ← shadcn/Radix wrappers

components/ (composites, compose primitives + data hooks)
├── TitleCard · StatCard · SectionHeader · EmptyState · CoverImage
├── AppShell · TopBar · CommandPalette · ShelfTabs
└── (Phase 3) ReaderChrome · ChapterList · CommentCard

app/ (features — pages only assemble composites)
```

Rule: a primitive never imports a hook; a composite never fetches more than its own data; a page never styles atoms directly.

# MangaVerse — User-Perspective UX Analysis

**Scope:** Home · Browse · Library · Reader — viewed through the reader's eyes, split across the four content categories (Manga, Manhwa, Manhua, Light Novels).
**Inputs:** The four chapter PDFs pasted into the repo root (`One Piece 1188/1189`, `Surviving as a Genius 087/088`), plus a review of the current Home (`apps/web/src/app/page.tsx`), Browse (`browse/page.tsx`), and Library (`library/page.tsx`) implementations.
**Status:** Analysis & recommendations only. Implementation happens after review.

---

## 1. What the PDFs tell us (shared evidence)

The files themselves are evidence of how a real reader obtains, names, and consumes chapters:

| Evidence | What it implies for UX |
|---|---|
| Files are named `Series — Chapter NNN` and `[NNN] Series` (`One Piece — Chapter 1188`, `[087] Surviving as a Genius…`) | Readers think in **series → chapter number**, not "titles" and "pages". Chapter numbers must be first-class UI (cards, updates, library, reader). |
| Both readable PDFs are exactly **16 pages** (one manga chapter, one manhwa episode) | Chapters are short, snack-sized sessions. The app should be **update-driven** ("what's new since I last opened") and **resume-driven** ("continue exactly where I stopped"), not a static catalog. |
| Obtained via Telegram scan/aggregator channels (`@Manga_LightN`, `@Manhwa_Weebs`) | Readers come from a **mobile-first, download/offline culture**. Fast "jump to chapter N", quick page/scroll navigation, and a thumbnail-free fallback experience all matter. |
| Manga (One Piece) vs Manhwa (Surviving as a Genius) are the same 16 pages but **different formats** (page-flip comic vs vertical-scroll webtoon) | **Category = format.** The reader, card, and "continue reading" affordances should differ by category: page-flip for manga, infinite scroll for manhwa/manhua, prose for light novels. |
| PDFs are image scans with **no text layer**; covers are the only recognition signal | **Cover art is the primary recognition cue.** Any card without a cover is a UX failure (browse grid currently renders bare title text when no cover exists — see §4). |

---

## 2. Cross-cutting findings (all categories)

From the reader's point of view, Home and Browse have the same jobs in every category — but the details differ:

**Home**
1. **"What's new in what I follow?"** is the #1 question. The current Home has Trending / New Updates / New Releases rails — good bones. The **New Updates** rail already shows recency ("Ch. 1189 · 2h ago"); the **Trending Now** and **New Releases** rails don't. Extending recency everywhere drives the daily habit.
2. **Continue Reading must persist across the app.** It exists on Home; it should also surface on Browse (a slim "Resume" strip) so readers never lose their place.
3. **Category rails should exist per format.** Home currently mixes formats in one grid. A reader of manhwa webtoons and a reader of light novels have different mental models (see §3).

**Browse**
1. Format pills already exist (`All / manga / manhwa / manhua / LN`) — the strongest existing affordance (precisely because the in-card type badge is ambiguous, see #3). Extend the pattern: **`/browse?format=manhwa` deep links** from Home category rails, genre chips, and the TopBar.
2. Missing sort the PDFs prove is needed: **"Recently Updated"** (readers chase new chapters, not just new *titles*). Current sorts are trending/newest/rating/title.
3. Grid cards show `totalChapters` ("1,089ch") — good. Add **chapter # of latest release** on the card ("up to Ch. 1189") so readers can see at a glance whether they're caught up. The type badge (`item.type.slice(0, 2)`) currently renders **"MA" for manga, manhwa, and manhua alike** (only light novels get "LN") — a concrete example of the uniform-card problem described below.
4. **Per-category metadata** is thin: manga needs demographic (shōnen/seinen/josei), light novels need author/volumes, manhua needs chapter-count-at-a-glance for its 1000-chapter backlog. One uniform card treats them all as "manga with covers" — the reader doesn't think that way.

---

## 3. Per-category analysis (the requested split)

### 🇯🇵 Manga — *page-flip comics* (evidence: One Piece)
Reader's mental model: *"I flip pages, right-to-left for JP releases, ~16 pages at a time, weekly cadence."*

- **Reader:** page-flip mode (RTL for Japanese, LTR for English), single-page + "long strip" toggle, page-number indicator ("p. 7/16"). Swipe/arrow nav; never a vertical infinite feed.
- **Home:** "New chapters today" rail with series thumbnails + exact chapter number; recency ("Ch. 1189 · 2h ago"); **demographic-aware trending** (shōnen/seinen/shojo/josei) — One Piece readers browse by demographic, not just genre.
- **Browse:** add **Demographic** filter (shōnen/seinen/shojo/josei) alongside Genre; show **volume awareness** where available ("Vol. 112 · Ch. 1189"); status pills (ongoing/completed) already exist.
- **Card:** cover-first, chapter-number badge, "new" dot when a chapter landed in the last 24h.

### 🇰🇷 Manhwa — *vertical-scroll webtoons* (evidence: Surviving as a Genius on Borrowed Time)
Reader's mental model: *"I scroll one long color page; an 'episode' drops weekly; if it's on hiatus I want to know before I start."*

- **Reader:** **infinite vertical scroll**, not page flip; episode = one continuous strip; auto-fit-to-width with tap-to-toggle zoom; remember scroll position per episode.
- **Home:** "New episodes" rail (call them **Episodes**, not Chapters — manhwa readers say "ep.", the file naming `[087]`/`[088]` reflects it); update times are critical ("Ep. 88 · 3h ago"); a **Top Webtoons** rail (rankings drive manhwa discovery).
- **Browse:** **Status is make-or-break for manhwa** (hiatus/dropped are endemic) — the existing status filter is correct; consider a "On hiatus" first-class pill. Covers are tall portrait — keep the 3:4 card but ensure the strip preview hints at scroll format (a subtle "scroll" glyph or "Ep." label).
- **Card:** "Ep. 88" badge, colored banner by status (the browse list view already uses green/blue/yellow status colors — bring them onto the grid cards and Home rails).

### 🇨🇳 Manhua — *long-form vertical webtoons*
Reader's mental model: *"Huge backlogs (500–1500+ chapters), near-daily releases, I search by 'how many chapters are out'."*

- **Reader:** same vertical scroll as manhwa; **batch-continuation** ("continue reading Ep. 1,203"); variable art heights must not cause layout jumps.
- **Home:** **Hot/Rankings rail** (manhua discovery is heavily ranking-driven); "updated today" count is a huge hook ("12 series updated today").
- **Browse:** surface **chapter count as a first-class value** (already displayed — make it prominent and sortable: "1,000+ ch"); a **"Completed manhua"** quick filter (readers binge finished series with big backlogs); batches ("Ch. 1200–1210 released") are a differentiator vs manga weekly singles.
- **Card:** chapter-count badge in accent color; "updated today" spark; origin flag (🇨🇳) like search suggestions already show.

### 📕 Light Novels — *prose, not pages*
Reader's mental model: *"I read paragraphs, not panels. I track progress in % or by chapter; I care about word count, read time, and a comfortable reading font."*

- **Reader:** **a text reader, not an image reader**: font size/line-height controls, serif vs sans toggle, **dark/sepia themes**, progress as % of chapter + "X min left". Page-flip and scroll are both valid — default to continuous scroll with a reading-width column.
- **Home:** "Continue reading" with **position %** (library currently computes % from chapters read — for LNs show position within the current chapter too); "New volumes" rail (LN releases come as chapters within volumes); **read-time estimates** on cards ("35 min read").
- **Browse:** previews should be **prose excerpts**, not cover-only; filter by **author and volume**; the LN card should de-emphasize page/chapter counts and show *words/read-time* instead.
- **Card:** 📕 mark (already used in search suggestions), author line, "Vol. N" when available, read-time chip.

---

## 4. Recommended changes mapped to pages

| # | Page | Change | Category | Effort |
|---|------|--------|----------|--------|
| 1 | Browse | Add **Recently Updated** sort ("Ch. X · time ago") | All | S (API sort + UI) |
| 2 | Browse | Show **latest chapter #** on cards ("up to Ch. 1189") | All | S |
| 3 | Browse | **Cover fallback**: render a styled gradient + series initial instead of bare text when no cover (grid + list) | All | S |
| 4 | Home | **Extend recency badges** ("2h ago") to the Trending Now + New Releases rails (New Updates already has them) | All | S |
| 5 | Home | **Category rails** with format deep-links (`/browse?format=…`) | All | M |
| 6 | Reader | **Format-aware rendering**: page-flip (manga) vs vertical scroll (manhwa/manhua) vs prose reader (LN) | Per-category | L |
| 7 | Reader/Library | LN progress as **position % + "min left"**; manhwa progress as **"Ep. 88"** instead of % | LN/Manhwa | M |
| 8 | Browse | **Demographic filter** (shōnen/seinen/shojo/josei) for manga | Manga | M |
| 9 | Browse | **Read-time / word-count chips** and prose previews for LN | LN | M |
| 10 | Library | **"Continue →" button** that resumes the exact chapter/episode/page | All | M |
| 11 | Browse/Home | **Status banner colors on grid cards** (extend the browse list view's green/blue/yellow onto grid + Home rails) | Manhwa/All | S |

*Effort: S = small (front-end only), M = medium (API tweak + front-end), L = large (new reader surfaces).*

---

## 5. Open questions before implementation

1. **Reader scope:** Should #6 be built as one adaptive reader component keyed by `type`, or three separate reader pages? (Recommendation: one component, `type`-driven modes — least duplication.)
2. **Data gaps:** Does the Titles API expose `demographic`, `latestChapter.createdAt`, and LN `wordCount`? Some changes (#4, #8, #9) depend on these fields existing or being added to the API response.
3. **Priority:** Are the "S" quick wins (#1–#4, #11) the right first batch, or do you want the reader overhaul (#6) scheduled first?

---

## Appendix — file evidence (as inspected)

- `One Piece - Chapter 1188 @Manga_LightN.pdf` — **0 bytes** (empty; paste failed — no content to analyze).
- `One Piece Chapter 1189 @manga_lightN.pdf` — PDF 1.4, **16 pages**, ~10 MB, image-based (no text layer) → **Manga**.
- `[087] [MW] Surviving as a Genius on [@Manhwa_Weebs].pdf` — PDF 1.7, **16 pages**, ~12 MB, image-based → **Manhwa**.
- `[088] [MW] Surviving as a Genius on Borro [@Manhwa_Weebs].pdf` — PDF 1.3, exactly 2 MB, unparseable by poppler (truncated) → **Manhwa** (partial).

Note: these files live in the repo root and are currently **untracked**. They should not be committed; recommend moving them out of the repo (or git-ignoring `*.pdf` at the root) before the next commit.

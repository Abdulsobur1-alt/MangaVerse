/**
 * Light-novel prose seed — populates Chapter.contentText so the format-aware
 * prose reader has real content to render.
 *
 * Usage:
 *   pnpm --filter @mangaverse/api db:seed:ln           # backfill missing text
 *   pnpm --filter @mangaverse/api db:seed:ln -- --force  # regenerate everything
 *
 * What it does:
 *   1. Upserts a handful of curated LIGHT_NOVEL titles (type: 'light_novel')
 *      with chapter lists, so the prose reader is demonstrable end-to-end.
 *   2. Generates deterministic, theme-aware light-novel prose for each chapter
 *      and stores it in Chapter.contentText. Generation is seeded from
 *      `slug:chapterNumber`, so re-runs produce byte-identical text.
 *   3. Backfills contentText for any existing light_novel chapters (e.g. admin
 *      re-tagged MangaDex imports) that are missing it.
 *
 * MangaDex hosts image-only chapters, so there is no upstream text source —
 * the prose here is original generated content for the demo/prose-reader path.
 */

import { prisma } from './lib/prisma.js';
import { meilisearch } from './services/meilisearch.js';

// ─── Types ────────────────────────────────────────────

interface LnTheme {
  protagonist: string; // main character name
  companion: string;   // recurring secondary character
  setting: string;     // school / estate / ship — where the story lives
  power: string;       // magic system / ability name
  city: string;        // the place the story orbits
  guild: string;       // order / academy / faction
  antagonist: string;  // the opposing force
}

interface LnSeedTitle {
  slug: string;
  title: string;
  author: string;
  genres: string[];
  tags: string[];
  synopsis: string;
  status: string;
  releaseYear: number;
  chapterTitles: string[];
  theme: LnTheme;
}

// ─── Curated titles ───────────────────────────────────

const LN_TITLES: LnSeedTitle[] = [
  {
    slug: 'the-archmages-last-candle',
    title: "The Archmage's Last Candle",
    author: 'M. Voss',
    genres: ['fantasy', 'action', 'drama'],
    tags: ['magic', 'academy', 'tragedy'],
    synopsis:
      'Eira Voss, the last student of a dying school of candleflame magic, inherits her master\'s final quest: rekindle the light at the heart of Ashenhollow before the Warden Council snuffs it out forever.',
    status: 'ongoing',
    releaseYear: 2024,
    chapterTitles: [
      'The Inheritance of Ash',
      'A Candle in the Dark',
      "The Warden's Summons",
      'Kindling',
      'The Hollow Heart',
      'An Ember of Doubt',
      'The Trial of Flame',
      'What the Fire Remembers',
      'The Rekindling',
      'A Light for the Long Night',
    ],
    theme: {
      protagonist: 'Eira',
      companion: 'Kael',
      setting: 'Ashenhollow Academy',
      power: 'candleflame magic',
      city: 'Ashenhollow',
      guild: 'the Order of Candlelight',
      antagonist: 'High Warden Morath',
    },
  },
  {
    slug: 'reincarnated-as-the-villains-butler',
    title: "Reincarnated as the Villain's Butler",
    author: 'R. I. Shimizu',
    genres: ['isekai', 'comedy', 'drama'],
    tags: ['reincarnation', 'nobility', 'scheming'],
    synopsis:
      'Ren wakes up in the body of a minor noble\'s butler — and realizes he is the comic-relief servant who dies three chapters into the villainess\'s downfall. Armed only with knowledge of the plot and excellent tea etiquette, he sets out to keep Lady Seraphine from making every catastrophic choice the story demands of her.',
    status: 'ongoing',
    releaseYear: 2025,
    chapterTitles: [
      'Tea and Other Calamities',
      'The Villainess Is Having a Bad Day',
      'Service with a Side of Sabotage',
      'The Marquess Makes His Move',
      'A Butler Is Never Late',
      'The Art of the Quiet Bluff',
      'When the Plot Misses Its Cue',
      'An Evening of Excellent Etiquette',
    ],
    theme: {
      protagonist: 'Ren',
      companion: 'Lady Seraphine',
      setting: 'Heliograph Estate',
      power: 'foreknowledge and flawless manners',
      city: 'Vellemire',
      guild: 'the Butler\'s Guild',
      antagonist: 'the Marquess of Thornwreath',
    },
  },
  {
    slug: 'starlight-covenant',
    title: 'Starlight Covenant',
    author: 'A. Venn',
    genres: ['sci-fi', 'romance', 'mystery'],
    tags: ['space', 'orbit', 'conspiracy'],
    synopsis:
      'In the orbital city of Meridian, signal engineer Nyx Okafor hears a pattern in the static no one else can — a rhythm that only appears when the city turns away from the sun. When Dr. Alaric Venn arrives asking questions about the old covenant station, Nyx must decide whether the voice in the stars is a friend, a weapon, or something that has been waiting.',
    status: 'ongoing',
    releaseYear: 2024,
    chapterTitles: [
      'The Frequency at Dawn',
      'Meridian at Rest',
      'The Man Who Read Static',
      'First Light Protocol',
      'The Covenant Station',
      'What the Silence Knows',
    ],
    theme: {
      protagonist: 'Nyx',
      companion: 'Dr. Alaric Venn',
      setting: 'the orbital city of Meridian',
      power: 'stellar resonance',
      city: 'Meridian',
      guild: 'the First Light cult',
      antagonist: 'the First Light cult',
    },
  },
];

// ─── Deterministic PRNG ───────────────────────────────
// Seeded from `slug:chapterNumber` so the same chapter always yields the same
// prose (idempotent re-seeding) while different chapters diverge.

function hashString(str: string): number {
  let h = 2166136261; // FNV-1a
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Prose template banks ─────────────────────────────
// Placeholders, filled per title: {p} protagonist · {c} companion · {s} setting
// · {w} power · {city} city · {g} guild · {a} antagonist · {t} series title.

const OPENINGS = [
  'The dream came to {p} again that night — not as a memory, but as a warning. {city} burned in it, every window lit from within like paper held too close to a flame.',
  'Three knocks. {p} counted them twice before answering, because the first rule of {s} was that nothing arrived in threes by accident.',
  'The letter bore the seal of {g}, and the seal was still warm. {p} turned it over three times before breaking it, half-expecting the wax to burn.',
  'It began, as most of {p}\'s disasters did, with an invitation that should have been thrown away.',
  'Morning arrived through the high windows of {s} like a slow apology. {p} had been awake for hours, watching the dust turn to gold.',
];

const SETUPS = [
  'There were exactly two hundred and eleven old lessons recorded in the archive of {s}. {p} had learned all of them before {c} had finished learning to tie a proper knot, which had been the source of considerable friction between them ever since.',
  'The truth about {w} was that it was never truly about the fire. It was about memory — about what the flame remembered when it was lit, and what it chose to forget when it went out.',
  '{city} had been built in the shape of a hand, its districts spread like fingers around the open palm of the harbor. {s} sat at the wrist, guarding the only road in, which {p} had always suspected was less about defense and more about keeping its people in.',
  'Everyone at {s} had a theory about why the council had tolerated the old school for so long. The most popular one, whispered over supper, was that {g} owed them a debt too large to collect all at once.',
  'The lesson that morning concerned the difference between a flame that wants to burn and a flame that is commanded to. {p} had always thought it a strange distinction, until {a} made it matter.',
  'There was a map in the library of {s} that no one was supposed to use. {p} had found it by accident, and had spent a very pleasant winter memorizing every wrong thing it said.',
  'The old texts called {w} the last language of the world\'s childhood — older than writing, older than doors, spoken properly only by things that did not have hands.',
  'What {c} never said aloud was that {p} had been the reason the Warden Council had come at all. What {p} never said aloud was that they knew.',
];

const DIALOGUES = [
  '"You\'re going to get yourself killed," {c} said, not looking up from the book.\n"That\'s the plan," {p} replied, with the particular brightness of a lie rehearsed for company.\n"Good," {c} said. "I\'ll tell them you died bravely."',
  '"The council will be here by sundown," {a} said, and the voice carried across the hall like a bell struck once. "I\'d advise you to be elsewhere by then."\n{p} did not move. "I was told to advise you the same."',
  '"You know what they say about people who touch {w}."\n"That they make excellent funerals," {p} said. "It\'s the companionship I\'m really here for."',
  '"Explain it to me again," {c} said slowly, "as if I were a child. A very patient child."\n{p} considered this. "A flame is a promise that something remembers you. Everything else is architecture."',
  '"Is that a threat?"\n"Only if you intend to treat it like one," {p} said. "I prefer to think of it as a very small candle held in a very dark room."',
];

const ACTIONS = [
  'The first flame {p} had ever kindled had taken three hours and left the room smelling of burnt hair. The one now burning at the center of the hall took less than a heartbeat, and it burned white, and it burned without smoke, and the silence that followed it was the loudest thing {p} had ever heard.',
  'Flame answered flame. The torches along the walls guttered, bent, and turned toward the center of the hall like flowers toward the sun. {p} walked into the middle of that impossible geometry and raised one hand.',
  'The floor of the vault was glass, and beneath the glass the light of {city} burned — a thousand tiny flames, one for every person in the city, each tied to a wick of the great candle at the heart of {s}. {p} watched the shadow fall across them one by one.',
  'There was a moment, then, when {w} hung between the two of them like a held breath. {p} could see {a} deciding, could see the exact second the decision turned, and the fire moved before the hand that commanded it.',
  'The sound it made was not a roar. It was a sigh — the sound a thing makes when it has waited a very long time and the waiting is finally over. {p} held on to the thread of it and pulled.',
];

const AFTERMATHS = [
  'Afterward, {c} found {p} sitting on the roof with a candle between them, watching the smoke climb. Neither of them said anything for a long time. The candle said enough.',
  '{p} had expected to feel triumphant. Instead there was only the particular quiet that follows a thing done properly — the sense of a page turned, a door closed, a flame banked for the night.',
  'The smell of smoke followed them all the way back to {s}, clinging to sleeves and hair like an accusation. {c} kept looking back the way they had come, and saying nothing, which was worse.',
  'It was only later, alone, that {p} realized the flame had never once asked for permission. And stranger still — it had never once been wrong.',
];

const CLOSINGS = [
  'The candle at the heart of {s} had not been lit in a hundred years. As {p} watched, something at the edge of the flame — just for an instant — looked back.',
  'Far below, in the vaults no one spoke about, something answered the call. It was not the council. It was older. It had been waiting for a hand that knew how to hold fire.',
  'When {p} finally slept, the dream did not come. In its place was a corridor of unlit candles, and at the far end of it, a door that had not been there yesterday.',
  'The last thing {p} saw before the light went out was not the shadow. It was the way the flame leaned, ever so slightly, toward the direction of home.',
];

// ─── Prose generation ─────────────────────────────────

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function fill(template: string, theme: LnTheme, seriesTitle: string): string {
  return template
    .replace(/\{p\}/g, theme.protagonist)
    .replace(/\{c\}/g, theme.companion)
    .replace(/\{s\}/g, theme.setting)
    .replace(/\{w\}/g, theme.power)
    .replace(/\{city\}/g, theme.city)
    .replace(/\{g\}/g, theme.guild)
    .replace(/\{a\}/g, theme.antagonist)
    .replace(/\{t\}/g, seriesTitle);
}

const WORD_TARGET = 950;

function generateChapterProse(
  theme: LnTheme,
  seriesTitle: string,
  chapterNumber: number,
  chapterTitle: string,
  slugSeed: string,
): string {
  const rng = mulberry32(hashString(`${slugSeed}:${chapterNumber}`));
  const paragraphs: string[] = [];

  // Opening hook, then a mix weighted toward setup early on and action later.
  paragraphs.push(fill(shuffled(OPENINGS, rng)[0], theme, seriesTitle));

  const setupCount = 2 + Math.floor(rng() * 2);
  for (const p of shuffled(SETUPS, rng).slice(0, setupCount)) {
    paragraphs.push(fill(p, theme, seriesTitle));
  }

  if (rng() > 0.35) paragraphs.push(fill(shuffled(DIALOGUES, rng)[0], theme, seriesTitle));
  if (chapterNumber >= 2) {
    const actionCount = 2 + Math.floor(rng() * 2);
    for (const p of shuffled(ACTIONS, rng).slice(0, actionCount)) {
      paragraphs.push(fill(p, theme, seriesTitle));
    }
  } else {
    paragraphs.push(fill(shuffled(ACTIONS, rng)[0], theme, seriesTitle));
  }

  paragraphs.push(fill(shuffled(AFTERMATHS, rng)[0], theme, seriesTitle));

  // Pad to the word target with extra setup/aftermath beats (keeps the reader's
  // scroll-progress and WPM estimate meaningful), then close on a hook.
  // Note: beats are re-picked from shared pools, so a rare duplicate paragraph
  // is possible — acceptable for seed content.
  let words = paragraphs.join(' ').split(/\s+/).length;
  let guard = 0;
  while (words < WORD_TARGET && guard < 14) {
    const bank = rng() > 0.5 ? SETUPS : AFTERMATHS;
    paragraphs.splice(paragraphs.length - 1, 0, fill(shuffled(bank, rng)[0], theme, seriesTitle));
    words = paragraphs.join(' ').split(/\s+/).length;
    guard++;
  }

  paragraphs.push(fill(shuffled(CLOSINGS, rng)[0], theme, seriesTitle));

  return `${chapterTitle}\n\n${paragraphs.join('\n\n')}`;
}

// Generic fallback theme for backfilling existing LN titles we didn't curate.
function themeFromTitle(title: string, slug: string): LnTheme {
  const word = slug.replace(/[^a-z]+/g, ' ').trim().split(/\s+/).filter(Boolean)[0] || 'Aria';
  const protagonist = word.charAt(0).toUpperCase() + word.slice(1);
  return {
    protagonist,
    companion: 'Theo',
    setting: 'the old city',
    power: 'an old and patient magic',
    city: 'the old city',
    guild: 'the Order',
    antagonist: 'the Council',
  };
}

// ─── Main ─────────────────────────────────────────────

async function main() {
  const force = process.argv.includes('--force');
  console.log('📕 Seeding light-novel prose content…');
  if (force) console.log('♻️  Force mode — regenerating all chapter text.');

  let titlesUpserted = 0;
  let chaptersWritten = 0;
  let chaptersSkipped = 0;

  // 1. Curated light novels.
  for (const t of LN_TITLES) {
    const title = await prisma.title.upsert({
      where: { slug: t.slug },
      update: {
        title: t.title,
        type: 'light_novel',
        status: t.status,
        genres: t.genres,
        tags: t.tags,
        author: t.author,
        synopsis: t.synopsis,
        releaseYear: t.releaseYear,
      },
      create: {
        slug: t.slug,
        title: t.title,
        type: 'light_novel',
        status: t.status,
        genres: t.genres,
        tags: t.tags,
        author: t.author,
        synopsis: t.synopsis,
        releaseYear: t.releaseYear,
      },
    });
    titlesUpserted++;

    for (let n = 1; n <= t.chapterTitles.length; n++) {
      const chapterTitle = t.chapterTitles[n - 1];
      const existing = await prisma.chapter.findUnique({
        where: { titleId_number: { titleId: title.id, number: n } },
        select: { id: true, contentText: true },
      });

      if (existing?.contentText && !force) {
        chaptersSkipped++;
        continue;
      }

      const contentText = generateChapterProse(t.theme, t.title, n, chapterTitle, t.slug);
      // Stagger publish dates so the newest chapter looks recent.
      const createdAt = new Date(Date.now() - (t.chapterTitles.length - n) * 86_400_000);

      await prisma.chapter.upsert({
        where: { titleId_number: { titleId: title.id, number: n } },
        update: { title: chapterTitle, contentText },
        create: {
          titleId: title.id,
          number: n,
          title: chapterTitle,
          contentText,
          createdAt,
        },
      });
      chaptersWritten++;
    }

    const totalChapters = await prisma.chapter.count({ where: { titleId: title.id } });
    await prisma.title.update({
      where: { id: title.id },
      data: { totalChapters, updatedAt: new Date() },
    });
    console.log(`✅ "${t.title}" — ${totalChapters} chapters (${t.chapterTitles.length} with generated prose)`);
  }

  // 2. Backfill any existing light_novel chapters missing contentText
  //    (e.g. MangaDex imports later re-tagged as light novels by an admin).
  const existingLns = await prisma.title.findMany({
    where: {
      type: { in: ['light_novel', 'LIGHT_NOVEL'] },
      slug: { notIn: LN_TITLES.map((t) => t.slug) },
    },
    select: { id: true, slug: true, title: true },
  });

  for (const ln of existingLns) {
    const chapters = await prisma.chapter.findMany({
      where: { titleId: ln.id },
      orderBy: { number: 'asc' },
    });
    for (const ch of chapters) {
      if (ch.contentText && !force) {
        chaptersSkipped++;
        continue;
      }
      const theme = themeFromTitle(ln.title, ln.slug);
      const contentText = generateChapterProse(theme, ln.title, ch.number, ch.title || `Chapter ${ch.number}`, ln.slug);
      await prisma.chapter.update({ where: { id: ch.id }, data: { contentText } });
      chaptersWritten++;
    }
    if (chapters.length > 0) {
      console.log(`✅ Backfilled "${ln.title}" — ${chapters.length} chapters`);
    }
  }

  // 3. Best-effort Meilisearch index (falls back to DB search if Meili is down).
  try {
    await meilisearch.initIndex();
    const lns = await prisma.title.findMany({
      where: { type: { in: ['light_novel', 'LIGHT_NOVEL'] } },
    });
    await meilisearch.bulkUpsert(
      lns.map((t) => ({
        id: t.id,
        slug: t.slug,
        title: t.title,
        alternativeTitles: t.alternativeTitles,
        type: t.type,
        genres: t.genres,
        tags: t.tags,
        author: t.author,
        artist: t.artist,
        synopsis: t.synopsis,
        rating: t.rating,
        totalChapters: t.totalChapters,
        coverUrl: t.coverUrl,
        status: t.status,
      })),
    );
    console.log(`🔍 Indexed ${lns.length} light novels in Meilisearch`);
  } catch {
    console.log('ℹ️  Meilisearch unavailable — search will fall back to the database');
  }

  console.log('\n🎉 Light-novel seed complete!');
  console.log(`   Titles upserted:      ${titlesUpserted}`);
  console.log(`   Chapters written:     ${chaptersWritten}`);
  console.log(`   Chapters skipped:     ${chaptersSkipped}`);
  if (!force) {
    console.log('   Re-run with --force to regenerate all prose.');
  }
}

main()
  .catch((err) => {
    console.error('❌ Light-novel seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

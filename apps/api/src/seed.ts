/**
 * Database seed script.
 *
 * Usage: pnpm --filter @mangaverse/api db:seed
 *
 * Populates the database with titles from MangaDex API
 * and indexes them in Meilisearch.
 */

import { prisma } from './lib/prisma.js';
import { mangadex } from './services/mangadex.js';
import { meilisearch } from './services/meilisearch.js';

async function seed() {
  console.log('🌱 Starting database seed...');

  // Check if we already have data
  const existingCount = await prisma.title.count();
  if (existingCount > 10) {
    console.log(`ℹ️  Database already has ${existingCount} titles. Skipping seed.`);
    console.log('   To re-seed, run: npx prisma migrate reset --force && tsx src/seed.ts');
    return;
  }

  // Initialize Meilisearch index
  await meilisearch.initIndex();

  // Fetch popular titles from MangaDex
  console.log('📡 Fetching popular titles from MangaDex API...');
  const popular = await mangadex.getPopular(50);

  // Fetch latest titles
  console.log('📡 Fetching latest titles from MangaDex API...');
  const latest = await mangadex.getLatest(50);

  const allManga = [...popular.data, ...latest.data];
  const seen = new Set<string>();
  let imported = 0;

  for (const manga of allManga) {
    if (seen.has(manga.id)) continue;
    seen.add(manga.id);

    const normalized = mangadex.normalizeTitle(manga);
    const slug = normalized.slug;

    try {
      await prisma.title.upsert({
        where: { slug },
        update: {
          title: normalized.title,
          type: normalized.type,
          status: normalized.status,
          genres: normalized.genres,
          tags: normalized.tags,
          author: normalized.author,
          artist: normalized.artist,
          coverUrl: normalized.coverUrl,
          synopsis: normalized.synopsis,
          releaseYear: normalized.releaseYear,
        },
        create: {
          slug,
          title: normalized.title,
          alternativeTitles: normalized.alternativeTitles,
          type: normalized.type,
          status: normalized.status,
          genres: normalized.genres,
          tags: normalized.tags,
          author: normalized.author,
          artist: normalized.artist,
          coverUrl: normalized.coverUrl,
          synopsis: normalized.synopsis,
          releaseYear: normalized.releaseYear,
        },
      });

      imported++;
    } catch (err) {
      // skip individual failures — some manga have duplicate slugs
    }
  }

  console.log(`✅ Imported ${imported} unique titles into the database`);

  // Index in Meilisearch
  console.log('🔍 Indexing titles in Meilisearch...');
  const allTitles = await prisma.title.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      alternativeTitles: true,
      type: true,
      genres: true,
      tags: true,
      author: true,
      artist: true,
      synopsis: true,
      rating: true,
      totalChapters: true,
      coverUrl: true,
      status: true,
    },
  });

  await meilisearch.bulkUpsert(allTitles);
  console.log(`✅ Indexed ${allTitles.length} titles in Meilisearch`);

  console.log('\n🎉 Seed complete!');
  console.log(`   Titles: ${allTitles.length}`);
  console.log(`   Run \`npx prisma studio\` to explore the data`);
}

seed()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

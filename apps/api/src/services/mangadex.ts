import axios from 'axios';
import { config } from '../config/index.js';

const client = axios.create({
  baseURL: config.mangadex.baseUrl,
  timeout: 10_000,
  headers: { 'User-Agent': 'MangaVerse/0.1.0' },
});

// Rate limiting: simple queue to avoid hitting MangaDex rate limits
let lastRequest = 0;
async function rateLimitedRequest<T>(url: string): Promise<T> {
  const now = Date.now();
  const elapsed = now - lastRequest;
  const minInterval = 1000 / config.mangadex.rateLimit;
  if (elapsed < minInterval) {
    await new Promise((r) => setTimeout(r, minInterval - elapsed));
  }
  lastRequest = Date.now();
  const { data } = await client.get(url);
  return data as T;
}

// ─── Response Types ─────────────────────────────────

interface MangaDexManga {
  id: string;
  type: 'manga';
  attributes: {
    title: { en?: string };
    altTitles: Record<string, string>[];
    description: { en?: string };
    status: string;
    contentRating: string;
    tags: { id: string; attributes: { name: { en: string }; group: string } }[];
    createdAt: string;
    updatedAt: string;
    year: number | null;
  };
  relationships: {
    id: string;
    type: string;
    attributes?: { name?: string; fileName?: string };
  }[];
}

interface MangaDexChapter {
  id: string;
  type: 'chapter';
  attributes: {
    title: string | null;
    volume: string | null;
    chapter: string | null;
    pages: number;
    publishAt: string;
    createdAt: string;
  };
  relationships: { id: string; type: string }[];
}

interface MangaDexListResponse {
  data: MangaDexManga[];
  total: number;
  limit: number;
  offset: number;
}

interface MangaDexChapterResponse {
  data: MangaDexChapter[];
  total: number;
  limit: number;
  offset: number;
}

interface MangaDexPagesResponse {
  chapter: { hash: string; data: string[]; dataSaver: string[] };
  baseUrl: string;
}

// ─── MangaDex API Methods ────────────────────────────

export const mangadex = {
  /**
   * Fetch popular/trending manga from MangaDex.
   */
  async getPopular(limit = 20, offset = 0) {
    return rateLimitedRequest<MangaDexListResponse>(
      `/manga?limit=${limit}&offset=${offset}&order[followedCount]=desc&availableTranslatedLanguage[]=en&contentRating[]=safe&contentRating[]=suggestive&includes[]=cover_art`,
    );
  },

  /**
   * Fetch latest updated manga.
   */
  async getLatest(limit = 20, offset = 0) {
    return rateLimitedRequest<MangaDexListResponse>(
      `/manga?limit=${limit}&offset=${offset}&order[updatedAt]=desc&availableTranslatedLanguage[]=en&contentRating[]=safe&contentRating[]=suggestive&includes[]=cover_art`,
    );
  },

  /**
   * Search manga by title.
   */
  async search(query: string, limit = 20, offset = 0) {
    return rateLimitedRequest<MangaDexListResponse>(
      `/manga?limit=${limit}&offset=${offset}&title=${encodeURIComponent(query)}&order[relevance]=desc&availableTranslatedLanguage[]=en&contentRating[]=safe&contentRating[]=suggestive&includes[]=cover_art`,
    );
  },

  /**
   * Get a single manga by ID.
   */
  async getManga(id: string) {
    return rateLimitedRequest<{ data: MangaDexManga }>(
      `/manga/${id}?includes[]=cover_art&includes[]=author&includes[]=artist`,
    );
  },

  /**
   * Get chapters for a manga.
   */
  async getChapters(mangaId: string, limit = 100, offset = 0) {
    return rateLimitedRequest<MangaDexChapterResponse>(
      `/manga/${mangaId}/feed?limit=${limit}&offset=${offset}&translatedLanguage[]=en&order[chapter]=desc&contentRating[]=safe&contentRating[]=suggestive`,
    );
  },

  /**
   * Get page URLs for a chapter.
   * Returns full image URLs using the base URL and chapter hash.
   */
  async getChapterPages(chapterId: string) {
    return rateLimitedRequest<MangaDexPagesResponse>(
      `/at-home/server/${chapterId}`,
    );
  },

  /**
   * Build full image URLs for a MangaDex chapter.
   * @returns Array of full page image URLs
   */
  async getChapterPageUrls(chapterId: string, dataSaver = false): Promise<string[]> {
    const pagesData = await this.getChapterPages(chapterId);
    const { baseUrl, chapter } = pagesData;
    const hash = chapter.hash;
    const pageList = dataSaver ? chapter.dataSaver : chapter.data;
    const qualityPath = dataSaver ? 'data-saver' : 'data';
    return pageList.map((page) => `${baseUrl}/${qualityPath}/${hash}/${page}`);
  },

  /**
   * Build a cover image URL from manga relationships.
   */
  getCoverUrl(manga: MangaDexManga): string | null {
    const coverRel = manga.relationships.find((r) => r.type === 'cover_art');
    if (!coverRel?.attributes?.fileName) return null;
    return `${config.mangadex.coverUrl}/${manga.id}/${coverRel.attributes.fileName}.512.jpg`;
  },

  /**
   * Extract author name from manga relationships.
   */
  getAuthor(manga: MangaDexManga): string | null {
    const authorRel = manga.relationships.find((r) => r.type === 'author');
    return authorRel?.attributes?.name ?? null;
  },

  /**
   * Extract artist name from manga relationships.
   */
  getArtist(manga: MangaDexManga): string | null {
    const artistRel = manga.relationships.find((r) => r.type === 'artist');
    return artistRel?.attributes?.name ?? null;
  },

  /**
   * Normalize MangaDex manga to our Title schema.
   */
  normalizeTitle(manga: MangaDexManga) {
    const title = manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown';
    const altTitles = manga.attributes.altTitles
      .flatMap((t) => Object.values(t))
      .filter(Boolean);
    const synopsis = manga.attributes.description.en || '';
    const genres = manga.attributes.tags
      .filter((t) => t.attributes.group === 'genre')
      .map((t) => t.attributes.name.en?.toLowerCase().replace(/\s+/g, '_') || 'unknown');

    return {
      slug: title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim(),
      title,
      alternativeTitles: altTitles.length > 0 ? altTitles.join(', ') : null,
      type: 'manga',
      status: manga.attributes.status || 'ongoing',
      genres,
      tags: manga.attributes.tags.map((t) => t.attributes.name.en || t.attributes.name.en).filter(Boolean),
      author: this.getAuthor(manga),
      artist: this.getArtist(manga),
      coverUrl: this.getCoverUrl(manga),
      synopsis: synopsis || null,
      totalChapters: null,
      releaseYear: manga.attributes.year || null,
    };
  },
};

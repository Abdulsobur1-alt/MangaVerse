import { config } from '../config/index.js';

// Use dynamic import for ESM compatibility in type: "module" project
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let MeiliSearch: any;
try {
  // Dynamic import handles ESM modules even in a CommonJS-type context
  const mod = await import('meilisearch');
  MeiliSearch = (mod as any).default || mod;
} catch (err) {
  console.warn('⚠️  Meilisearch not available:', err instanceof Error ? err.message : 'unknown error');
}

let client: any = null;

if (MeiliSearch) {
  try {
    client = new MeiliSearch({
      host: config.meilisearch.host,
      apiKey: config.meilisearch.apiKey || undefined,
    });
  } catch {
    console.warn('⚠️  Failed to connect to Meilisearch — search will use database fallback');
  }
}

const INDEX_NAME = config.meilisearch.indexName;

interface SearchableTitle {
  id: string;
  slug: string;
  title: string;
  alternativeTitles?: string | null;
  type: string;
  genres: string[];
  tags: string[];
  author: string | null;
  artist: string | null;
  synopsis: string | null;
  rating: number | null;
  totalChapters: number | null;
  coverUrl: string | null;
  status: string;
}

export const meilisearch = {
  async initIndex(): Promise<void> {
    if (!client) return;
    try {
      const index = client.index(INDEX_NAME);
      await index.updateSearchableAttributes([
        'title', 'alternativeTitles', 'author', 'artist', 'synopsis', 'genres', 'tags',
      ]);
      await index.updateFilterableAttributes(['type', 'status', 'genres', 'author']);
      await index.updateSortableAttributes(['rating', 'totalChapters']);
      console.log('✅ Meilisearch index configured');
    } catch (err) {
      console.warn('⚠️  Failed to configure Meilisearch index:', (err as Error).message);
    }
  },

  async upsertTitle(title: SearchableTitle): Promise<void> {
    if (!client) return;
    try {
      await client.index(INDEX_NAME).addDocuments([title], { primaryKey: 'id' });
    } catch { /* silently fail */ }
  },

  async bulkUpsert(titles: SearchableTitle[]): Promise<void> {
    if (!client) return;
    try {
      await client.index(INDEX_NAME).addDocuments(titles, { primaryKey: 'id' });
    } catch { /* silently fail */ }
  },

  async removeTitle(id: string): Promise<void> {
    if (!client) return;
    try {
      await client.index(INDEX_NAME).deleteDocument(id);
    } catch { /* silently fail */ }
  },

  async search(query: string, options?: {
    limit?: number;
    offset?: number;
    genres?: string[];
    type?: string;
    status?: string;
  }): Promise<{ hits: SearchableTitle[]; total: number }> {
    if (!client) return { hits: [], total: 0 };

    try {
      const filters: string[] = [];
      if (options?.genres?.length) {
        filters.push(options.genres.map((g: string) => `genres = ${g}`).join(' AND '));
      }
      if (options?.type) filters.push(`type = "${options.type}"`);
      if (options?.status) filters.push(`status = "${options.status}"`);

      const result = await client.index(INDEX_NAME).search(query, {
        limit: options?.limit || 20,
        offset: options?.offset || 0,
        filter: filters.length > 0 ? filters.join(' AND ') : undefined,
        sort: ['rating:desc'],
      });

      return {
        hits: result.hits as SearchableTitle[],
        total: result.estimatedTotalHits ?? 0,
      };
    } catch {
      return { hits: [], total: 0 };
    }
  },

  async autocomplete(query: string, limit = 8) {
    if (!client) return [];

    try {
      const result = await client.index(INDEX_NAME).search(query, {
        limit,
        attributesToRetrieve: ['slug', 'title', 'type', 'coverUrl'],
      });

      return result.hits.map((hit: Record<string, unknown>) => ({
        slug: hit.slug as string,
        title: hit.title as string,
        type: hit.type as string,
        coverUrl: (hit.coverUrl as string) || null,
      }));
    } catch {
      return [];
    }
  },

  async isHealthy(): Promise<boolean> {
    if (!client) return false;
    try {
      await client.health();
      return true;
    } catch {
      return false;
    }
  },
};

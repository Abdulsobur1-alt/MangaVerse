import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from '../config/index.js';

const http = axios.create({
  timeout: config.scraper.requestTimeout,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
});

interface ScrapedChapter {
  number: number;
  title: string | undefined;
  url: string;
  date: string | undefined;
}

interface ScrapedTitle {
  title: string;
  author: string | undefined;
  artist: string | undefined;
  synopsis: string | undefined;
  coverUrl: string | undefined;
  status: string | undefined;
  genres: string[];
  chapters: ScrapedChapter[];
}

export const scraper = {
  /**
   * Scrape a manga page from a given URL using Cheerio.
   * This is a generic scraper — specific site adapters can be added.
   */
  async scrapePage(url: string): Promise<string> {
    const { data } = await http.get(url);
    return data;
  },

  /**
   * Parse HTML and extract manga title info.
   * Generic parser — customize per source site.
   */
  parseMangaInfo(html: string, source: 'mangaplus' | 'custom' = 'custom'): Partial<ScrapedTitle> {
    const $ = cheerio.load(html);
    const result: Partial<ScrapedTitle> = {};

    // Generic meta tag extraction
    result.title =
      $('meta[property="og:title"]').attr('content') ||
      $('h1').first().text().trim() ||
      undefined;

    result.synopsis =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      $('.description, .synopsis, [class*="summary"]').first().text().trim() ||
      undefined;

    result.coverUrl =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('.cover img, [class*="cover"] img, [class*="thumbnail"] img').first().attr('src') ||
      undefined;

    // Extract genres from meta keywords
    const keywords = $('meta[name="keywords"]').attr('content');
    if (keywords) {
      result.genres = keywords.split(',').map((k) => k.trim().toLowerCase());
    }

    // Extract from schema.org JSON-LD if available
    const script = $('script[type="application/ld+json"]').first().html();
    if (script) {
      try {
        const json = JSON.parse(script);
        if (json.author) {
          result.author = typeof json.author === 'string' ? json.author : json.author.name;
        }
      } catch {
        // ignore malformed JSON-LD
      }
    }

    return result;
  },

  /**
   * Extract chapter list from HTML.
   */
  parseChapterList(html: string): ScrapedChapter[] {
    const $ = cheerio.load(html);
    const chapters: ScrapedChapter[] = [];

    // Look for common chapter list patterns
    $('a[href*="chapter"], tr, li, [class*="chapter"]').each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr('href') || '';

      // Try to extract chapter number from text
      const match = text.match(/(?:ch(?:apter)?\.?\s*)(\d+(?:\.\d+)?)/i);
      if (match) {
        chapters.push({
          number: parseFloat(match[1]),
          title: text.replace(/ch(?:apter)?\.?\s*\d+(?:\.\d+)?\s*[-:]\s*/i, '').trim() || undefined,
          url: href.startsWith('http') ? href : `${href}`,
          date: $(el).find('time, [datetime], .date, [class*="date"]').first().attr('datetime') || undefined,
        });
      }
    });

    return chapters.sort((a, b) => b.number - a.number);
  },

  /**
   * Validate image URLs for manga pages.
   */
  isValidImageUrl(url: string): boolean {
    if (!url) return false;
    return /\.(jpg|jpeg|png|webp|gif|avif)(\?.*)?$/i.test(url) || url.includes('/images/');
  },
};

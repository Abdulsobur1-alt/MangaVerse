import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────

export const ContentFormat = {
  MANGA: 'manga',
  MANHWA: 'manhwa',
  MANHUA: 'manhua',
  LIGHT_NOVEL: 'light_novel',
  WEBTOON: 'webtoon',
} as const;
export type ContentFormat = (typeof ContentFormat)[keyof typeof ContentFormat];

export const ContentStatus = {
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  HIATUS: 'hiatus',
  CANCELLED: 'cancelled',
} as const;
export type ContentStatus = (typeof ContentStatus)[keyof typeof ContentStatus];

export const SubscriptionTier = {
  FREE: 'free',
  PREMIUM: 'premium',
  ULTRA: 'ultra',
  CREATOR_PRO: 'creator_pro',
} as const;
export type SubscriptionTier = (typeof SubscriptionTier)[keyof typeof SubscriptionTier];

export const Genre = {
  ACTION: 'action',
  ROMANCE: 'romance',
  ISEKAI: 'isekai',
  HORROR: 'horror',
  FANTASY: 'fantasy',
  CULTIVATION: 'cultivation',
  SLICE_OF_LIFE: 'slice_of_life',
  MYSTERY: 'mystery',
  SPORTS: 'sports',
  MECHA: 'mecha',
  ECCHI: 'ecchi',
  COMEDY: 'comedy',
  DRAMA: 'drama',
  SCIFI: 'sci_fi',
  THRILLER: 'thriller',
  ADVENTURE: 'adventure',
  SUPERNATURAL: 'supernatural',
  HISTORICAL: 'historical',
  PSYCHOLOGICAL: 'psychological',
  BL: 'bl',
  GL: 'gl',
} as const;
export type Genre = (typeof Genre)[keyof typeof Genre];

// ─── Zod Schemas ──────────────────────────────────────

export const TitleSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  alternativeTitles: z.array(z.string()).optional(),
  type: z.nativeEnum(ContentFormat),
  status: z.nativeEnum(ContentStatus),
  genres: z.array(z.nativeEnum(Genre)),
  tags: z.array(z.string()).optional(),
  author: z.string().optional(),
  artist: z.string().optional(),
  coverUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional(),
  synopsis: z.string().optional(),
  rating: z.number().min(0).max(10).optional(),
  totalChapters: z.number().int().positive().optional(),
  releaseYear: z.number().int().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Title = z.infer<typeof TitleSchema>;

export const ChapterSchema = z.object({
  id: z.string().uuid(),
  titleId: z.string().uuid(),
  number: z.number().int().positive(),
  title: z.string().optional(),
  pageCount: z.number().int().positive().optional(),
  coinLocked: z.boolean().default(false),
  freeAt: z.string().datetime().optional(),
  sourceUrl: z.string().url().optional(),
  createdAt: z.string().datetime(),
});
export type Chapter = z.infer<typeof ChapterSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1).max(50),
  avatarUrl: z.string().url().optional(),
  firebaseUid: z.string().optional(),
  coinBalance: z.number().int().nonnegative().default(0),
  subscriptionTier: z.nativeEnum(SubscriptionTier).default('free'),
  streakDays: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export const BookmarkSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  titleId: z.string().uuid(),
  listName: z.string().default('Reading'),
  createdAt: z.string().datetime(),
});
export type Bookmark = z.infer<typeof BookmarkSchema>;

export const ReadingProgressSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  chapterId: z.string().uuid(),
  pageNumber: z.number().int().nonnegative().default(0),
  completed: z.boolean().default(false),
  updatedAt: z.string().datetime(),
});
export type ReadingProgress = z.infer<typeof ReadingProgressSchema>;

export const CoinTransactionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  amount: z.number().int(),
  type: z.enum(['earn', 'spend', 'purchase', 'reward', 'refund']),
  referenceId: z.string().optional(),
  description: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type CoinTransaction = z.infer<typeof CoinTransactionSchema>;

export const ReviewSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  titleId: z.string().uuid(),
  rating: z.number().min(1).max(10),
  subScores: z
    .object({
      story: z.number().min(1).max(10).optional(),
      art: z.number().min(1).max(10).optional(),
      characters: z.number().min(1).max(10).optional(),
      pacing: z.number().min(1).max(10).optional(),
      ending: z.number().min(1).max(10).optional(),
    })
    .optional(),
  body: z.string().optional(),
  helpfulCount: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Review = z.infer<typeof ReviewSchema>;

// ─── API Types ────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

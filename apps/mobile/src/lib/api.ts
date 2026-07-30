import { Platform } from 'react-native';

// Android emulator uses 10.0.2.2 for host, iOS simulator uses localhost
const API_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const API_BASE = `http://${API_HOST}:3001/api`;

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const json: ApiResponse<T> = await res.json();

  if (!json.success) {
    throw new ApiError(
      json.error?.code || 'UNKNOWN',
      json.error?.message || 'An error occurred',
      res.status,
    );
  }

  return json.data;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
};

export interface TitleItem {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: string;
  genres: string[];
  author: string | null;
  coverUrl: string | null;
  rating: number | null;
  totalChapters: number | null;
}

export interface TitleDetail extends TitleItem {
  alternativeTitles?: string | null;
  tags: string[];
  artist: string | null;
  synopsis: string | null;
  releaseYear: number | null;
  _count: { chapters: number; bookmarks: number; reviews: number };
  chapters: {
    id: string;
    number: number;
    title: string | null;
    pageCount: number | null;
    createdAt: string;
  }[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ChapterItem {
  id: string;
  number: number;
  title: string | null;
  pageCount: number | null;
  coinLocked: boolean;
  createdAt: string;
}

export interface ChapterDetail extends ChapterItem {
  series: {
    id: string;
    slug: string;
    title: string;
    coverUrl: string | null;
  };
}

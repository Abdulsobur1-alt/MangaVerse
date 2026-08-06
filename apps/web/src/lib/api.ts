'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string; details?: Record<string, string[]> };
}

class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// How long to wait for a response before giving up. Render's free tier can
// take ~1 min to wake a spun-down API instance — but an infinite spinner is
// worse than a clear error, so we cap the wait and explain what to do.
const FETCH_TIMEOUT_MS = 45_000;

async function request<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
  } catch (err) {
    // Network-level failure: server unreachable, CORS preflight rejected, or
    // our timeout fired. Browsers surface these as a bare "Failed to fetch" —
    // translate it into an actionable message.
    const timedOut = (err as { name?: string } | null)?.name === 'AbortError';
    throw new ApiError(
      'NETWORK_ERROR',
      timedOut
        ? 'The server took too long to respond. It may be waking from sleep (free tier) — try again in a minute.'
        : 'Cannot reach the server — it may be asleep (free tier) or your connection dropped. Try again in a minute.',
      0,
    );
  }

  // Read the body under the same timeout + network-error handling: a
  // connection dropped mid-response (Render spin-down, flaky networks) would
  // otherwise surface as a bare "Failed to fetch" again.
  let raw: string;
  try {
    raw = await res.text();
  } catch (err) {
    const timedOut = (err as { name?: string } | null)?.name === 'AbortError';
    throw new ApiError(
      'NETWORK_ERROR',
      timedOut
        ? 'The server took too long to respond. It may be waking from sleep (free tier) — try again in a minute.'
        : 'The connection to the server dropped while loading. Try again in a minute.',
      0,
    );
  } finally {
    clearTimeout(timeout);
  }

  // Guard against non-JSON responses (proxy 404s, HTML error pages, timeouts)
  // — res.json() would throw a confusing SyntaxError.
  let json: ApiResponse<T>;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ApiError(
      'INVALID_RESPONSE',
      res.ok ? 'Unexpected response from server' : `Request failed (${res.status})`,
      res.status,
    );
  }

  if (!json.success) {
    throw new ApiError(
      json.error?.code || 'UNKNOWN',
      json.error?.message || 'An error occurred',
      res.status,
      json.error?.details,
    );
  }

  return json.data;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

export { ApiError };
export type { ApiResponse };

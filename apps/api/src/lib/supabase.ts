import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../config/index.js';

// ─── Supabase Auth verification ───────────────────────
// The API verifies Supabase access tokens (JWTs) locally against the
// project's published JWKS — no per-request network calls. Keys are
// fetched lazily and cached by jose; an unknown `kid` triggers a single
// re-fetch, so key rotation is handled transparently.
//
// Client-side signup/sign-in happens in the web/mobile apps via the
// public GoTrue REST endpoints (anon key only). This module only ever
// sees the resulting access token.

interface SupabaseAuth {
  uid: string;
  email: string | null;
  displayName: string | null;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksForUrl: string | null = null;

/** Whether Supabase auth is configured (a project URL is present). */
export function supabaseConfigured(): boolean {
  return config.supabase.url.length > 0;
}

function getJwks(): ReturnType<typeof createRemoteJWKSet> | null {
  if (!supabaseConfigured()) return null;
  const url = `${config.supabase.url.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`;
  if (!jwks || jwksForUrl !== url) {
    jwksForUrl = url;
    jwks = createRemoteJWKSet(new URL(url));
  }
  return jwks;
}

/**
 * Verify a Supabase access token and return its claims.
 * Returns null when verification fails or Supabase is unconfigured.
 */
export async function verifySupabaseToken(token: string): Promise<SupabaseAuth | null> {
  const keys = getJwks();
  if (!keys) return null;
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: `${config.supabase.url.replace(/\/+$/, '')}/auth/v1`,
      audience: 'authenticated',
    });
    if (!payload.sub) return null;
    const meta = (payload.user_metadata ?? {}) as Record<string, unknown>;
    return {
      uid: payload.sub,
      email: (payload.email as string) || null,
      displayName: (meta.display_name as string) || (payload.name as string) || null,
    };
  } catch {
    return null;
  }
}

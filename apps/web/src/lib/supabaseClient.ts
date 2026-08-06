'use client';

// ─── Supabase Auth via GoTrue REST API ─────
// Sign-in/sign-up for email+password using Supabase's public GoTrue
// endpoints. Uses the anon key only (safe to expose client-side). Keeps
// both web and mobile on the same lightweight flow without adding the
// Supabase JS SDK.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export function supabaseAuthConfigured(): boolean {
  return SUPABASE_URL.length > 0 && ANON_KEY.length > 0;
}

interface SupabaseAuthResponse {
  access_token?: string;
  user?: { id?: string; email?: string | null; user_metadata?: Record<string, unknown> };
  error?: { message?: string } | string;
  error_description?: string;
  msg?: string;
}

function errorMessage(json: SupabaseAuthResponse): string {
  if (typeof json.error === 'string') return json.error;
  return (
    json.error?.message ||
    json.msg ||
    json.error_description ||
    'Supabase authentication failed'
  );
}

async function supabaseRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!supabaseAuthConfigured()) {
    throw new Error(
      'Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing)',
    );
  }

  // Bound the call and translate network-level failures. Browsers surface a
  // wrong/blocked SUPABASE_URL (typo, http:// mixed content, CORS rejection,
  // paused project) as a bare "Failed to fetch" — confusing. A 20s cap is
  // plenty for GoTrue; config problems fail fast instead of spinning.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1${path}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // Network-level failure: wrong/blocked SUPABASE_URL (typo, http:// mixed
    // content, CORS rejection, paused project). Browsers surface these as a
    // bare "Failed to fetch" — translate into an actionable message.
    const timedOut = (err as { name?: string } | null)?.name === 'AbortError';
    throw new Error(
      timedOut
        ? 'Supabase took too long to respond. Check NEXT_PUBLIC_SUPABASE_URL and try again.'
        : 'Cannot reach Supabase — check that NEXT_PUBLIC_SUPABASE_URL is correct and the project is active.',
    );
  }

  // Read the body under the same timeout (a connection dropped mid-response
  // would otherwise hang or surface as a bare "Failed to fetch" again).
  let json: SupabaseAuthResponse & T;
  try {
    json = (await res.json()) as SupabaseAuthResponse & T;
  } catch (err) {
    const timedOut = (err as { name?: string } | null)?.name === 'AbortError';
    if (timedOut) {
      throw new Error('Supabase took too long to respond. Check NEXT_PUBLIC_SUPABASE_URL and try again.');
    }
    throw new Error('Supabase returned an invalid response');
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok || json.error) {
    throw new Error(errorMessage(json));
  }
  return json;
}

/** Sign in with email + password → returns the Supabase access token (JWT). */
export async function supabaseSignIn(email: string, password: string): Promise<string> {
  const data = await supabaseRequest<SupabaseAuthResponse>('/token?grant_type=password', {
    email,
    password,
  });
  if (!data.access_token) {
    throw new Error('Sign-in succeeded but no session was returned');
  }
  return data.access_token;
}

/**
 * Create a Supabase account (email + password), storing the display name in
 * user_metadata.
 *
 * Returns the access token when email confirmation is disabled. When
 * confirmation is required it returns null (a follow-up sign-in then acts as
 * the confirmation gate). A 200 response with no `user` means the email is
 * already registered (GoTrue hides this under email-enumeration protection),
 * so that's surfaced as an explicit error.
 */
export async function supabaseSignUp(
  email: string,
  password: string,
  displayName: string,
): Promise<string | null> {
  const data = await supabaseRequest<SupabaseAuthResponse>('/signup', {
    email,
    password,
    data: { display_name: displayName },
  });
  if (data.access_token) return data.access_token;
  if (!data.user) {
    throw new Error('That email is already registered — sign in instead.');
  }
  return null;
}

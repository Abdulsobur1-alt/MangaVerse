'use client';

// ─── Supabase Auth via GoTrue REST API ─────
// Sign-in/sign-up for email+password using Supabase's public GoTrue
// endpoints. Uses the anon key only (safe to expose client-side). Keeps
// both web and mobile on the same lightweight flow without adding the
// Supabase JS SDK.

// Accept the plain project URL (https://<ref>.supabase.co). The dashboard's
// "API URL" field includes /rest/v1 — normalize it away so a copy-paste
// can't turn every auth call into /rest/v1/auth/v1/... 404s.
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '');
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export function supabaseAuthConfigured(): boolean {
  return SUPABASE_URL.length > 0 && ANON_KEY.length > 0;
}

interface SupabaseAuthResponse {
  access_token?: string;
  user?: { id?: string; email?: string | null; user_metadata?: Record<string, unknown> };
  error?: { message?: string; code?: string } | string;
  error_code?: string;
  error_description?: string;
  msg?: string;
}

// GoTrue returns machine-readable codes alongside its messages
// (e.g. {"code":400,"error_code":"invalid_credentials","msg":"Invalid login credentials"}).
// Map the codes users actually hit to messages that say what to DO.
const GO_TRUE_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed: 'Please confirm your email first, then sign in.',
  email_exists: 'An account with this email already exists — sign in instead.',
  user_already_exists: 'An account with this email already exists — sign in instead.',
  weak_password: 'That password is too weak (minimum 8 characters).',
  signup_disabled: 'Sign-ups are currently disabled.',
  captcha_failed: 'Could not verify you are human — please try again.',
  captcha_invalid: 'Could not verify you are human — please try again.',
  over_request_rate_limit: 'Too many attempts — please wait a minute and try again.',
  invalid_jwt: 'Your session has expired — please sign in again.',
};

function errorMessage(json: SupabaseAuthResponse): string {
  if (typeof json.error === 'string') return json.error;
  const raw =
    json.error?.message ||
    json.msg ||
    json.error_description ||
    'Supabase authentication failed';
  // Prefer the friendly mapping when we recognize the code; otherwise fall
  // back to the raw (already human-readable) GoTrue message.
  const code = json.error_code || (typeof json.error === 'object' ? json.error?.code : undefined);
  if (code && GO_TRUE_ERROR_MESSAGES[code]) return GO_TRUE_ERROR_MESSAGES[code];
  return raw;
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

/**
 * Send a password-reset email for the given account.
 *
 * GoTrue deliberately answers 200 with an empty body even when the email is
 * unknown (email-enumeration protection), so the UI should show the generic
 * "if an account exists…" message on success.
 *
 * Note: the reset link in the email points at Supabase's configured Site URL
 * (Auth → URL Configuration). Make sure it's the production web origin, or
 * the link lands on the default http://localhost:3000.
 */
export async function supabaseResetPassword(email: string): Promise<void> {
  await supabaseRequest<SupabaseAuthResponse>('/recover', { email });
}

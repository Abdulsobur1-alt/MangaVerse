import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

function stubGoTrueResponse(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  );
}

describe('supabaseClient GoTrue error mapping', () => {
  beforeEach(() => {
    vi.resetModules(); // the module caches env consts at import time
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps invalid_credentials to a friendly message', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    const { supabaseSignIn } = await import('./supabaseClient');
    stubGoTrueResponse(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });

    await expect(supabaseSignIn('a@b.com', 'nope')).rejects.toThrow('Incorrect email or password.');
  });

  it('maps email_not_confirmed to a confirmation prompt', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    const { supabaseSignIn } = await import('./supabaseClient');
    stubGoTrueResponse(400, { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' });

    await expect(supabaseSignIn('a@b.com', 'x')).rejects.toThrow(
      'Please confirm your email first, then sign in.',
    );
  });

  it('falls back to the raw GoTrue message for unknown codes', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    const { supabaseSignIn } = await import('./supabaseClient');
    stubGoTrueResponse(400, { code: 400, error_code: 'some_weird_code', msg: 'Something odd happened' });

    await expect(supabaseSignIn('a@b.com', 'x')).rejects.toThrow('Something odd happened');
  });

  it('throws an actionable config error when Supabase env is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const { supabaseSignIn } = await import('./supabaseClient');

    await expect(supabaseSignIn('a@b.com', 'x')).rejects.toThrow('Supabase is not configured');
  });

  it('passes the email through to /auth/v1/token on success', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    const { supabaseSignIn } = await import('./supabaseClient');
    const access_token = 'jwt.access.token';
    stubGoTrueResponse(200, { access_token, user: { id: 'u1' } });

    await expect(supabaseSignIn('me@example.com', 'pw')).resolves.toBe(access_token);

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/v1/token?grant_type=password');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'me@example.com', password: 'pw' });
  });
});

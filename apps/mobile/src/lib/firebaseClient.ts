// ─── Firebase Auth via Identity Toolkit REST API ─────
// Same lightweight REST flow as the web app — no native SDK needed, so the
// Expo build stays managed-workflow compatible.

const API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '';
const AUTH_BASE = 'https://identitytoolkit.googleapis.com/v1';

export function firebaseAuthConfigured(): boolean {
  return API_KEY.length > 0;
}

interface FirebaseAuthResponse {
  idToken: string;
  email?: string;
  localId?: string;
  displayName?: string;
  error?: { message: string };
}

async function firebaseRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!API_KEY) {
    throw new Error('Firebase is not configured (EXPO_PUBLIC_FIREBASE_API_KEY missing)');
  }

  const res = await fetch(`${AUTH_BASE}/${path}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as FirebaseAuthResponse & T;
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || 'Firebase authentication failed');
  }
  return json;
}

/** Sign in with email + password, returns the Firebase ID token. */
export async function firebaseSignIn(email: string, password: string): Promise<string> {
  const data = await firebaseRequest<FirebaseAuthResponse>('accounts:signInWithPassword', {
    email,
    password,
    returnSecureToken: true,
  });
  return data.idToken;
}

/** Create a Firebase account (email + password), then set the display name. */
export async function firebaseSignUp(
  email: string,
  password: string,
  displayName: string,
): Promise<string> {
  const data = await firebaseRequest<FirebaseAuthResponse>('accounts:signUp', {
    email,
    password,
    returnSecureToken: true,
  });

  // Set the display name on the freshly created account (best-effort)
  try {
    await firebaseRequest<FirebaseAuthResponse>('accounts:update', {
      idToken: data.idToken,
      displayName,
    });
  } catch {
    // Non-fatal — the DB user row will carry the display name anyway
  }

  return data.idToken;
}

import admin from 'firebase-admin';

// ─── Firebase Admin init ──────────────────────────────
// Reads service-account credentials from env. Supports two layouts:
//   1. FIREBASE_SERVICE_ACCOUNT  — full JSON of the service-account key file
//   2. GOOGLE_APPLICATION_CREDENTIALS — path to the JSON key file (default)
//
// In development with no credentials present, this module exports a stub that
// reports auth as unconfigured — the dev_ token flow in middleware/auth.ts
// still works for local development.

interface FirebaseAuth {
  verifyIdToken(token: string): Promise<{ uid: string; email: string | null; name: string | null }>;
}

let auth: FirebaseAuth | null = null;

function initFirebase(): FirebaseAuth | null {
  try {
    if (admin.apps.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return admin.auth() as unknown as FirebaseAuth;
    }

    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    let credential: admin.ServiceAccount | undefined;

    if (raw) {
      try {
        credential = JSON.parse(raw) as admin.ServiceAccount;
      } catch {
        console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT is not valid JSON — falling back to GOOGLE_APPLICATION_CREDENTIALS');
      }
    }

    if (!credential && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.warn('⚠️  Firebase credentials not configured — auth verification disabled (dev mode only)');
      return null;
    }

    admin.initializeApp(
      credential
        ? { credential: admin.credential.cert(credential) }
        : { credential: admin.credential.applicationDefault() },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return admin.auth() as unknown as FirebaseAuth;
  } catch (err) {
    console.warn('⚠️  Firebase init failed — auth verification disabled:', (err as Error).message);
    return null;
  }
}

auth = initFirebase();

export function firebaseConfigured(): boolean {
  return auth !== null;
}

/**
 * Verify a Firebase ID token and return the decoded claims.
 * Returns null when verification fails or Firebase is unconfigured.
 */
export async function verifyFirebaseToken(token: string): Promise<{
  uid: string;
  email: string | null;
  name: string | null;
} | null> {
  if (!auth) return null;
  try {
    const decoded = await auth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || null,
    };
  } catch {
    return null;
  }
}

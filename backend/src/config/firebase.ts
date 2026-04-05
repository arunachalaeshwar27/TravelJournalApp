/**
 * Firebase Admin SDK — singleton initialisation
 *
 * WHY Firebase over pure Node+PostgreSQL for a 48h assignment?
 * ─────────────────────────────────────────────────────────────
 * 1. Auth is free & instant — Google Sign-In verified server-side in 1 line
 * 2. Firestore syncs natively with offline-first clients
 * 3. Storage built-in — no separate S3/Cloudinary setup
 * 4. Real-time listeners are free (vs setting up WebSocket infra)
 * 5. Free Spark plan covers ~50K reads/20K writes per day
 *
 * Trade-offs vs Node+PG:
 * ─────────────────────
 * - Less SQL power (no complex JOINs) → handled with denormalisation
 * - Proximity queries need client-side Haversine (Firestore has no geo index)
 * - Full-text search needs Algolia/ElasticSearch — we use Firestore array-contains for MVP
 */

import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let app: admin.app.App;

export function initFirebase(): admin.app.App {
  if (admin.apps.length > 0) {
    app = admin.apps[0]!;
    return app;
  }

  const credential = admin.credential.cert({
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
  } as any);

  app = admin.initializeApp({
    credential,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });

  console.log('✅ Firebase Admin initialised — project:', process.env.FIREBASE_PROJECT_ID);
  return app;
}

export function getFirestore(): admin.firestore.Firestore {
  return admin.firestore();
}

export function getStorage(): admin.storage.Storage {
  return admin.storage();
}

export function getAuth(): admin.auth.Auth {
  return admin.auth();
}

// ─── Firestore collection references ─────────────────────────────
export const COLLECTIONS = {
  USERS: 'users',
  ENTRIES: 'journalEntries',
} as const;

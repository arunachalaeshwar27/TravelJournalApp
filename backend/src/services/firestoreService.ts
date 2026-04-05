/**
 * Firestore Service — All DB operations
 *
 * Firestore Data Model:
 * ─────────────────────
 * /users/{userId}
 *   id, email, name, photoUrl, provider, createdAt, updatedAt
 *
 * /journalEntries/{entryId}
 *   id, userId, title, description, photos[], location,
 *   tags[], createdAt, updatedAt, isDeleted, syncStatus
 *
 * WHY single flat collection instead of /users/{uid}/entries/{id}?
 * ─────────────────────────────────────────────────────────────────
 * - Easier global queries (admin dashboard, analytics)
 * - Simpler security rules (userId field filter)
 * - Firestore charges per document read, not per query depth
 * - Sub-collections add complexity for cross-user features
 */

import * as admin from 'firebase-admin';
import { getFirestore, COLLECTIONS } from '../config/firebase';
import { JournalEntry, UserProfile, SearchQuery } from '../models/types';
import { logger } from '../config/logger';

// ─── User operations ──────────────────────────────────────────────

export async function upsertUser(profile: UserProfile): Promise<void> {
  const db = getFirestore();
  await db.collection(COLLECTIONS.USERS).doc(profile.id).set(profile, { merge: true });
  logger.debug('User upserted', { userId: profile.id });
}

export async function getUserById(userId: string): Promise<UserProfile | null> {
  const db = getFirestore();
  const doc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
  return doc.exists ? (doc.data() as UserProfile) : null;
}

// ─── Entry CRUD ───────────────────────────────────────────────────

export async function createEntry(entry: JournalEntry): Promise<JournalEntry> {
  const db = getFirestore();
  const synced: JournalEntry = { ...entry, syncStatus: 'synced' };
  await db.collection(COLLECTIONS.ENTRIES).doc(entry.id).set(synced);
  logger.debug('Entry created', { entryId: entry.id, userId: entry.userId });
  return synced;
}

export async function getEntryById(entryId: string): Promise<JournalEntry | null> {
  const db = getFirestore();
  const doc = await db.collection(COLLECTIONS.ENTRIES).doc(entryId).get();
  return doc.exists ? (doc.data() as JournalEntry) : null;
}

export async function updateEntry(
  entryId: string,
  updates: Partial<JournalEntry>,
): Promise<JournalEntry> {
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.ENTRIES).doc(entryId);
  const payload = { ...updates, syncStatus: 'synced', updatedAt: new Date().toISOString() };
  await ref.update(payload);
  const updated = await ref.get();
  return updated.data() as JournalEntry;
}

export async function softDeleteEntry(entryId: string, userId: string): Promise<void> {
  const db = getFirestore();
  await db.collection(COLLECTIONS.ENTRIES).doc(entryId).update({
    isDeleted: true,
    syncStatus: 'synced',
    updatedAt: new Date().toISOString(),
    userId, // ensure ownership preserved
  });
  logger.debug('Entry soft-deleted', { entryId });
}

export async function getEntriesByUser(userId: string): Promise<JournalEntry[]> {
  const db = getFirestore();
  const snapshot = await db
    .collection(COLLECTIONS.ENTRIES)
    .where('userId', '==', userId)
    .where('isDeleted', '==', false)
    .orderBy('updatedAt', 'desc')
    .get();

  return snapshot.docs.map(d => d.data() as JournalEntry);
}

/**
 * Get entries updated after a given timestamp.
 * Core of the sync pull phase — returns ONLY changed documents.
 */
export async function getEntriesUpdatedSince(
  userId: string,
  since: string,
): Promise<JournalEntry[]> {
  const db = getFirestore();
  const snapshot = await db
    .collection(COLLECTIONS.ENTRIES)
    .where('userId', '==', userId)
    .where('updatedAt', '>', since)
    .orderBy('updatedAt', 'asc')
    .get();

  return snapshot.docs.map(d => d.data() as JournalEntry);
}

// ─── Search & Filters ─────────────────────────────────────────────

/**
 * Firestore search limitations:
 * - No native full-text search (use Algolia in production)
 * - array-contains for single tag, array-contains-any for multiple (OR logic)
 * - Date range requires composite index on (userId, createdAt)
 * - Proximity: fetch all + client-side Haversine (Firestore has no geo-query)
 *
 * For MVP: tag + date filters in Firestore, text + proximity in memory
 */
export async function searchEntries(
  userId: string,
  query: SearchQuery,
): Promise<JournalEntry[]> {
  const db = getFirestore();
  let firestoreQuery: admin.firestore.Query = db
    .collection(COLLECTIONS.ENTRIES)
    .where('userId', '==', userId)
    .where('isDeleted', '==', false);

  // Tag filter — Firestore supports array-contains for ONE tag
  if (query.tags && query.tags.length === 1) {
    firestoreQuery = firestoreQuery.where('tags', 'array-contains', query.tags[0]);
  }

  // Date range filter
  if (query.dateFrom) {
    firestoreQuery = firestoreQuery.where('createdAt', '>=', query.dateFrom);
  }
  if (query.dateTo) {
    firestoreQuery = firestoreQuery.where('createdAt', '<=', query.dateTo);
  }

  firestoreQuery = firestoreQuery.orderBy('createdAt', 'desc').limit(query.limit ?? 50);

  const snapshot = await firestoreQuery.get();
  let results = snapshot.docs.map(d => d.data() as JournalEntry);

  // ── Client-side filters (what Firestore can't do) ────────────────

  // Full-text search on title + description
  if (query.q) {
    const q = query.q.toLowerCase();
    results = results.filter(
      e =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q)),
    );
  }

  // Multiple tag filter (AND logic — all tags must match)
  if (query.tags && query.tags.length > 1) {
    results = results.filter(e => query.tags!.every(t => e.tags.includes(t)));
  }

  // Proximity filter (Haversine)
  if (query.lat != null && query.lng != null && query.radiusKm) {
    results = results.filter(e => {
      if (!e.location) return false;
      return haversineKm(
        { lat: query.lat!, lng: query.lng! },
        { lat: e.location.latitude, lng: e.location.longitude },
      ) <= query.radiusKm!;
    });
  }

  return results;
}

// ─── Haversine distance helper ────────────────────────────────────

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(b.lng - a.lng) / 2;
  const chord =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLon * sinDLon;
  return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

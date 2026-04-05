/**
 * Offline Sync Service — THE most interview-critical piece
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              SYNC STRATEGY: Last-Write-Wins (LWW)           ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║                                                              ║
 * ║  Client sends:                                               ║
 * ║    { lastSyncAt: "2024-01-10T10:00:00Z",                    ║
 * ║      entries: [locally mutated JournalEntry[]] }             ║
 * ║                                                              ║
 * ║  Server does:                                                ║
 * ║    PUSH phase:                                               ║
 * ║      for each client entry:                                  ║
 * ║        if NOT in DB → create                                 ║
 * ║        if IN DB && client.updatedAt > server.updatedAt       ║
 * ║            → client wins  → update DB                       ║
 * ║        if IN DB && client.updatedAt < server.updatedAt       ║
 * ║            → server wins  → report as conflict               ║
 * ║        if client.isDeleted == true → soft-delete (always)    ║
 * ║                                                              ║
 * ║    PULL phase:                                               ║
 * ║      fetch all server entries where updatedAt > lastSyncAt   ║
 * ║      return them to client to merge into local DB            ║
 * ║                                                              ║
 * ║  Conflict edge cases:                                        ║
 * ║    1. Same entry edited on 2 devices simultaneously          ║
 * ║       → LWW: higher updatedAt wins                          ║
 * ║    2. Entry deleted on server, edited on client              ║
 * ║       → deletion always wins (isDeleted takes priority)      ║
 * ║    3. Network split-brain (client re-sends old version)      ║
 * ║       → idempotent: duplicate sync is safe (upsert by id)   ║
 * ║    4. Clock skew between devices                             ║
 * ║       → server timestamp used for pull phase                ║
 * ║                                                              ║
 * ║  Production upgrade path:                                    ║
 * ║    → Vector clocks for per-field merge (Operational CRDT)    ║
 * ║    → Automerge / Yjs for collaborative real-time editing     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { getFirestore, COLLECTIONS } from '../config/firebase';
import {
  JournalEntry,
  SyncRequest,
  SyncResponse,
  ConflictResult,
} from '../models/types';
import { logger } from '../config/logger';

export async function processSync(
  userId: string,
  syncRequest: SyncRequest,
): Promise<SyncResponse> {
  const syncedAt = new Date().toISOString();
  const conflicts: ConflictResult[] = [];
  const db = getFirestore();

  // ── PUSH PHASE: process client entries ────────────────────────

  const pushPromises = syncRequest.entries.map(async clientEntry => {
    if (clientEntry.userId !== userId) {
      // Security: silently ignore entries belonging to other users
      logger.warn('Cross-user entry rejected', {
        entryUserId: clientEntry.userId,
        requestUserId: userId,
      });
      return;
    }

    const serverDoc = await db
      .collection(COLLECTIONS.ENTRIES)
      .doc(clientEntry.id)
      .get();

    // ── Case 1: New entry (doesn't exist on server) ─────────────
    if (!serverDoc.exists) {
      await db
        .collection(COLLECTIONS.ENTRIES)
        .doc(clientEntry.id)
        .set({ ...clientEntry, syncStatus: 'synced' });
      logger.debug('Sync: new entry created', { entryId: clientEntry.id });
      return;
    }

    const serverEntry = serverDoc.data() as JournalEntry;

    // ── Case 2: Deletion always wins ────────────────────────────
    if (clientEntry.isDeleted) {
      await db.collection(COLLECTIONS.ENTRIES).doc(clientEntry.id).update({
        isDeleted: true,
        updatedAt: clientEntry.updatedAt,
        syncStatus: 'synced',
      });
      logger.debug('Sync: entry soft-deleted', { entryId: clientEntry.id });
      return;
    }

    // ── Case 3: Server was already soft-deleted ─────────────────
    if (serverEntry.isDeleted) {
      conflicts.push({
        entryId: clientEntry.id,
        winner: 'server',
        winningEntry: serverEntry,
        reason: 'Entry was deleted on server — deletion wins',
      });
      return;
    }

    // ── Case 4: LWW — compare updatedAt timestamps ──────────────
    const clientTime = new Date(clientEntry.updatedAt).getTime();
    const serverTime = new Date(serverEntry.updatedAt).getTime();

    if (clientTime > serverTime) {
      // Client is newer → update server
      await db
        .collection(COLLECTIONS.ENTRIES)
        .doc(clientEntry.id)
        .set({ ...clientEntry, syncStatus: 'synced' }, { merge: true });
      logger.debug('Sync: client wins (newer)', { entryId: clientEntry.id });
    } else if (clientTime < serverTime) {
      // Server is newer → report conflict (client should take server version)
      conflicts.push({
        entryId: clientEntry.id,
        winner: 'server',
        winningEntry: serverEntry,
        reason: `Server version is newer (server: ${serverEntry.updatedAt}, client: ${clientEntry.updatedAt})`,
      });
      logger.debug('Sync: server wins (newer)', { entryId: clientEntry.id });
    }
    // If timestamps are equal → idempotent, no action needed
  });

  await Promise.allSettled(pushPromises);

  // ── PULL PHASE: return server entries newer than lastSyncAt ───

  const snapshot = await db
    .collection(COLLECTIONS.ENTRIES)
    .where('userId', '==', userId)
    .where('updatedAt', '>', syncRequest.lastSyncAt)
    .orderBy('updatedAt', 'asc')
    .get();

  const updatedEntries = snapshot.docs.map(d => d.data() as JournalEntry);

  // Collect IDs that were soft-deleted on server since last sync
  const deletedIds = updatedEntries
    .filter(e => e.isDeleted)
    .map(e => e.id);

  logger.info('Sync completed', {
    userId,
    pushed: syncRequest.entries.length,
    pulled: updatedEntries.length,
    conflicts: conflicts.length,
    deletedIds: deletedIds.length,
  });

  return {
    syncedAt,
    updatedEntries,
    conflicts,
    deletedIds,
  };
}

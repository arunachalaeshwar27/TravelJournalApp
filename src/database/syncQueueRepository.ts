import { SyncQueueItem, TaggingQueueItem } from '@/types';
import { dbQuery, dbRun } from './db';

// ─── Sync Queue ───────────────────────────────────────────────────────────────

export async function enqueueSyncItem(item: Omit<SyncQueueItem, 'attempts'>): Promise<void> {
  await dbRun(
    `INSERT OR REPLACE INTO sync_queue (id, entry_id, operation, payload, created_at, attempts)
     VALUES (?,?,?,?,?,0)`,
    [item.id, item.entryId, item.operation, item.payload, item.createdAt],
  );
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  return dbQuery<SyncQueueItem>(
    `SELECT id, entry_id as entryId, operation, payload, created_at as createdAt, attempts
     FROM sync_queue ORDER BY created_at ASC`,
  );
}

export async function removeSyncItem(id: string): Promise<void> {
  await dbRun(`DELETE FROM sync_queue WHERE id = ?`, [id]);
}

export async function incrementSyncAttempts(id: string): Promise<void> {
  await dbRun(`UPDATE sync_queue SET attempts = attempts + 1 WHERE id = ?`, [id]);
}

// ─── Tagging Queue ────────────────────────────────────────────────────────────

export async function enqueueTaggingItem(item: TaggingQueueItem): Promise<void> {
  await dbRun(
    `INSERT OR IGNORE INTO tagging_queue (id, entry_id, photo_id, local_uri, attempts, created_at)
     VALUES (?,?,?,?,0,?)`,
    [item.id, item.entryId, item.photoId, item.localUri, item.createdAt],
  );
}

export async function getPendingTaggingItems(): Promise<TaggingQueueItem[]> {
  return dbQuery<TaggingQueueItem>(
    `SELECT id, entry_id as entryId, photo_id as photoId, local_uri as localUri, attempts, created_at as createdAt
     FROM tagging_queue WHERE attempts < 3 ORDER BY created_at ASC`,
  );
}

export async function removeTaggingItem(id: string): Promise<void> {
  await dbRun(`DELETE FROM tagging_queue WHERE id = ?`, [id]);
}

export async function incrementTaggingAttempts(id: string): Promise<void> {
  await dbRun(`UPDATE tagging_queue SET attempts = attempts + 1 WHERE id = ?`, [id]);
}

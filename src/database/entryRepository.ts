/**
 * Repository pattern for journal entries.
 *
 * Keeps all SQL out of components / stores.
 * Each method maps raw DB rows → typed domain objects.
 */

import { JournalEntry, JournalPhoto, SyncStatus } from '@/types';
import { dbQuery, dbRun, dbTransaction } from './db';

// ─── Row types (DB representation) ───────────────────────────────────────────

interface EntryRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  tags: string;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  accuracy: number | null;
  location_name: string | null;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  is_deleted: number;
  voice_note_uri: string | null;
  voice_note_transcript: string | null;
}

interface PhotoRow {
  id: string;
  entry_id: string;
  uri: string;
  remote_url: string | null;
  tags: string;
  tagging_status: JournalPhoto['taggingStatus'];
  photo_order: number;
  created_at: string;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function rowToEntry(row: EntryRow, photos: JournalPhoto[]): JournalEntry {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    tags: JSON.parse(row.tags),
    location:
      row.latitude != null && row.longitude != null
        ? {
            latitude: row.latitude,
            longitude: row.longitude,
            altitude: row.altitude ?? undefined,
            accuracy: row.accuracy ?? undefined,
          }
        : undefined,
    locationName: row.location_name ?? undefined,
    photos,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
    isDeleted: row.is_deleted === 1,
    voiceNoteUri: row.voice_note_uri ?? undefined,
    voiceNoteTranscript: row.voice_note_transcript ?? undefined,
  };
}

function rowToPhoto(row: PhotoRow): JournalPhoto {
  return {
    id: row.id,
    uri: row.uri,
    remoteUrl: row.remote_url ?? undefined,
    tags: JSON.parse(row.tags),
    taggingStatus: row.tagging_status,
    order: row.photo_order,
    createdAt: row.created_at,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getAllEntries(userId: string): Promise<JournalEntry[]> {
  const entryRows = await dbQuery<EntryRow>(
    `SELECT * FROM journal_entries WHERE user_id = ? AND is_deleted = 0 ORDER BY created_at DESC`,
    [userId],
  );

  const entries: JournalEntry[] = [];
  for (const row of entryRows) {
    const photos = await getPhotosForEntry(row.id);
    entries.push(rowToEntry(row, photos));
  }
  return entries;
}

export async function getEntryById(id: string): Promise<JournalEntry | null> {
  const rows = await dbQuery<EntryRow>(
    `SELECT * FROM journal_entries WHERE id = ? LIMIT 1`,
    [id],
  );
  if (!rows.length) return null;
  const photos = await getPhotosForEntry(id);
  return rowToEntry(rows[0], photos);
}

export async function upsertEntry(entry: JournalEntry): Promise<void> {
  await dbTransaction(tx => {
    tx.executeSql(
      `INSERT OR REPLACE INTO journal_entries
        (id, user_id, title, description, tags, latitude, longitude, altitude, accuracy,
         location_name, created_at, updated_at, sync_status, is_deleted, voice_note_uri, voice_note_transcript)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        entry.id,
        entry.userId,
        entry.title,
        entry.description,
        JSON.stringify(entry.tags),
        entry.location?.latitude ?? null,
        entry.location?.longitude ?? null,
        entry.location?.altitude ?? null,
        entry.location?.accuracy ?? null,
        entry.locationName ?? null,
        entry.createdAt,
        entry.updatedAt,
        entry.syncStatus,
        entry.isDeleted ? 1 : 0,
        entry.voiceNoteUri ?? null,
        entry.voiceNoteTranscript ?? null,
      ],
    );

    // Delete and re-insert photos (simpler than diff)
    tx.executeSql(`DELETE FROM entry_photos WHERE entry_id = ?`, [entry.id]);
    for (const photo of entry.photos) {
      tx.executeSql(
        `INSERT INTO entry_photos (id, entry_id, uri, remote_url, tags, tagging_status, photo_order, created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          photo.id,
          entry.id,
          photo.uri,
          photo.remoteUrl ?? null,
          JSON.stringify(photo.tags),
          photo.taggingStatus,
          photo.order,
          photo.createdAt,
        ],
      );
    }
  });

  // Queue pending photos for tagging AFTER the transaction commits.
  // Done outside the transaction to avoid any interaction with the SQLite
  // write lock that could cause the transaction promise to hang.
  for (const photo of entry.photos) {
    if (photo.taggingStatus === 'pending' || photo.taggingStatus === 'failed') {
      await dbRun(
        `INSERT OR IGNORE INTO tagging_queue (id, entry_id, photo_id, local_uri, attempts, created_at)
         VALUES (?,?,?,?,0,?)`,
        [
          `tag_${photo.id}`,
          entry.id,
          photo.id,
          photo.uri,
          new Date().toISOString(),
        ],
      );
    }
  }
}

export async function softDeleteEntry(id: string): Promise<void> {
  await dbRun(
    `UPDATE journal_entries SET is_deleted = 1, sync_status = 'local', updated_at = ? WHERE id = ?`,
    [new Date().toISOString(), id],
  );
}

export async function updateSyncStatus(id: string, status: SyncStatus): Promise<void> {
  await dbRun(
    `UPDATE journal_entries SET sync_status = ? WHERE id = ?`,
    [status, id],
  );
}

export async function getPhotosForEntry(entryId: string): Promise<JournalPhoto[]> {
  const rows = await dbQuery<PhotoRow>(
    `SELECT * FROM entry_photos WHERE entry_id = ? ORDER BY photo_order ASC`,
    [entryId],
  );
  return rows.map(rowToPhoto);
}

export async function updatePhotoTags(
  photoId: string,
  tags: string[],
  status: JournalPhoto['taggingStatus'],
): Promise<void> {
  await dbRun(
    `UPDATE entry_photos SET tags = ?, tagging_status = ? WHERE id = ?`,
    [JSON.stringify(tags), status, photoId],
  );
}

export async function searchEntries(
  userId: string,
  query: string,
): Promise<JournalEntry[]> {
  const q = `%${query}%`;
  const rows = await dbQuery<EntryRow>(
    `SELECT * FROM journal_entries
     WHERE user_id = ? AND is_deleted = 0
       AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)
     ORDER BY created_at DESC`,
    [userId, q, q, q],
  );
  const entries: JournalEntry[] = [];
  for (const row of rows) {
    const photos = await getPhotosForEntry(row.id);
    entries.push(rowToEntry(row, photos));
  }
  return entries;
}

export async function filterByDateRange(
  userId: string,
  start: string,
  end: string,
): Promise<JournalEntry[]> {
  const rows = await dbQuery<EntryRow>(
    `SELECT * FROM journal_entries
     WHERE user_id = ? AND is_deleted = 0
       AND created_at BETWEEN ? AND ?
     ORDER BY created_at DESC`,
    [userId, start, end],
  );
  const entries: JournalEntry[] = [];
  for (const row of rows) {
    const photos = await getPhotosForEntry(row.id);
    entries.push(rowToEntry(row, photos));
  }
  return entries;
}

export async function getUnsyncedEntries(userId: string): Promise<JournalEntry[]> {
  const rows = await dbQuery<EntryRow>(
    `SELECT * FROM journal_entries WHERE user_id = ? AND sync_status = 'local'`,
    [userId],
  );
  const entries: JournalEntry[] = [];
  for (const row of rows) {
    const photos = await getPhotosForEntry(row.id);
    entries.push(rowToEntry(row, photos));
  }
  return entries;
}

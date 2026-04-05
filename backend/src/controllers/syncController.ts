import { Request, Response } from 'express';
import { processSync } from '../services/syncService';
import { SyncRequest, SyncResponse, ApiResponse } from '../models/types';
import { logger } from '../config/logger';

/**
 * POST /v1/sync
 *
 * The most important endpoint — handles all offline-first sync.
 *
 * Request body:
 * {
 *   "lastSyncAt": "2024-01-10T10:00:00.000Z",  // client's last sync timestamp
 *   "entries": [JournalEntry, ...]               // locally created/updated entries
 * }
 *
 * Response:
 * {
 *   "syncedAt": "2024-01-10T11:00:00.000Z",
 *   "updatedEntries": [...],   // server entries the client needs to apply
 *   "conflicts": [...],        // entries where server won the conflict
 *   "deletedIds": [...]        // IDs soft-deleted on server since lastSyncAt
 * }
 *
 * Client-side handling:
 *   1. Apply updatedEntries to local SQLite (upsert by id)
 *   2. For conflicts: server.winningEntry replaces local version
 *   3. Remove deletedIds from local UI (keep in SQLite as isDeleted=true)
 *   4. Update lastSyncAt to syncedAt
 */
export async function syncHandler(req: Request, res: Response): Promise<void> {
  try {
    const syncRequest = req.body as SyncRequest;

    if (!syncRequest.lastSyncAt || !Array.isArray(syncRequest.entries)) {
      res.status(400).json({
        success: false,
        error: 'Invalid sync request: requires lastSyncAt and entries[]',
      } as ApiResponse);
      return;
    }

    logger.info('Sync started', {
      userId: req.user!.uid,
      entriesCount: syncRequest.entries.length,
      lastSyncAt: syncRequest.lastSyncAt,
    });

    const result = await processSync(req.user!.uid, syncRequest);

    res.json({
      success: true,
      data: result,
      message: `Sync complete. Pushed: ${syncRequest.entries.length}, Pulled: ${result.updatedEntries.length}, Conflicts: ${result.conflicts.length}`,
    } as ApiResponse<SyncResponse>);
  } catch (error) {
    logger.error('Sync failed', { error, userId: req.user?.uid });
    res.status(500).json({ success: false, error: 'Sync failed' } as ApiResponse);
  }
}

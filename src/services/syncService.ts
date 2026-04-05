/**
 * Offline Sync Engine
 *
 * Architecture (Last-Write-Wins with logical clock):
 *  1. All local mutations write to journal_entries (sync_status = 'local')
 *     AND enqueue an item to sync_queue.
 *  2. When network comes online, syncEngine() drains the sync_queue:
 *     a. PUSH local changes → Firestore / REST API
 *     b. PULL remote changes → compare updatedAt timestamps
 *     c. Conflict rule: remote.updatedAt > local.updatedAt → remote wins,
 *        unless local is is_deleted (deletion always wins)
 *  3. After successful push: update sync_status = 'synced'
 *  4. AI tagging queue is also drained on network restore
 *
 * This is a simplified LWW-Element-Set CRDT appropriate for a travel journal
 * (single-user or low-concurrency multi-device scenario).
 */

import NetInfo from '@react-native-community/netinfo';
import { apiClient } from './apiClient';
import { processPendingTaggingQueue } from './aiTaggingService';
import {
  getUnsyncedEntries,
  updateSyncStatus,
  upsertEntry,
} from '@/database/entryRepository';
import {
  enqueueSyncItem,
  getPendingSyncItems,
  removeSyncItem,
  incrementSyncAttempts,
} from '@/database/syncQueueRepository';
import { useSyncStore } from '@/store/syncStore';
import { useJournalStore } from '@/store/journalStore';
import { useAuthStore } from '@/store/authStore';
import { JournalEntry, SyncQueueItem } from '@/types';
import { generateId } from '@/utils/generateId';

let networkUnsubscribe: (() => void) | null = null;
let isSyncRunning = false;

// ─── Bootstrap ────────────────────────────────────────────────────────────────

export function startSyncEngine(): void {
  networkUnsubscribe = NetInfo.addEventListener(async state => {
    const online = state.isConnected === true && state.isInternetReachable !== false;
    useSyncStore.getState().setIsOnline(online);

    if (online && !isSyncRunning) {
      await runSyncCycle();
    }
  });
}

export function stopSyncEngine(): void {
  networkUnsubscribe?.();
  networkUnsubscribe = null;
}

// ─── Core Sync Cycle ──────────────────────────────────────────────────────────

export async function runSyncCycle(): Promise<void> {
  if (isSyncRunning) return;
  isSyncRunning = true;
  useSyncStore.getState().setIsOnline(true);
  useJournalStore.getState().setIsSyncing(true);

  try {
    await pushLocalChanges();
    await pullRemoteChanges();
    await processPendingTaggingQueue();

    useSyncStore.getState().setLastSyncAt(new Date().toISOString());
    useSyncStore.getState().setSyncError(null);
  } catch (e) {
    useSyncStore.getState().setSyncError(String(e));
  } finally {
    isSyncRunning = false;
    useJournalStore.getState().setIsSyncing(false);
    await refreshPendingCount();
  }
}

// ─── Push Phase ───────────────────────────────────────────────────────────────

async function pushLocalChanges(): Promise<void> {
  const pendingItems = await getPendingSyncItems();

  for (const item of pendingItems) {
    await incrementSyncAttempts(item.id);
    try {
      const entry: JournalEntry = JSON.parse(item.payload);
      await pushEntry(item.operation, entry);
      await removeSyncItem(item.id);
      await updateSyncStatus(item.entryId, 'synced');
    } catch {
      // Leave in queue; retry next cycle
      if (item.attempts >= 5) {
        await updateSyncStatus(item.entryId, 'error');
        await removeSyncItem(item.id);
      }
    }
  }
}

async function pushEntry(
  operation: SyncQueueItem['operation'],
  entry: JournalEntry,
): Promise<void> {
  switch (operation) {
    case 'create':
      await apiClient.post('/entries', entry);
      break;
    case 'update':
      await apiClient.put(`/entries/${entry.id}`, entry);
      break;
    case 'delete':
      await apiClient.delete(`/entries/${entry.id}`);
      break;
  }
}

// ─── Pull Phase ───────────────────────────────────────────────────────────────

async function pullRemoteChanges(): Promise<void> {
  const { user } = useAuthStore.getState();
  if (!user) return;

  const { lastSyncAt } = useSyncStore.getState();
  const since = lastSyncAt ?? '1970-01-01T00:00:00.000Z';

  interface ApiResponse<T> { success: boolean; data: T; error?: string }
  const { data: response } = await apiClient.get<ApiResponse<JournalEntry[]>>(
    `/entries?since=${encodeURIComponent(since)}`,
  );

  const remoteEntries = response.data || [];

  for (const remote of remoteEntries) {
    const { getEntryById } = await import('@/database/entryRepository');
    const local = await getEntryById(remote.id);

    if (!local) {
      // New entry from another device
      await upsertEntry({ ...remote, syncStatus: 'synced' });
    } else {
      // Conflict resolution: LWW — latest updatedAt wins
      // Exception: if local is soft-deleted, deletion wins
      if (local.isDeleted) continue;

      if (new Date(remote.updatedAt) > new Date(local.updatedAt)) {
        await upsertEntry({ ...remote, syncStatus: 'synced' });
      }
      // If local is newer: local stays, it will be pushed next cycle
    }
  }

  // Refresh store
  const entries = await (await import('@/database/entryRepository')).getAllEntries(user.id);
  useJournalStore.setState({ entries, filteredEntries: entries });
}

// ─── Enqueueing helpers (called by journal store on save/delete) ──────────────

export async function enqueueEntrySync(
  entry: JournalEntry,
  operation: SyncQueueItem['operation'],
): Promise<void> {
  const item: Omit<SyncQueueItem, 'attempts'> = {
    id: generateId(),
    entryId: entry.id,
    operation,
    payload: JSON.stringify(entry),
    createdAt: new Date().toISOString(),
  };
  await enqueueSyncItem(item);
  await refreshPendingCount();
}

async function refreshPendingCount(): Promise<void> {
  const items = await getPendingSyncItems();
  useSyncStore.getState().setPendingCount(items.length);
}

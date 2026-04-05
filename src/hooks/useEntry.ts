/**
 * useEntry — custom hook to create/update a journal entry
 * Encapsulates the full save + sync-enqueue flow.
 */

import { useCallback } from 'react';
import { JournalEntry } from '@/types';
import { useJournalStore } from '@/store/journalStore';
import { enqueueEntrySync } from '@/services/syncService';
import { useSyncStore } from '@/store/syncStore';
import { runSyncCycle } from '@/services/syncService';

export function useEntry() {
  const { saveEntry, deleteEntry } = useJournalStore();
  const { isOnline } = useSyncStore();

  const save = useCallback(
    async (entry: JournalEntry, isNew: boolean) => {
      await saveEntry(entry);
      await enqueueEntrySync(entry, isNew ? 'create' : 'update');
      if (isOnline) {
        // Fire sync but don't await — keep UI responsive
        runSyncCycle().catch(() => {});
      }
    },
    [saveEntry, isOnline],
  );

  const remove = useCallback(
    async (entry: JournalEntry) => {
      await deleteEntry(entry.id);
      await enqueueEntrySync({ ...entry, isDeleted: true }, 'delete');
      if (isOnline) {
        runSyncCycle().catch(() => {});
      }
    },
    [deleteEntry, isOnline],
  );

  return { save, remove };
}

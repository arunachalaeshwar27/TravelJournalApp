import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { JournalEntry, SearchFilters } from '@/types';
import * as repo from '@/database/entryRepository';

interface JournalStore {
  entries: JournalEntry[];
  filteredEntries: JournalEntry[];
  activeEntry: JournalEntry | null;
  filters: SearchFilters;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;

  // CRUD
  loadEntries: (userId: string) => Promise<void>;
  loadEntry: (id: string) => Promise<void>;
  saveEntry: (entry: JournalEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;

  // Filtering
  applyFilters: (filters: SearchFilters, userId: string) => Promise<void>;
  clearFilters: (userId: string) => Promise<void>;

  // Sync helpers
  setIsSyncing: (val: boolean) => void;
  refreshEntry: (id: string) => Promise<void>;
}

export const useJournalStore = create<JournalStore>()(
  immer((set, get) => ({
    entries: [],
    filteredEntries: [],
    activeEntry: null,
    filters: {},
    isLoading: false,
    isSyncing: false,
    error: null,

    loadEntries: async (userId) => {
      set(s => { s.isLoading = true; s.error = null; });
      try {
        const entries = await repo.getAllEntries(userId);
        set(s => {
          s.entries = entries;
          s.filteredEntries = entries;
          s.isLoading = false;
        });
      } catch (e) {
        set(s => { s.isLoading = false; s.error = String(e); });
      }
    },

    loadEntry: async (id) => {
      const entry = await repo.getEntryById(id);
      set(s => { s.activeEntry = entry; });
    },

    saveEntry: async (entry) => {
      await repo.upsertEntry(entry);
      set(s => {
        const idx = s.entries.findIndex(e => e.id === entry.id);
        if (idx >= 0) {
          s.entries[idx] = entry;
        } else {
          s.entries.unshift(entry);
        }
        // Re-apply current filters in memory
        s.filteredEntries = s.entries;
        if (s.activeEntry?.id === entry.id) {
          s.activeEntry = entry;
        }
      });
    },

    deleteEntry: async (id) => {
      await repo.softDeleteEntry(id);
      set(s => {
        s.entries = s.entries.filter(e => e.id !== id);
        s.filteredEntries = s.filteredEntries.filter(e => e.id !== id);
        if (s.activeEntry?.id === id) s.activeEntry = null;
      });
    },

    applyFilters: async (filters, userId) => {
      set(s => { s.filters = filters; s.isLoading = true; });
      try {
        let results: JournalEntry[] = [];

        if (filters.query) {
          results = await repo.searchEntries(userId, filters.query);
        } else if (filters.dateRange) {
          results = await repo.filterByDateRange(userId, filters.dateRange.start, filters.dateRange.end);
        } else {
          results = await repo.getAllEntries(userId);
        }

        // Client-side tag filter (SQLite LIKE on JSON string is enough for MVP)
        if (filters.tags?.length) {
          results = results.filter(e =>
            filters.tags!.every(tag => e.tags.includes(tag)),
          );
        }

        // Client-side proximity filter
        if (filters.proximityKm && filters.proximityCenter) {
          const { proximityCenter, proximityKm } = filters;
          results = results.filter(e => {
            if (!e.location) return false;
            return haversineKm(proximityCenter, e.location) <= proximityKm;
          });
        }

        set(s => { s.filteredEntries = results; s.isLoading = false; });
      } catch (e) {
        set(s => { s.isLoading = false; s.error = String(e); });
      }
    },

    clearFilters: async (userId) => {
      set(s => { s.filters = {}; });
      await get().loadEntries(userId);
    },

    setIsSyncing: (val) => set(s => { s.isSyncing = val; }),

    refreshEntry: async (id) => {
      const entry = await repo.getEntryById(id);
      if (!entry) return;
      set(s => {
        const idx = s.entries.findIndex(e => e.id === id);
        if (idx >= 0) s.entries[idx] = entry;
        if (s.activeEntry?.id === id) s.activeEntry = entry;
      });
    },
  })),
);

// ─── Haversine distance ───────────────────────────────────────────────────────

function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const dLat = deg2rad(b.latitude - a.latitude);
  const dLon = deg2rad(b.longitude - a.longitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const c =
    2 *
    Math.atan2(
      Math.sqrt(sinDLat * sinDLat + Math.cos(deg2rad(a.latitude)) * Math.cos(deg2rad(b.latitude)) * sinDLon * sinDLon),
      Math.sqrt(1 - sinDLat * sinDLat + Math.cos(deg2rad(a.latitude)) * Math.cos(deg2rad(b.latitude)) * sinDLon * sinDLon),
    );
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

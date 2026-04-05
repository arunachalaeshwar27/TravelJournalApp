// ─────────────────────────────────────────────
//  Core Domain Types
// ─────────────────────────────────────────────

export interface Coordinates {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
}

export interface JournalPhoto {
  id: string;
  uri: string;           // local file URI
  remoteUrl?: string;    // Firebase Storage URL after upload
  tags: string[];        // AI-generated tags
  taggingStatus: 'pending' | 'processing' | 'done' | 'failed';
  order: number;
  createdAt: string;     // ISO8601
}

export interface JournalEntry {
  id: string;            // UUID v4
  title: string;
  description: string;
  photos: JournalPhoto[];
  location?: Coordinates;
  locationName?: string; // Reverse-geocoded human label
  tags: string[];        // merged from all photo tags + manual
  createdAt: string;     // ISO8601
  updatedAt: string;     // ISO8601
  syncStatus: SyncStatus;
  isDeleted: boolean;    // soft-delete for offline conflict resolution
  userId: string;
  voiceNoteUri?: string;
  voiceNoteTranscript?: string;
}

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'conflict' | 'error';

// ─────────────────────────────────────────────
//  Authentication Types
// ─────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  photoUrl?: string;
  provider: 'google' | 'apple';
}

export interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

// ─────────────────────────────────────────────
//  Filter / Search Types
// ─────────────────────────────────────────────

export interface DateRange {
  start: string;   // ISO8601
  end: string;     // ISO8601
}

export interface SearchFilters {
  query?: string;
  tags?: string[];
  dateRange?: DateRange;
  proximityKm?: number;
  proximityCenter?: Coordinates;
}

// ─────────────────────────────────────────────
//  AI Tagging Queue
// ─────────────────────────────────────────────

export interface TaggingQueueItem {
  id: string;
  entryId: string;
  photoId: string;
  localUri: string;
  attempts: number;
  createdAt: string;
}

// ─────────────────────────────────────────────
//  Sync Queue
// ─────────────────────────────────────────────

export interface SyncQueueItem {
  id: string;
  entryId: string;
  operation: 'create' | 'update' | 'delete';
  payload: string;    // JSON-serialised JournalEntry
  createdAt: string;
  attempts: number;
}

// ─────────────────────────────────────────────
//  Navigation Param Lists
// ─────────────────────────────────────────────

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  JournalList: undefined;
  Search: undefined;
  Profile: undefined;
};

export type JournalStackParamList = {
  JournalList: undefined;
  JournalDetail: { entryId: string };
  JournalEditor: { entryId?: string };
  PhotoViewer: { photos: JournalPhoto[]; initialIndex: number };
};

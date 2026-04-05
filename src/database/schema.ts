/**
 * SQLite Schema Definitions
 *
 * WHY SQLite over Realm?
 * - No license cost concerns, ships with RN
 * - react-native-sqlite-storage is battle-tested
 * - SQL is universally understood (interview-friendly)
 * - Realm has a learning curve for reactive queries that adds unnecessary complexity
 */

export const SQL_CREATE_ENTRIES = `
  CREATE TABLE IF NOT EXISTS journal_entries (
    id                    TEXT PRIMARY KEY NOT NULL,
    user_id               TEXT NOT NULL,
    title                 TEXT NOT NULL DEFAULT '',
    description           TEXT NOT NULL DEFAULT '',
    tags                  TEXT NOT NULL DEFAULT '[]',
    latitude              REAL,
    longitude             REAL,
    altitude              REAL,
    accuracy              REAL,
    location_name         TEXT,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL,
    sync_status           TEXT NOT NULL DEFAULT 'local',
    is_deleted            INTEGER NOT NULL DEFAULT 0,
    voice_note_uri        TEXT,
    voice_note_transcript TEXT
  );
`;

export const SQL_CREATE_PHOTOS = `
  CREATE TABLE IF NOT EXISTS entry_photos (
    id              TEXT PRIMARY KEY NOT NULL,
    entry_id        TEXT NOT NULL,
    uri             TEXT NOT NULL,
    remote_url      TEXT,
    tags            TEXT NOT NULL DEFAULT '[]',
    tagging_status  TEXT NOT NULL DEFAULT 'pending',
    photo_order     INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL,
    FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
  );
`;

export const SQL_CREATE_SYNC_QUEUE = `
  CREATE TABLE IF NOT EXISTS sync_queue (
    id          TEXT PRIMARY KEY NOT NULL,
    entry_id    TEXT NOT NULL,
    operation   TEXT NOT NULL,
    payload     TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    attempts    INTEGER NOT NULL DEFAULT 0
  );
`;

export const SQL_CREATE_TAGGING_QUEUE = `
  CREATE TABLE IF NOT EXISTS tagging_queue (
    id          TEXT PRIMARY KEY NOT NULL,
    entry_id    TEXT NOT NULL,
    photo_id    TEXT NOT NULL,
    local_uri   TEXT NOT NULL,
    attempts    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
  );
`;

export const SQL_CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_entries_user_id   ON journal_entries(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_entries_created   ON journal_entries(created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_entries_sync      ON journal_entries(sync_status);`,
  `CREATE INDEX IF NOT EXISTS idx_entries_deleted   ON journal_entries(is_deleted);`,
  `CREATE INDEX IF NOT EXISTS idx_photos_entry_id   ON entry_photos(entry_id);`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_entry  ON sync_queue(entry_id);`,
  `CREATE INDEX IF NOT EXISTS idx_tag_queue_photo   ON tagging_queue(photo_id);`,
];

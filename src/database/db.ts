/**
 * SQLite Database singleton
 *
 * Architecture note:
 * - Single connection shared across the app to avoid WAL contention
 * - All queries wrapped in typed helpers to keep callers clean
 * - Uses a queue-friendly Promise-based API
 */

import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';
import {
  SQL_CREATE_ENTRIES,
  SQL_CREATE_PHOTOS,
  SQL_CREATE_SYNC_QUEUE,
  SQL_CREATE_TAGGING_QUEUE,
  SQL_CREATE_INDEXES,
} from './schema';

SQLite.enablePromise(true);
SQLite.DEBUG(__DEV__);

let _db: SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLiteDatabase> {
  if (_db) return _db;

  const db = await SQLite.openDatabase({
    name: 'travel_journal.db',
    location: 'default',
  });

  try {
    await migrate(db);
    _db = db; // Only set the global singleton after successful migration
    return _db;
  } catch (error) {
    console.error('Database migration failed:', error);
    throw error;
  }
}

async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.transaction(async tx => {
    tx.executeSql(SQL_CREATE_ENTRIES);
    tx.executeSql(SQL_CREATE_PHOTOS);
    tx.executeSql(SQL_CREATE_SYNC_QUEUE);
    tx.executeSql(SQL_CREATE_TAGGING_QUEUE);
    SQL_CREATE_INDEXES.forEach(idx => tx.executeSql(idx));
  });
}

// ─── Generic helpers ──────────────────────────────────────────────────────────

export async function dbQuery<T = unknown>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const db = await getDatabase();
  const [results] = await db.executeSql(sql, params);
  const rows: T[] = [];
  for (let i = 0; i < results.rows.length; i++) {
    rows.push(results.rows.item(i) as T);
  }
  return rows;
}

export async function dbRun(sql: string, params: unknown[] = []): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(sql, params);
}

export async function dbTransaction(
  callback: (tx: SQLite.Transaction) => void,
): Promise<void> {
  const db = await getDatabase();
  await db.transaction(callback);
}

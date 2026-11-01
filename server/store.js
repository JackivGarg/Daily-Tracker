import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_SETTINGS, emptyEntry } from './model.js';

function readEntry(payload) {
  const entry = JSON.parse(payload);
  // Legacy records remain untouched on disk; newly introduced checks are unknown.
  return { ...emptyEntry(entry.date), ...entry };
}

export function createStore(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS entries (date TEXT PRIMARY KEY, payload TEXT NOT NULL);
    PRAGMA user_version=1;
  `);
  db.prepare('INSERT OR IGNORE INTO settings(id,payload) VALUES(1,?)').run(JSON.stringify(DEFAULT_SETTINGS));
  const getSettings = db.prepare('SELECT payload FROM settings WHERE id=1');
  const setSettings = db.prepare('UPDATE settings SET payload=? WHERE id=1');
  const getEntry = db.prepare('SELECT payload FROM entries WHERE date=?');
  const allEntries = db.prepare('SELECT payload FROM entries ORDER BY date ASC');
  const upsert = db.prepare('INSERT INTO entries(date,payload) VALUES(?,?) ON CONFLICT(date) DO UPDATE SET payload=excluded.payload');
  const store = {
    settings: () => JSON.parse(getSettings.get().payload),
    entries: () => allEntries.all().map((row) => readEntry(row.payload)),
    entry: (date) => { const row = getEntry.get(date); return row ? readEntry(row.payload) : null; },
    saveSettings: (settings) => { setSettings.run(JSON.stringify(settings)); return settings; },
    saveEntry: (entry) => { upsert.run(entry.date, JSON.stringify(entry)); return entry; },
    import: (settings, entries) => {
      db.exec('BEGIN IMMEDIATE');
      try {
        store.saveSettings(settings);
        for (const entry of entries) store.saveEntry(entry);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close: () => db.close(),
  };
  return store;
}

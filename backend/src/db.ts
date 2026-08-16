import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

let dbInstance: Database.Database | null = null;

// Load environmental variables from the project root
const projectRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.resolve(projectRoot, '.env') });

export function getDbPath(): string {
  if (process.env.NODE_ENV === 'test') {
    return ':memory:';
  }
  const rawPath = process.env.DB_PATH || 'backend/db/bookmarks.db';
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(projectRoot, rawPath);
}

export function initDb(dbPath = getDbPath()): Database.Database {
  if (dbInstance) return dbInstance;

  // Make sure directories exist
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath);

  // Enable optimizations
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // Create tables in order
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      personal_note TEXT,
      content_type TEXT DEFAULT 'website',
      reader_html TEXT,
      raw_text TEXT,
      image_path TEXT,
      favicon_path TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(user_id, url);

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bookmark_tags (
      bookmark_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (bookmark_id, tag_id),
      FOREIGN KEY(bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
      FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS highlights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bookmark_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      color TEXT DEFAULT 'yellow',
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_highlights_bookmark ON highlights(bookmark_id);
    CREATE INDEX IF NOT EXISTS idx_highlights_user ON highlights(user_id);

    CREATE TABLE IF NOT EXISTS shared_links (
      token TEXT PRIMARY KEY,
      bookmark_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_shared_links_token ON shared_links(token);

    CREATE TABLE IF NOT EXISTS shared_tags (
      token TEXT PRIMARY KEY,
      tag_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_shared_tags_token ON shared_tags(token);

    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(token_hash);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Safe schema migration for existing databases
  try {
    db.exec(`ALTER TABLE bookmarks ADD COLUMN personal_note TEXT;`);
  } catch {
    // Column already present
  }

  // Setup FTS5 virtual table
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5(
        bookmark_id UNINDEXED,
        title,
        description,
        personal_note,
        raw_text,
        content = 'bookmarks',
        content_rowid = 'id'
      );
    `);

    // Create triggers to sync FTS5
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS t_bookmarks_ai AFTER INSERT ON bookmarks BEGIN
        INSERT INTO bookmarks_fts(rowid, bookmark_id, title, description, personal_note, raw_text)
        VALUES (new.id, new.id, new.title, new.description, new.personal_note, new.raw_text);
      END;

      CREATE TRIGGER IF NOT EXISTS t_bookmarks_ad AFTER DELETE ON bookmarks BEGIN
        INSERT INTO bookmarks_fts(bookmarks_fts, rowid, bookmark_id, title, description, personal_note, raw_text)
        VALUES('delete', old.id, old.id, old.title, old.description, old.personal_note, old.raw_text);
      END;

      CREATE TRIGGER IF NOT EXISTS t_bookmarks_au AFTER UPDATE ON bookmarks BEGIN
        INSERT INTO bookmarks_fts(bookmarks_fts, rowid, bookmark_id, title, description, personal_note, raw_text)
        VALUES('delete', old.id, old.id, old.title, old.description, old.personal_note, old.raw_text);
        INSERT INTO bookmarks_fts(rowid, bookmark_id, title, description, personal_note, raw_text)
        VALUES (new.id, new.id, new.title, new.description, new.personal_note, new.raw_text);
      END;
    `);
  } catch (err) {
    console.error('Failed to create virtual table bookmarks_fts. FTS5 module might be missing.', err);
  }

  dbInstance = db;
  return db;
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    return initDb();
  }
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

import { initDb, closeDb } from '../db';
import Database from 'better-sqlite3';

describe('Database Scaffolding and Schema Initialization', () => {
  let db: Database.Database;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    db = initDb();
  });

  afterAll(() => {
    closeDb();
  });

  test('should initialize an in-memory database successfully', () => {
    expect(db).toBeDefined();
    expect(db.memory).toBe(true);
  });

  test('should apply required PRAGMA optimizations', () => {
    const journalMode = db.pragma('journal_mode');
    expect(journalMode).toEqual(
      db.memory ? [{ journal_mode: 'memory' }] : [{ journal_mode: 'wal' }]
    );

    const synchronous = db.pragma('synchronous');
    // Normal mode in SQLite is returned as 1
    expect(synchronous).toEqual([{ synchronous: 1 }]);

    const foreignKeys = db.pragma('foreign_keys');
    expect(foreignKeys).toEqual([{ foreign_keys: 1 }]);
  });

  test('should create all required tables', () => {
    const tablesQuery = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%';
    `);
    const tables = tablesQuery.all() as { name: string }[];
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('users');
    expect(tableNames).toContain('bookmarks');
    expect(tableNames).toContain('tags');
    expect(tableNames).toContain('bookmark_tags');
    expect(tableNames).toContain('shared_links');
    expect(tableNames).toContain('shared_tags');
    expect(tableNames).toContain('api_keys');
    expect(tableNames).toContain('bookmarks_fts');
    expect(tableNames).toContain('clips');
    expect(tableNames).toContain('clip_bookmarks');
  });

  test('should create FTS virtual table triggers', () => {
    const triggersQuery = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='trigger';
    `);
    const triggers = triggersQuery.all() as { name: string }[];
    const triggerNames = triggers.map(t => t.name);

    expect(triggerNames).toContain('t_bookmarks_ai');
    expect(triggerNames).toContain('t_bookmarks_ad');
    expect(triggerNames).toContain('t_bookmarks_au');
  });

  test('should successfully insert and retrieve a user record', () => {
    const insert = db.prepare(`
      INSERT INTO users (username, password_hash) VALUES (?, ?);
    `);
    const info = insert.run('testuser', 'hashedpassword');
    expect(info.changes).toBe(1);

    const select = db.prepare('SELECT * FROM users WHERE username = ?;');
    const user = select.get('testuser') as { username: string; password_hash: string };
    expect(user).toBeDefined();
    expect(user.username).toBe('testuser');
    expect(user.password_hash).toBe('hashedpassword');
  });
});

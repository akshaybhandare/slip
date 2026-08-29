/**
 * Utility helpers for backend operations
 */

/**
 * Splits an array into safe chunks (default max 500 per chunk) to avoid SQLite parameter limit errors.
 */
export function chunkArray<T>(items: T[], size = 500): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sanitizes and parses an array of IDs, eliminating duplicates, NaN, and non-positive numbers.
 */
export function parseIds(arr: any): number[] {
  if (!Array.isArray(arr)) return [];
  return Array.from(new Set(arr.map(Number))).filter((n) => !isNaN(n) && n > 0);
}

/**
 * Helper: Add tag to bookmark by name
 */
export function addTagToBookmark(db: any, bookmarkId: number, rawTagName: string): void {
  const cleanName = rawTagName.trim().toLowerCase().replace(/^#/, '');
  if (!cleanName) return;

  const findOrCreateTag = db.prepare(`
    INSERT INTO tags (name) VALUES (?)
    ON CONFLICT(name) DO UPDATE SET name=excluded.name
    RETURNING id
  `);
  const tagRecord = findOrCreateTag.get(cleanName) as { id: number };

  db.prepare(`
    INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)
  `).run(bookmarkId, tagRecord.id);
}

/**
 * Helper: Remove tag from bookmark by name
 */
export function removeTagFromBookmark(db: any, bookmarkId: number, rawTagName: string): void {
  const cleanName = rawTagName.trim().toLowerCase().replace(/^#/, '');
  if (!cleanName) return;

  const tagRecord = db.prepare('SELECT id FROM tags WHERE name = ?').get(cleanName) as { id: number } | undefined;
  if (tagRecord) {
    db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ? AND tag_id = ?').run(bookmarkId, tagRecord.id);
  }
}


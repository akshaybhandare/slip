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

import Database from 'better-sqlite3';
import { getDb } from '../db';
import { getResolvedModelsDir, ensureDirSync } from '../paths';
import { embeddingQueue } from './queue';

// Ensure cross-realm Float32Array compatibility for ONNX runtime in Jest/Node realms
if (typeof Float32Array !== 'undefined') {
  try {
    Object.defineProperty(Float32Array, Symbol.hasInstance, {
      value: (inst: any) => inst && (inst.constructor?.name === 'Float32Array' || Object.prototype.toString.call(inst) === '[object Float32Array]'),
      configurable: true
    });
  } catch {}
}

export const DEFAULT_EMBEDDING_MODEL = 'Xenova/bge-small-en-v1.5';
export const EMBEDDING_DIM = 384;

let pipelinePromise: Promise<any> | null = null;
let isModelReady = false;
let modelLoadError: string | null = null;

/**
 * Lazy singleton pipeline loader
 */
export async function getEmbeddingPipeline(): Promise<any> {
  if (pipelinePromise) {
    return pipelinePromise;
  }

  pipelinePromise = (async () => {
    try {
      const modelsDir = getResolvedModelsDir();
      ensureDirSync(modelsDir);

      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = modelsDir;
      env.allowLocalModels = true;

      // In test mode or when requested via env
      const modelName = process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
      const extractor = await pipeline('feature-extraction', modelName, {
        dtype: 'fp32'
      });

      isModelReady = true;
      modelLoadError = null;
      return extractor;
    } catch (err: any) {
      console.error('[EmbeddingService] Failed to load embedding pipeline:', err?.message || err);
      isModelReady = false;
      modelLoadError = err?.message || String(err);
      pipelinePromise = null;
      throw err;
    }
  })();

  return pipelinePromise;
}

/**
 * Generate 384-dimensional normalized vector embedding for text
 */
export async function generateEmbedding(text: string, isQuery = false): Promise<Float32Array | null> {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return null;
  }

  try {
    const extractor = await getEmbeddingPipeline();
    const cleanText = text.trim().slice(0, 4000); // Guard against excessively long input

    // For BGE retrieval models, search queries benefit from the retrieval prompt prefix
    const modelName = process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
    let inputText = cleanText;
    if (isQuery && modelName.includes('bge')) {
      inputText = `Represent this sentence for searching relevant passages: ${cleanText}`;
    }

    const output = await extractor(inputText, {
      pooling: 'mean',
      normalize: true
    });

    if (output && output.data) {
      if (output.data instanceof Float32Array) {
        return output.data;
      }
      return new Float32Array(output.data);
    }
    return null;
  } catch (err) {
    console.warn('[EmbeddingService] generateEmbedding warning:', err);
    return null;
  }
}

/**
 * Fast cosine similarity between two normalized Float32 vectors (dot product)
 */
export function computeCosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  // Clamp between -1 and 1
  return Math.max(-1, Math.min(1, dot));
}

/**
 * Build representative text payload from bookmark attributes
 */
export function buildSlipText(bookmark: {
  title?: string | null;
  description?: string | null;
  personal_note?: string | null;
  tags?: { name: string }[] | string[] | null;
  raw_text?: string | null;
}): string {
  const parts: string[] = [];

  if (bookmark.title && bookmark.title.trim()) {
    parts.push(bookmark.title.trim());
  }

  if (bookmark.description && bookmark.description.trim()) {
    parts.push(bookmark.description.trim());
  }

  if (bookmark.personal_note && bookmark.personal_note.trim()) {
    parts.push(`Note: ${bookmark.personal_note.trim()}`);
  }

  if (bookmark.tags && Array.isArray(bookmark.tags) && bookmark.tags.length > 0) {
    const tagNames = bookmark.tags
      .map((t) => (typeof t === 'string' ? t : t.name))
      .filter(Boolean);
    if (tagNames.length > 0) {
      parts.push(`Tags: ${tagNames.join(', ')}`);
    }
  }

  if (bookmark.raw_text && bookmark.raw_text.trim()) {
    // Include the first 1000 characters of page content / summary
    parts.push(bookmark.raw_text.trim().slice(0, 1000));
  }

  return parts.join('\n');
}

/**
 * Save embedding Float32Array to SQLite slip_embeddings table
 */
export function saveBookmarkEmbedding(
  db: Database.Database,
  bookmarkId: number,
  embedding: Float32Array,
  modelName = process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL
): void {
  const buffer = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);
  db.prepare(`
    INSERT INTO slip_embeddings (bookmark_id, embedding, model, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(bookmark_id) DO UPDATE SET
      embedding = excluded.embedding,
      model = excluded.model,
      updated_at = datetime('now')
  `).run(bookmarkId, buffer, modelName);
}

/**
 * Retrieve embedding Float32Array for a bookmark
 */
export function getBookmarkEmbedding(db: Database.Database, bookmarkId: number): Float32Array | null {
  const row = db.prepare(`SELECT embedding FROM slip_embeddings WHERE bookmark_id = ?`).get(bookmarkId) as { embedding: Buffer } | undefined;
  if (!row || !row.embedding) return null;
  return new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4);
}

/**
 * Retrieve all active bookmark embeddings for a user
 */
export function getAllUserEmbeddings(db: Database.Database, userId: number): { bookmark_id: number; embedding: Float32Array }[] {
  const rows = db.prepare(`
    SELECT e.bookmark_id, e.embedding
    FROM slip_embeddings e
    JOIN bookmarks b ON e.bookmark_id = b.id
    WHERE b.user_id = ? AND b.deleted_at IS NULL
  `).all(userId) as { bookmark_id: number; embedding: Buffer }[];

  return rows.map((r) => ({
    bookmark_id: r.bookmark_id,
    embedding: new Float32Array(r.embedding.buffer, r.embedding.byteOffset, r.embedding.byteLength / 4)
  }));
}

/**
 * Index a single bookmark by ID
 */
export async function indexBookmark(bookmarkId: number): Promise<boolean> {
  const db = getDb();
  const bookmark = db.prepare(`
    SELECT b.id, b.user_id, b.title, b.description, b.personal_note, b.raw_text, b.deleted_at
    FROM bookmarks b
    WHERE b.id = ?
  `).get(bookmarkId) as any;

  if (!bookmark || bookmark.deleted_at) {
    return false;
  }

  // Fetch tags
  const tags = db.prepare(`
    SELECT t.name FROM tags t
    JOIN bookmark_tags bt ON t.id = bt.tag_id
    WHERE bt.bookmark_id = ?
  `).all(bookmarkId) as { name: string }[];

  const textToEmbed = buildSlipText({
    title: bookmark.title,
    description: bookmark.description,
    personal_note: bookmark.personal_note,
    raw_text: bookmark.raw_text,
    tags
  });

  if (!textToEmbed) return false;

  const vector = await generateEmbedding(textToEmbed, false);
  if (!vector) return false;

  saveBookmarkEmbedding(db, bookmarkId, vector);
  console.log(`[Embeddings] Slip #${bookmarkId} indexed successfully.`);
  return true;
}

/**
 * Non-blocking queue wrapper for indexing
 */
export function queueBookmarkIndex(bookmarkId: number): void {
  embeddingQueue.add(() => indexBookmark(bookmarkId)).catch((err) => {
    console.warn(`[EmbeddingQueue] Failed to index bookmark #${bookmarkId}:`, err);
  });
}

/**
 * Get library embedding statistics for a user
 */
export function getEmbeddingStatus(userId: number): {
  totalBookmarks: number;
  indexedBookmarks: number;
  percentage: number;
  isReady: boolean;
  modelName: string;
} {
  const db = getDb();
  const totalRow = db.prepare(`SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND deleted_at IS NULL`).get(userId) as { count: number };
  const indexedRow = db.prepare(`
    SELECT COUNT(e.bookmark_id) as count
    FROM slip_embeddings e
    JOIN bookmarks b ON e.bookmark_id = b.id
    WHERE b.user_id = ? AND b.deleted_at IS NULL
  `).get(userId) as { count: number };

  const total = totalRow?.count || 0;
  const indexed = indexedRow?.count || 0;
  const percentage = total > 0 ? Math.round((indexed / total) * 100) : 100;

  return {
    totalBookmarks: total,
    indexedBookmarks: indexed,
    percentage,
    isReady: isModelReady,
    modelName: process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL
  };
}

/**
 * Batch re-index all user bookmarks
 */
export async function reindexAllUserBookmarks(
  userId: number,
  onProgress?: (current: number, total: number) => void
): Promise<{ indexed: number; total: number }> {
  const db = getDb();
  const bookmarks = db.prepare(`
    SELECT b.id FROM bookmarks b
    WHERE b.user_id = ? AND b.deleted_at IS NULL
    ORDER BY b.id DESC
  `).all(userId) as { id: number }[];

  let indexedCount = 0;
  const total = bookmarks.length;

  for (let i = 0; i < total; i++) {
    const success = await indexBookmark(bookmarks[i].id);
    if (success) indexedCount++;
    if (onProgress) {
      onProgress(i + 1, total);
    }
  }

  return { indexed: indexedCount, total };
}

/**
 * Issue #40: Find top K semantically related slips for a given bookmark
 */
export async function findRelatedBookmarks(
  bookmarkId: number,
  userId: number,
  limit = 5,
  minSimilarity = 0.35
): Promise<{ bookmark: any; similarityScore: number }[]> {
  const db = getDb();

  // 1. Get or generate target embedding
  let targetEmbedding = getBookmarkEmbedding(db, bookmarkId);
  if (!targetEmbedding) {
    await indexBookmark(bookmarkId);
    targetEmbedding = getBookmarkEmbedding(db, bookmarkId);
  }

  if (!targetEmbedding) {
    return [];
  }

  // 2. Get all other active user embeddings
  const userEmbeddings = getAllUserEmbeddings(db, userId).filter((e) => e.bookmark_id !== bookmarkId);
  if (userEmbeddings.length === 0) return [];

  // 3. Compute cosine similarities
  const scored: { bookmark_id: number; score: number }[] = [];
  for (const item of userEmbeddings) {
    const score = computeCosineSimilarity(targetEmbedding, item.embedding);
    if (score >= minSimilarity) {
      scored.push({ bookmark_id: item.bookmark_id, score });
    }
  }

  // 4. Sort descending by similarity
  scored.sort((a, b) => b.score - a.score);
  const topMatches = scored.slice(0, limit);

  if (topMatches.length === 0) return [];

  // 5. Hydrate full bookmark objects
  const placeholders = topMatches.map(() => '?').join(',');
  const ids = topMatches.map((m) => m.bookmark_id);

  const rawBookmarks = db.prepare(`
    SELECT b.id, b.user_id, b.url, b.title, b.description, b.personal_note, b.content_type,
           b.image_path, b.favicon_path, b.is_pinned, b.pinned_at, b.deleted_at, b.created_at, b.updated_at
    FROM bookmarks b
    WHERE b.id IN (${placeholders}) AND b.deleted_at IS NULL
  `).all(...ids) as any[];

  // Attach tags
  const bookmarkMap = new Map<number, any>();
  for (const b of rawBookmarks) {
    b.is_pinned = Boolean(b.is_pinned);
    b.tags = [];
    bookmarkMap.set(b.id, b);
  }

  const tagsRows = db.prepare(`
    SELECT bt.bookmark_id, t.id as tag_id, t.name as tag_name
    FROM bookmark_tags bt
    JOIN tags t ON bt.tag_id = t.id
    WHERE bt.bookmark_id IN (${placeholders})
  `).all(...ids) as any[];

  for (const t of tagsRows) {
    const b = bookmarkMap.get(t.bookmark_id);
    if (b) {
      b.tags.push({ id: t.tag_id, name: t.tag_name });
    }
  }

  // Preserve similarity ranking order
  const results: { bookmark: any; similarityScore: number }[] = [];
  for (const m of topMatches) {
    const b = bookmarkMap.get(m.bookmark_id);
    if (b) {
      const percentageScore = Math.round(m.score * 100);
      b.similarityScore = percentageScore;
      results.push({
        bookmark: b,
        similarityScore: percentageScore
      });
    }
  }

  return results;
}

/**
 * Issue #40: Suggest existing library tags for a bookmark using tag centroid similarity
 */
export async function suggestTagsForBookmark(
  bookmarkInput: number | { title?: string; description?: string; personal_note?: string; raw_text?: string },
  userId: number,
  limit = 5,
  minSimilarity = 0.40
): Promise<{ id: number; name: string; score: number; count: number }[]> {
  const db = getDb();

  // 1. Get embedding for the input
  let inputVector: Float32Array | null = null;
  let existingTagIds = new Set<number>();

  if (typeof bookmarkInput === 'number') {
    inputVector = getBookmarkEmbedding(db, bookmarkInput);
    if (!inputVector) {
      await indexBookmark(bookmarkInput);
      inputVector = getBookmarkEmbedding(db, bookmarkInput);
    }
    const currentTags = db.prepare(`SELECT tag_id FROM bookmark_tags WHERE bookmark_id = ?`).all(bookmarkInput) as { tag_id: number }[];
    existingTagIds = new Set(currentTags.map((t) => t.tag_id));
  } else {
    const text = buildSlipText(bookmarkInput);
    if (text) {
      inputVector = await generateEmbedding(text, false);
    }
  }

  if (!inputVector) {
    return [];
  }

  // 2. Fetch all user tag occurrences with their bookmark embeddings
  const tagSlipRows = db.prepare(`
    SELECT t.id as tag_id, t.name as tag_name, bt.bookmark_id, e.embedding
    FROM tags t
    JOIN bookmark_tags bt ON t.id = bt.tag_id
    JOIN bookmarks b ON bt.bookmark_id = b.id
    JOIN slip_embeddings e ON b.id = e.bookmark_id
    WHERE b.user_id = ? AND b.deleted_at IS NULL
  `).all(userId) as { tag_id: number; tag_name: string; bookmark_id: number; embedding: Buffer }[];

  if (tagSlipRows.length === 0) {
    return [];
  }

  // 3. Compute centroid vector for each tag
  const tagData = new Map<number, { id: number; name: string; sumVector: Float64Array; count: number }>();

  for (const row of tagSlipRows) {
    if (existingTagIds.has(row.tag_id)) continue; // Skip tags already attached

    const vec = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4);
    let entry = tagData.get(row.tag_id);
    if (!entry) {
      entry = {
        id: row.tag_id,
        name: row.tag_name,
        sumVector: new Float64Array(EMBEDDING_DIM),
        count: 0
      };
      tagData.set(row.tag_id, entry);
    }

    for (let i = 0; i < EMBEDDING_DIM; i++) {
      entry.sumVector[i] += vec[i];
    }
    entry.count++;
  }

  // 4. Compute similarity with normalized centroid
  const candidateTags: { id: number; name: string; score: number; count: number }[] = [];

  for (const [tagId, data] of tagData.entries()) {
    // Normalize centroid
    let norm = 0;
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      norm += data.sumVector[i] * data.sumVector[i];
    }
    norm = Math.sqrt(norm);
    if (norm === 0) continue;

    let dot = 0;
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      const centroidVal = data.sumVector[i] / norm;
      dot += inputVector[i] * centroidVal;
    }

    if (dot >= minSimilarity) {
      candidateTags.push({
        id: tagId,
        name: data.name,
        score: Math.round(dot * 100),
        count: data.count
      });
    }
  }

  candidateTags.sort((a, b) => b.score - a.score);
  return candidateTags.slice(0, limit);
}

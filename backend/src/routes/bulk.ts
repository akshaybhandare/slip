import { Router, Response } from 'express';
import { getDb } from '../db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { chunkArray } from '../utils';

const router = Router();
router.use(authenticate);

// Helper: Collect target clip ID and all active recursive descendant IDs
function getDescendantClipIds(db: any, rootClipId: number, userId: number): number[] {
  const allClipIds = [rootClipId];
  const queue = [rootClipId];
  const visited = new Set<number>([rootClipId]);
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const children = db.prepare('SELECT id FROM clips WHERE parent_id = ? AND user_id = ? AND deleted_at IS NULL').all(curr, userId) as { id: number }[];
    for (const ch of children) {
      if (!visited.has(ch.id)) {
        visited.add(ch.id);
        allClipIds.push(ch.id);
        queue.push(ch.id);
      }
    }
  }
  return allClipIds;
}

// Helper: Add tag to bookmark by name
function addTagToBookmark(db: any, bookmarkId: number, rawTagName: string) {
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

function parseIds(arr: any): number[] {
  if (!Array.isArray(arr)) return [];
  return Array.from(new Set(arr.map(Number))).filter((n) => !isNaN(n) && n > 0);
}

// POST /api/bulk/delete - Bulk soft delete slips and/or clips
router.post('/delete', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const slipIds = parseIds(req.body?.slipIds || req.body?.slip_ids || req.body?.bookmarkIds || req.body?.bookmark_ids);
  const clipIds = parseIds(req.body?.clipIds || req.body?.clip_ids);
  const rawInclude = req.query.include_children ?? req.body?.include_children ?? req.body?.includeChildren;
  const includeChildren = rawInclude === undefined ? true : (rawInclude === true || rawInclude === 'true' || rawInclude === '1');

  if (slipIds.length === 0 && clipIds.length === 0) {
    return res.status(400).json({ message: 'No slip or clip IDs provided for bulk deletion' });
  }

  try {
    const db = getDb();
    const deleteTx = db.transaction(() => {
      let deletedSlipsCount = 0;
      let deletedClipsCount = 0;

      // 1. Soft delete slips in safe batches
      if (slipIds.length > 0) {
        for (const chunk of chunkArray(slipIds, 500)) {
          const placeholders = chunk.map(() => '?').join(',');
          const bRes = db.prepare(`
            UPDATE bookmarks 
            SET deleted_at = datetime('now'), is_pinned = 0 
            WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NULL
          `).run(...chunk, userId);
          deletedSlipsCount += bRes.changes;
        }
      }

      // 2. Soft delete clips
      if (clipIds.length > 0) {
        if (includeChildren) {
          const allDescendantIdsSet = new Set<number>();
          for (const cid of clipIds) {
            const clip = db.prepare('SELECT id FROM clips WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(cid, userId);
            if (clip) {
              const descIds = getDescendantClipIds(db, cid, userId);
              for (const d of descIds) allDescendantIdsSet.add(d);
            }
          }

          const allIds = Array.from(allDescendantIdsSet);
          if (allIds.length > 0) {
            for (const chunk of chunkArray(allIds, 500)) {
              const placeholders = chunk.map(() => '?').join(',');
              // Soft delete slips within these clips
              db.prepare(`
                UPDATE bookmarks 
                SET deleted_at = datetime('now'), updated_at = datetime('now')
                WHERE id IN (
                  SELECT bookmark_id FROM clip_bookmarks WHERE clip_id IN (${placeholders})
                ) AND user_id = ? AND deleted_at IS NULL
              `).run(...chunk, userId);

              // Untag
              const clips = db.prepare(`SELECT id, name FROM clips WHERE id IN (${placeholders}) AND user_id = ?`).all(...chunk, userId) as { id: number; name: string }[];
              for (const c of clips) {
                const cleanName = c.name.trim().toLowerCase().replace(/^#/, '');
                if (cleanName) {
                  const tagRecord = db.prepare('SELECT id FROM tags WHERE name = ?').get(cleanName) as { id: number } | undefined;
                  if (tagRecord) {
                    db.prepare(`
                      DELETE FROM bookmark_tags 
                      WHERE tag_id = ? 
                      AND bookmark_id IN (SELECT bookmark_id FROM clip_bookmarks WHERE clip_id = ?)
                    `).run(tagRecord.id, c.id);
                  }
                }
              }

              const cRes = db.prepare(`
                UPDATE clips 
                SET deleted_at = datetime('now'), updated_at = datetime('now')
                WHERE id IN (${placeholders}) AND user_id = ?
              `).run(...chunk, userId);
              deletedClipsCount += cRes.changes;
            }
          }
        } else {
          for (const cid of clipIds) {
            const clip = db.prepare('SELECT id, name, parent_id FROM clips WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(cid, userId) as { id: number; name: string; parent_id: number | null } | undefined;
            if (clip) {
              db.prepare(`
                UPDATE clips 
                SET parent_id = ?, updated_at = datetime('now')
                WHERE parent_id = ? AND user_id = ? AND deleted_at IS NULL
              `).run(clip.parent_id, cid, userId);

              const cleanName = clip.name.trim().toLowerCase().replace(/^#/, '');
              if (cleanName) {
                const tagRecord = db.prepare('SELECT id FROM tags WHERE name = ?').get(cleanName) as { id: number } | undefined;
                if (tagRecord) {
                  db.prepare(`
                    DELETE FROM bookmark_tags 
                    WHERE tag_id = ? 
                    AND bookmark_id IN (SELECT bookmark_id FROM clip_bookmarks WHERE clip_id = ?)
                  `).run(tagRecord.id, cid);
                }
              }

              const cRes = db.prepare(`
                UPDATE clips 
                SET deleted_at = datetime('now'), updated_at = datetime('now')
                WHERE id = ? AND user_id = ?
              `).run(cid, userId);
              deletedClipsCount += cRes.changes;
            }
          }
        }
      }

      return { deletedSlipsCount, deletedClipsCount };
    });

    const result = deleteTx();
    res.status(200).json({
      message: 'Items moved to Recycle Clip successfully',
      ...result,
      slipIds,
      clipIds
    });
  } catch (err) {
    console.error('Unified bulk delete error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/bulk/restore - Bulk restore slips and/or clips
router.post('/restore', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const slipIds = parseIds(req.body?.slipIds || req.body?.slip_ids || req.body?.bookmarkIds || req.body?.bookmark_ids);
  const clipIds = parseIds(req.body?.clipIds || req.body?.clip_ids);

  if (slipIds.length === 0 && clipIds.length === 0) {
    return res.status(400).json({ message: 'No slip or clip IDs provided for bulk restoration' });
  }

  try {
    const db = getDb();
    const restoreTx = db.transaction(() => {
      let restoredSlipsCount = 0;
      let restoredClipsCount = 0;

      // 1. Restore clips first (so parent/child tag bindings align)
      if (clipIds.length > 0) {
        for (const clipId of clipIds) {
          const clip = db.prepare('SELECT id, name, parent_id FROM clips WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL').get(clipId, userId) as { id: number; name: string; parent_id: number | null } | undefined;
          if (clip) {
            let targetParentId = clip.parent_id;
            if (targetParentId !== null) {
              const parent = db.prepare('SELECT id FROM clips WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(targetParentId, userId);
              if (!parent) targetParentId = null;
            }

            const targetIdsQueue = [clipId];
            const queue = [clipId];
            const visited = new Set<number>([clipId]);
            while (queue.length > 0) {
              const curr = queue.shift()!;
              const children = db.prepare('SELECT id FROM clips WHERE parent_id = ? AND user_id = ?').all(curr, userId) as { id: number }[];
              for (const ch of children) {
                if (!visited.has(ch.id)) {
                  visited.add(ch.id);
                  targetIdsQueue.push(ch.id);
                  queue.push(ch.id);
                }
              }
            }

            db.prepare(`
              UPDATE clips 
              SET deleted_at = NULL, parent_id = ?, updated_at = datetime('now')
              WHERE id = ? AND user_id = ?
            `).run(targetParentId, clipId, userId);

            // Chunk restoration of descendants and their bookmarks
            for (const chunk of chunkArray(targetIdsQueue, 500)) {
              const placeholders = chunk.map(() => '?').join(',');
              db.prepare(`
                UPDATE clips 
                SET deleted_at = NULL, updated_at = datetime('now')
                WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NOT NULL
              `).run(...chunk, userId);

              db.prepare(`
                UPDATE bookmarks
                SET deleted_at = NULL, updated_at = datetime('now')
                WHERE id IN (
                  SELECT bookmark_id FROM clip_bookmarks WHERE clip_id IN (${placeholders})
                ) AND user_id = ? AND deleted_at IS NOT NULL
              `).run(...chunk, userId);
            }

            for (const cId of targetIdsQueue) {
              const c = db.prepare('SELECT name FROM clips WHERE id = ?').get(cId) as { name: string } | undefined;
              if (c) {
                const clippedBookmarks = db.prepare('SELECT bookmark_id FROM clip_bookmarks WHERE clip_id = ?').all(cId) as { bookmark_id: number }[];
                for (const cb of clippedBookmarks) {
                  addTagToBookmark(db, cb.bookmark_id, c.name);
                }
              }
            }
            restoredClipsCount++;
          }
        }
      }

      // 2. Restore individual slips in safe batches
      if (slipIds.length > 0) {
        for (const chunk of chunkArray(slipIds, 500)) {
          const placeholders = chunk.map(() => '?').join(',');
          const bRes = db.prepare(`
            UPDATE bookmarks 
            SET deleted_at = NULL, updated_at = datetime('now')
            WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NOT NULL
          `).run(...chunk, userId);
          restoredSlipsCount += bRes.changes;
        }
      }

      return { restoredSlipsCount, restoredClipsCount };
    });

    const result = restoreTx();
    res.status(200).json({
      message: 'Items restored successfully',
      ...result,
      slipIds,
      clipIds
    });
  } catch (err) {
    console.error('Unified bulk restore error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/bulk/permanent - Bulk permanent delete slips and/or clips
router.post('/permanent', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const slipIds = parseIds(req.body?.slipIds || req.body?.slip_ids || req.body?.bookmarkIds || req.body?.bookmark_ids);
  const clipIds = parseIds(req.body?.clipIds || req.body?.clip_ids);

  if (slipIds.length === 0 && clipIds.length === 0) {
    return res.status(400).json({ message: 'No slip or clip IDs provided for bulk permanent deletion' });
  }

  try {
    const db = getDb();
    const permTx = db.transaction(() => {
      let deletedSlipsCount = 0;
      let deletedClipsCount = 0;

      if (slipIds.length > 0) {
        for (const chunk of chunkArray(slipIds, 500)) {
          const placeholders = chunk.map(() => '?').join(',');
          const bRes = db.prepare(`
            DELETE FROM bookmarks 
            WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NOT NULL
          `).run(...chunk, userId);
          deletedSlipsCount += bRes.changes;
        }
      }

      if (clipIds.length > 0) {
        for (const chunk of chunkArray(clipIds, 500)) {
          const placeholders = chunk.map(() => '?').join(',');
          const cRes = db.prepare(`
            DELETE FROM clips 
            WHERE id IN (${placeholders}) AND user_id = ?
          `).run(...chunk, userId);
          deletedClipsCount += cRes.changes;
        }
      }

      return { deletedSlipsCount, deletedClipsCount };
    });

    const result = permTx();
    res.status(200).json({
      message: 'Items permanently deleted',
      ...result,
      slipIds,
      clipIds
    });
  } catch (err) {
    console.error('Unified bulk permanent delete error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

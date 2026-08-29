import { Router, Response } from 'express';
import { getDb } from '../db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { chunkArray, parseIds, addTagToBookmark, removeTagFromBookmark } from '../utils';

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

// POST /api/bulk/delete or DELETE /api/bulk/delete - Bulk soft delete slips and/or clips
const handleBulkDelete = (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const clipIds = parseIds(req.body?.clipIds || req.body?.clip_ids);
  const slipIds = parseIds(req.body?.slipIds || req.body?.slip_ids || req.body?.bookmarkIds || req.body?.bookmark_ids || (clipIds.length === 0 ? req.body?.ids : undefined));
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
                SET deleted_at = datetime('now'), is_pinned = 0, updated_at = datetime('now')
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

              // Clean up clip_bookmarks association for this deleted clip
              db.prepare('DELETE FROM clip_bookmarks WHERE clip_id = ?').run(cid);

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
};

router.post('/delete', handleBulkDelete);
router.delete('/delete', handleBulkDelete);
router.delete('/', handleBulkDelete);

// POST /api/bulk/restore - Bulk restore slips and/or clips
const handleBulkRestore = (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const clipIds = parseIds(req.body?.clipIds || req.body?.clip_ids);
  const slipIds = parseIds(req.body?.slipIds || req.body?.slip_ids || req.body?.bookmarkIds || req.body?.bookmark_ids || (clipIds.length === 0 ? req.body?.ids : undefined));

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
              const c = db.prepare('SELECT name FROM clips WHERE id = ? AND user_id = ?').get(cId, userId) as { name: string } | undefined;
              if (c) {
                const clippedBookmarks = db.prepare(`
                  SELECT cb.bookmark_id 
                  FROM clip_bookmarks cb
                  JOIN bookmarks b ON cb.bookmark_id = b.id
                  WHERE cb.clip_id = ? AND b.user_id = ?
                `).all(cId, userId) as { bookmark_id: number }[];
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
};

router.post('/restore', handleBulkRestore);

// POST /api/bulk/permanent or DELETE /api/bulk/permanent - Bulk permanent delete slips and/or clips
const handleBulkPermanent = (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const clipIds = parseIds(req.body?.clipIds || req.body?.clip_ids);
  const slipIds = parseIds(req.body?.slipIds || req.body?.slip_ids || req.body?.bookmarkIds || req.body?.bookmark_ids || (clipIds.length === 0 ? req.body?.ids : undefined));

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
            WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NOT NULL
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
};

router.post('/permanent', handleBulkPermanent);
router.delete('/permanent', handleBulkPermanent);

// POST /api/bulk/clip or POST /api/bulk/organize - Bulk assign slips to a clip (or unclip if clipId is null)
const handleBulkClip = (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const slipIds = parseIds(req.body?.slipIds || req.body?.slip_ids || req.body?.bookmarkIds || req.body?.bookmark_ids || req.body?.ids);
  const rawClipId = req.body?.clipId !== undefined ? req.body.clipId : req.body?.clip_id;
  const targetClipId = (rawClipId === null || rawClipId === undefined || rawClipId === '' || rawClipId === 0 || rawClipId === '0') ? null : Number(rawClipId);

  if (slipIds.length === 0) {
    return res.status(400).json({ message: 'No slip IDs provided for bulk clip assignment' });
  }

  if (targetClipId !== null && (isNaN(targetClipId) || targetClipId <= 0)) {
    return res.status(400).json({ message: 'Invalid clip ID' });
  }

  try {
    const db = getDb();
    let targetClip: { id: number; name: string } | undefined;

    if (targetClipId !== null) {
      targetClip = db.prepare('SELECT id, name FROM clips WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(targetClipId, userId) as { id: number; name: string } | undefined;
      if (!targetClip) {
        return res.status(404).json({ message: 'Clip not found' });
      }
    }

    const organizeTx = db.transaction(() => {
      let updatedSlipsCount = 0;

      for (const chunk of chunkArray(slipIds, 500)) {
        const placeholders = chunk.map(() => '?').join(',');

        // 1. Fetch valid slips belonging to user and not deleted
        const validSlips = db.prepare(`
          SELECT id FROM bookmarks 
          WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NULL
        `).all(...chunk, userId) as { id: number }[];

        if (validSlips.length === 0) continue;

        const validIds = validSlips.map((s) => s.id);
        const validPlaceholders = validIds.map(() => '?').join(',');

        // 2. Fetch old clips for these valid slips to remove outdated tags
        const oldClips = db.prepare(`
          SELECT cb.bookmark_id, c.id AS clip_id, c.name AS clip_name
          FROM clip_bookmarks cb
          JOIN clips c ON cb.clip_id = c.id
          WHERE cb.bookmark_id IN (${validPlaceholders}) AND c.user_id = ?
        `).all(...validIds, userId) as { bookmark_id: number; clip_id: number; clip_name: string }[];

        for (const oc of oldClips) {
          if (targetClipId === null || oc.clip_id !== targetClipId) {
            removeTagFromBookmark(db, oc.bookmark_id, oc.clip_name);
          }
        }

        if (targetClipId === null) {
          // Remove from clip_bookmarks
          db.prepare(`
            DELETE FROM clip_bookmarks 
            WHERE bookmark_id IN (${validPlaceholders})
          `).run(...validIds);
        } else {
          // Upsert into clip_bookmarks and add target clip tag
          const insertStmt = db.prepare(`
            INSERT INTO clip_bookmarks (clip_id, bookmark_id) 
            VALUES (?, ?)
            ON CONFLICT(bookmark_id) DO UPDATE SET clip_id = excluded.clip_id
          `);

          for (const bId of validIds) {
            insertStmt.run(targetClipId, bId);
            addTagToBookmark(db, bId, targetClip!.name);
          }
        }

        updatedSlipsCount += validIds.length;
      }

      return { updatedSlipsCount };
    });

    const result = organizeTx();
    res.status(200).json({
      message: targetClipId === null ? 'Slips unclipped successfully' : 'Slips organized in clip successfully',
      ...result,
      slipIds,
      clipId: targetClipId
    });
  } catch (err) {
    console.error('Bulk clip organize error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

router.post('/clip', handleBulkClip);
router.post('/organize', handleBulkClip);

export default router;

import { Router, Response } from 'express';
import { getDb } from '../db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Helper: Check if targetParentId is a descendant of clipId (to prevent cycles)
function isDescendant(db: any, potentialDescendantId: number, ancestorId: number): boolean {
  let currentId: number | null = potentialDescendantId;
  const visited = new Set<number>();

  while (currentId !== null) {
    if (currentId === ancestorId) {
      return true;
    }
    if (visited.has(currentId)) {
      break; // Safeguard against existing loops
    }
    visited.add(currentId);

    const row = db.prepare('SELECT parent_id FROM clips WHERE id = ? AND deleted_at IS NULL').get(currentId) as { parent_id: number | null } | undefined;
    if (!row || row.parent_id === null || row.parent_id === undefined) {
      break;
    }
    currentId = row.parent_id;
  }

  return false;
}

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

// Helper: Build breadcrumbs from root down to current clip
function getBreadcrumbs(db: any, clipId: number, userId: number): { id: number; name: string }[] {
  const crumbs: { id: number; name: string }[] = [];
  let currentId: number | null = clipId;
  const visited = new Set<number>();

  while (currentId !== null) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const row = db.prepare('SELECT id, name, parent_id FROM clips WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(currentId, userId) as { id: number; name: string; parent_id: number | null } | undefined;
    if (!row) break;

    crumbs.unshift({ id: row.id, name: row.name });
    currentId = row.parent_id;
  }

  return crumbs;
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

// Helper: Remove tag from bookmark by name
function removeTagFromBookmark(db: any, bookmarkId: number, rawTagName: string) {
  const cleanName = rawTagName.trim().toLowerCase().replace(/^#/, '');
  if (!cleanName) return;

  const tagRecord = db.prepare('SELECT id FROM tags WHERE name = ?').get(cleanName) as { id: number } | undefined;
  if (tagRecord) {
    db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ? AND tag_id = ?').run(bookmarkId, tagRecord.id);
  }
}

// 1. GET /api/clips - List all active clips for current user
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const db = getDb();
    const clips = db.prepare(`
      SELECT 
        c.id, 
        c.user_id, 
        c.name, 
        c.parent_id, 
        c.created_at, 
        c.updated_at,
        (SELECT COUNT(*) FROM clip_bookmarks cb JOIN bookmarks b ON cb.bookmark_id = b.id WHERE cb.clip_id = c.id AND b.deleted_at IS NULL) AS item_count,
        (SELECT COUNT(*) FROM clips sub WHERE sub.parent_id = c.id AND sub.user_id = c.user_id AND sub.deleted_at IS NULL) AS subclip_count
      FROM clips c
      WHERE c.user_id = ? AND c.deleted_at IS NULL
      ORDER BY c.name COLLATE NOCASE ASC
    `).all(userId);

    res.status(200).json(clips);
  } catch (err) {
    console.error('Fetch clips error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 1.1 GET /api/clips/recycle-clip - List soft-deleted clips
router.get('/recycle-clip', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const db = getDb();
    const trashedClips = db.prepare(`
      SELECT 
        c.id, 
        c.user_id, 
        c.name, 
        c.parent_id, 
        c.deleted_at,
        c.created_at, 
        c.updated_at,
        (SELECT COUNT(*) FROM clip_bookmarks cb JOIN bookmarks b ON cb.bookmark_id = b.id WHERE cb.clip_id = c.id AND b.deleted_at IS NULL) AS item_count,
        (SELECT COUNT(*) FROM clips sub WHERE sub.parent_id = c.id AND sub.user_id = c.user_id) AS subclip_count
      FROM clips c
      WHERE c.user_id = ? AND c.deleted_at IS NOT NULL
      ORDER BY c.deleted_at DESC
    `).all(userId);

    res.status(200).json(trashedClips);
  } catch (err) {
    console.error('Fetch recycle clips error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 2. POST /api/clips - Create a new clip
router.post('/', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { name, parent_id, parentId } = req.body;

  const targetParentId = parent_id !== undefined ? parent_id : parentId;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ message: 'Clip name is required' });
  }

  const cleanName = name.trim();

  try {
    const db = getDb();

    // If parent_id provided, verify it exists and belongs to user
    if (targetParentId !== null && targetParentId !== undefined) {
      const parent = db.prepare('SELECT id FROM clips WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(targetParentId, userId);
      if (!parent) {
        return res.status(404).json({ message: 'Parent clip not found' });
      }
    }

    const insert = db.prepare(`
      INSERT INTO clips (user_id, name, parent_id, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `);

    const result = insert.run(userId, cleanName, targetParentId || null);
    const newClipId = result.lastInsertRowid;

    const createdClip = db.prepare(`
      SELECT 
        c.id, 
        c.user_id, 
        c.name, 
        c.parent_id, 
        c.created_at, 
        c.updated_at,
        0 AS item_count,
        0 AS subclip_count
      FROM clips c
      WHERE c.id = ?
    `).get(newClipId);

    res.status(201).json(createdClip);
  } catch (err) {
    console.error('Create clip error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 3. GET /api/clips/bookmark/:bookmarkId - Get clip containing a specific bookmark
router.get('/bookmark/:bookmarkId', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { bookmarkId } = req.params;

  try {
    const db = getDb();
    const bookmark = db.prepare('SELECT id FROM bookmarks WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(bookmarkId, userId);
    if (!bookmark) {
      return res.status(404).json({ message: 'Bookmark not found' });
    }

    const clip = db.prepare(`
      SELECT c.id, c.name, c.parent_id
      FROM clips c
      JOIN clip_bookmarks cb ON c.id = cb.clip_id
      WHERE cb.bookmark_id = ? AND c.user_id = ? AND c.deleted_at IS NULL
    `).get(bookmarkId, userId) as { id: number; name: string; parent_id: number | null } | undefined;

    const clipsList = clip ? [clip] : [];

    res.status(200).json(clipsList);
  } catch (err) {
    console.error('Fetch bookmark clips error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 4. PUT /api/clips/bookmark/:bookmarkId - Assign bookmark to a single clip (or null to unclip)
router.put('/bookmark/:bookmarkId', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { bookmarkId } = req.params;
  const { clip_id, clipId, clip_ids, clipIds } = req.body;

  let targetClipId: number | null = null;
  if (clip_id !== undefined) {
    targetClipId = clip_id ? Number(clip_id) : null;
  } else if (clipId !== undefined) {
    targetClipId = clipId ? Number(clipId) : null;
  } else if (Array.isArray(clip_ids) && clip_ids.length > 0) {
    targetClipId = Number(clip_ids[0]);
  } else if (Array.isArray(clipIds) && clipIds.length > 0) {
    targetClipId = Number(clipIds[0]);
  }

  try {
    const db = getDb();
    const bookmark = db.prepare('SELECT id FROM bookmarks WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(bookmarkId, userId);
    if (!bookmark) {
      return res.status(404).json({ message: 'Bookmark not found' });
    }

    const syncTx = db.transaction(() => {
      // Find old clip if any
      const oldClip = db.prepare(`
        SELECT c.id, c.name 
        FROM clips c
        JOIN clip_bookmarks cb ON c.id = cb.clip_id
        WHERE cb.bookmark_id = ? AND c.user_id = ?
      `).get(bookmarkId, userId) as { id: number; name: string } | undefined;

      // Remove any current clip association for this bookmark
      db.prepare(`
        DELETE FROM clip_bookmarks 
        WHERE bookmark_id = ?
      `).run(bookmarkId);

      if (oldClip) {
        removeTagFromBookmark(db, Number(bookmarkId), oldClip.name);
      }

      // If a valid clipId is specified, ensure it belongs to the user and assign it
      if (targetClipId) {
        const clip = db.prepare('SELECT id, name FROM clips WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(targetClipId, userId) as { id: number; name: string } | undefined;
        if (clip) {
          db.prepare('INSERT INTO clip_bookmarks (clip_id, bookmark_id) VALUES (?, ?)').run(targetClipId, bookmarkId);
          addTagToBookmark(db, Number(bookmarkId), clip.name);
        }
      }
    });

    syncTx();

    const updatedClip = db.prepare(`
      SELECT c.id, c.name, c.parent_id
      FROM clips c
      JOIN clip_bookmarks cb ON c.id = cb.clip_id
      WHERE cb.bookmark_id = ? AND c.user_id = ? AND c.deleted_at IS NULL
    `).get(bookmarkId, userId) as { id: number; name: string; parent_id: number | null } | undefined;

    const clipsList = updatedClip ? [updatedClip] : [];

    res.status(200).json({ message: 'Bookmark clip updated', clip: updatedClip || null, clips: clipsList });
  } catch (err) {
    console.error('Sync bookmark clips error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 5. GET /api/clips/:id - Get clip details, breadcrumbs, subclips, and bookmarks
router.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const db = getDb();
    const clip = db.prepare(`
      SELECT 
        c.id, 
        c.user_id, 
        c.name, 
        c.parent_id, 
        c.created_at, 
        c.updated_at,
        (SELECT COUNT(*) FROM clip_bookmarks cb JOIN bookmarks b ON cb.bookmark_id = b.id WHERE cb.clip_id = c.id AND b.deleted_at IS NULL) AS item_count,
        (SELECT COUNT(*) FROM clips sub WHERE sub.parent_id = c.id AND sub.user_id = c.user_id AND sub.deleted_at IS NULL) AS subclip_count
      FROM clips c
      WHERE c.id = ? AND c.user_id = ? AND c.deleted_at IS NULL
    `).get(id, userId);

    if (!clip) {
      return res.status(404).json({ message: 'Clip not found' });
    }

    const breadcrumbs = getBreadcrumbs(db, Number(id), userId);

    const subclips = db.prepare(`
      SELECT 
        c.id, 
        c.user_id, 
        c.name, 
        c.parent_id, 
        c.created_at, 
        c.updated_at,
        (SELECT COUNT(*) FROM clip_bookmarks cb JOIN bookmarks b ON cb.bookmark_id = b.id WHERE cb.clip_id = c.id AND b.deleted_at IS NULL) AS item_count,
        (SELECT COUNT(*) FROM clips sub WHERE sub.parent_id = c.id AND sub.user_id = c.user_id AND sub.deleted_at IS NULL) AS subclip_count
      FROM clips c
      WHERE c.parent_id = ? AND c.user_id = ? AND c.deleted_at IS NULL
      ORDER BY c.name COLLATE NOCASE ASC
    `).all(id, userId);

    const bookmarks = db.prepare(`
      SELECT b.*
      FROM bookmarks b
      JOIN clip_bookmarks cb ON b.id = cb.bookmark_id
      WHERE cb.clip_id = ? AND b.user_id = ? AND b.deleted_at IS NULL
      ORDER BY cb.created_at DESC, b.created_at DESC
    `).all(id, userId) as any[];

    // Attach tags to bookmarks in a single batch query
    if (bookmarks.length > 0) {
      const bookmarkIds = bookmarks.map((b) => b.id);
      const placeholders = bookmarkIds.map(() => '?').join(',');
      const allTags = db.prepare(`
        SELECT bt.bookmark_id, t.id, t.name 
        FROM tags t
        JOIN bookmark_tags bt ON t.id = bt.tag_id
        WHERE bt.bookmark_id IN (${placeholders})
      `).all(...bookmarkIds) as { bookmark_id: number; id: number; name: string }[];

      const tagMap = new Map<number, { id: number; name: string }[]>();
      for (const t of allTags) {
        if (!tagMap.has(t.bookmark_id)) {
          tagMap.set(t.bookmark_id, []);
        }
        tagMap.get(t.bookmark_id)!.push({ id: t.id, name: t.name });
      }

      for (const b of bookmarks) {
        b.tags = tagMap.get(b.id) || [];
      }
    }

    res.status(200).json({
      clip,
      breadcrumbs,
      subclips,
      bookmarks
    });
  } catch (err) {
    console.error('Fetch clip details error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 6. PUT /api/clips/:id - Update clip name or move to another parent
router.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const clipId = Number(id);
  const { name, parent_id, parentId } = req.body;

  try {
    const db = getDb();
    const existing = db.prepare('SELECT id, name, parent_id FROM clips WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(clipId, userId) as { id: number; name: string; parent_id: number | null } | undefined;

    if (!existing) {
      return res.status(404).json({ message: 'Clip not found' });
    }

    let newName = existing.name;
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ message: 'Clip name cannot be empty' });
      }
      newName = name.trim();
    }

    let newParentId = existing.parent_id;
    const providedParentId = parent_id !== undefined ? parent_id : parentId;
    if (providedParentId !== undefined) {
      if (providedParentId === null || providedParentId === 0 || providedParentId === '') {
        newParentId = null;
      } else {
        const targetPid = Number(providedParentId);
        if (targetPid === clipId) {
          return res.status(400).json({ message: 'A clip cannot be its own parent' });
        }
        // Verify parent belongs to user and is active
        const parentClip = db.prepare('SELECT id FROM clips WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(targetPid, userId);
        if (!parentClip) {
          return res.status(404).json({ message: 'Parent clip not found' });
        }
        // Prevent cycles
        if (isDescendant(db, targetPid, clipId)) {
          return res.status(400).json({ message: 'Cannot move a clip into its own sub-clip (circular nesting)' });
        }
        newParentId = targetPid;
      }
    }

    const updateTx = db.transaction(() => {
      if (newName !== existing.name) {
        const clippedBookmarks = db.prepare('SELECT bookmark_id FROM clip_bookmarks WHERE clip_id = ?').all(clipId) as { bookmark_id: number }[];
        for (const cb of clippedBookmarks) {
          removeTagFromBookmark(db, cb.bookmark_id, existing.name);
          addTagToBookmark(db, cb.bookmark_id, newName);
        }
      }

      db.prepare(`
        UPDATE clips 
        SET name = ?, parent_id = ?, updated_at = datetime('now')
        WHERE id = ? AND user_id = ?
      `).run(newName, newParentId, clipId, userId);
    });

    updateTx();

    const updatedClip = db.prepare(`
      SELECT 
        c.id, 
        c.user_id, 
        c.name, 
        c.parent_id, 
        c.created_at, 
        c.updated_at,
        (SELECT COUNT(*) FROM clip_bookmarks cb WHERE cb.clip_id = c.id) AS item_count,
        (SELECT COUNT(*) FROM clips sub WHERE sub.parent_id = c.id AND sub.user_id = c.user_id AND sub.deleted_at IS NULL) AS subclip_count
      FROM clips c
      WHERE c.id = ?
    `).get(clipId);

    res.status(200).json(updatedClip);
  } catch (err) {
    console.error('Update clip error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 7. DELETE /api/clips/:id - Soft delete a clip (with include_children option)
router.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const clipId = Number(id);

  // Read include_children option (default true)
  const rawInclude = req.query.include_children ?? req.body?.include_children ?? req.body?.includeChildren;
  const includeChildren = rawInclude === undefined ? true : (rawInclude === true || rawInclude === 'true' || rawInclude === '1');

  try {
    const db = getDb();
    const clip = db.prepare('SELECT id, name, parent_id FROM clips WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(clipId, userId) as { id: number; name: string; parent_id: number | null } | undefined;

    if (!clip) {
      return res.status(404).json({ message: 'Clip not found' });
    }

    const softDeleteTx = db.transaction(() => {
      if (includeChildren) {
        // Collect target clip + all recursive descendants
        const targetIds = getDescendantClipIds(db, clipId, userId);
        const placeholders = targetIds.map(() => '?').join(',');

        // Soft delete slips within these clips
        db.prepare(`
          UPDATE bookmarks 
          SET deleted_at = datetime('now'), updated_at = datetime('now')
          WHERE id IN (
            SELECT bookmark_id FROM clip_bookmarks WHERE clip_id IN (${placeholders})
          ) AND user_id = ? AND deleted_at IS NULL
        `).run(...targetIds, userId);

        // Untag bookmarks for all soft-deleted clips
        const clips = db.prepare(`SELECT id, name FROM clips WHERE id IN (${placeholders}) AND user_id = ?`).all(...targetIds, userId) as { id: number; name: string }[];
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

        // Soft delete all target clips
        db.prepare(`
          UPDATE clips 
          SET deleted_at = datetime('now'), updated_at = datetime('now')
          WHERE id IN (${placeholders}) AND user_id = ?
        `).run(...targetIds, userId);
      } else {
        // Promote direct children up to this clip's parent
        db.prepare(`
          UPDATE clips 
          SET parent_id = ?, updated_at = datetime('now')
          WHERE parent_id = ? AND user_id = ? AND deleted_at IS NULL
        `).run(clip.parent_id, clipId, userId);

        // Untag bookmarks for this clip
        const cleanName = clip.name.trim().toLowerCase().replace(/^#/, '');
        if (cleanName) {
          const tagRecord = db.prepare('SELECT id FROM tags WHERE name = ?').get(cleanName) as { id: number } | undefined;
          if (tagRecord) {
            db.prepare(`
              DELETE FROM bookmark_tags 
              WHERE tag_id = ? 
              AND bookmark_id IN (SELECT bookmark_id FROM clip_bookmarks WHERE clip_id = ?)
            `).run(tagRecord.id, clipId);
          }
        }

        // Soft delete only this clip
        db.prepare(`
          UPDATE clips 
          SET deleted_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ? AND user_id = ?
        `).run(clipId, userId);
      }
    });

    softDeleteTx();

    res.status(200).json({ message: 'Clip moved to Recycle Clip successfully', id: clipId, includedChildren: includeChildren });
  } catch (err) {
    console.error('Delete clip error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 7.1 POST /api/clips/:id/restore - Restore a soft-deleted clip
router.post('/:id/restore', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const clipId = Number(id);

  try {
    const db = getDb();
    const clip = db.prepare('SELECT id, name, parent_id FROM clips WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL').get(clipId, userId) as { id: number; name: string; parent_id: number | null } | undefined;

    if (!clip) {
      return res.status(404).json({ message: 'Trashed clip not found' });
    }

    const restoreTx = db.transaction(() => {
      // Check if parent clip is still active; if not or deleted, reset parent_id to null (root)
      let targetParentId = clip.parent_id;
      if (targetParentId !== null) {
        const parent = db.prepare('SELECT id FROM clips WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(targetParentId, userId);
        if (!parent) {
          targetParentId = null;
        }
      }

      // Collect this clip and all its recursive descendant clips
      const targetIds = [clipId];
      const queue = [clipId];
      const visited = new Set<number>([clipId]);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        const children = db.prepare('SELECT id FROM clips WHERE parent_id = ? AND user_id = ?').all(curr, userId) as { id: number }[];
        for (const ch of children) {
          if (!visited.has(ch.id)) {
            visited.add(ch.id);
            targetIds.push(ch.id);
            queue.push(ch.id);
          }
        }
      }
      const placeholders = targetIds.map(() => '?').join(',');

      // Restore clip
      db.prepare(`
        UPDATE clips 
        SET deleted_at = NULL, parent_id = ?, updated_at = datetime('now')
        WHERE id = ? AND user_id = ?
      `).run(targetParentId, clipId, userId);

      // Restore descendant clips if any were deleted
      db.prepare(`
        UPDATE clips 
        SET deleted_at = NULL, updated_at = datetime('now')
        WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NOT NULL
      `).run(...targetIds, userId);

      // Restore any soft-deleted bookmarks that belong to these clips
      db.prepare(`
        UPDATE bookmarks
        SET deleted_at = NULL, updated_at = datetime('now')
        WHERE id IN (
          SELECT bookmark_id FROM clip_bookmarks WHERE clip_id IN (${placeholders})
        ) AND user_id = ? AND deleted_at IS NOT NULL
      `).run(...targetIds, userId);

      // Re-apply tags to all bookmarks in these clips
      for (const cId of targetIds) {
        const c = db.prepare('SELECT name FROM clips WHERE id = ?').get(cId) as { name: string } | undefined;
        if (c) {
          const clippedBookmarks = db.prepare('SELECT bookmark_id FROM clip_bookmarks WHERE clip_id = ?').all(cId) as { bookmark_id: number }[];
          for (const cb of clippedBookmarks) {
            addTagToBookmark(db, cb.bookmark_id, c.name);
          }
        }
      }
    });

    restoreTx();

    const restoredClip = db.prepare(`
      SELECT 
        c.id, 
        c.user_id, 
        c.name, 
        c.parent_id, 
        c.created_at, 
        c.updated_at,
        (SELECT COUNT(*) FROM clip_bookmarks cb JOIN bookmarks b ON cb.bookmark_id = b.id WHERE cb.clip_id = c.id AND b.deleted_at IS NULL) AS item_count,
        (SELECT COUNT(*) FROM clips sub WHERE sub.parent_id = c.id AND sub.user_id = c.user_id AND sub.deleted_at IS NULL) AS subclip_count
      FROM clips c
      WHERE c.id = ?
    `).get(clipId);

    res.status(200).json({ message: 'Clip restored successfully', clip: restoredClip });
  } catch (err) {
    console.error('Restore clip error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 7.2 DELETE /api/clips/:id/permanent - Permanently hard delete a clip
router.delete('/:id/permanent', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const clipId = Number(id);

  try {
    const db = getDb();
    const clip = db.prepare('SELECT id FROM clips WHERE id = ? AND user_id = ?').get(clipId, userId);

    if (!clip) {
      return res.status(404).json({ message: 'Clip not found' });
    }

    db.prepare('DELETE FROM clips WHERE id = ? AND user_id = ?').run(clipId, userId);

    res.status(200).json({ message: 'Clip permanently deleted' });
  } catch (err) {
    console.error('Permanent delete clip error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 8. POST /api/clips/:id/bookmarks - Add bookmark(s) to a clip
router.post('/:id/bookmarks', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { bookmark_id, bookmarkId, bookmark_ids, bookmarkIds } = req.body;

  const clipId = Number(id);

  try {
    const db = getDb();
    const clip = db.prepare('SELECT id, name FROM clips WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(clipId, userId) as { id: number; name: string } | undefined;
    if (!clip) {
      return res.status(404).json({ message: 'Clip not found' });
    }

    let targetIds: number[] = [];
    if (bookmark_id || bookmarkId) {
      targetIds.push(Number(bookmark_id || bookmarkId));
    }
    if (Array.isArray(bookmark_ids)) {
      targetIds.push(...bookmark_ids.map(Number));
    }
    if (Array.isArray(bookmarkIds)) {
      targetIds.push(...bookmarkIds.map(Number));
    }

    targetIds = Array.from(new Set(targetIds)).filter((n) => !isNaN(n) && n > 0);

    if (targetIds.length === 0) {
      return res.status(400).json({ message: 'No valid bookmark IDs provided' });
    }

    const insertTx = db.transaction(() => {
      const insert = db.prepare(`
        INSERT INTO clip_bookmarks (clip_id, bookmark_id) 
        VALUES (?, ?)
        ON CONFLICT(bookmark_id) DO UPDATE SET clip_id = excluded.clip_id
      `);
      for (const bId of targetIds) {
        // Ensure bookmark belongs to user and is not deleted
        const b = db.prepare('SELECT id FROM bookmarks WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(bId, userId);
        if (b) {
          const oldClip = db.prepare(`
            SELECT c.id, c.name 
            FROM clips c
            JOIN clip_bookmarks cb ON c.id = cb.clip_id
            WHERE cb.bookmark_id = ? AND c.user_id = ?
          `).get(bId, userId) as { id: number; name: string } | undefined;

          if (oldClip && oldClip.id !== clipId) {
            removeTagFromBookmark(db, bId, oldClip.name);
          }

          insert.run(clipId, bId);
          addTagToBookmark(db, bId, clip.name);
        }
      }
    });

    insertTx();

    res.status(200).json({ message: 'Bookmarks added to clip successfully' });
  } catch (err) {
    console.error('Add bookmarks to clip error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 9. DELETE /api/clips/:id/bookmarks/:bookmarkId - Remove a bookmark from a clip
router.delete('/:id/bookmarks/:bookmarkId', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id, bookmarkId } = req.params;

  try {
    const db = getDb();
    const clip = db.prepare('SELECT id, name FROM clips WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(id, userId) as { id: number; name: string } | undefined;
    if (!clip) {
      return res.status(404).json({ message: 'Clip not found' });
    }

    const deleteTx = db.transaction(() => {
      const result = db.prepare('DELETE FROM clip_bookmarks WHERE clip_id = ? AND bookmark_id = ?').run(id, bookmarkId);
      if (result.changes > 0) {
        removeTagFromBookmark(db, Number(bookmarkId), clip.name);
        return true;
      }
      return false;
    });

    const deleted = deleteTx();
    if (!deleted) {
      return res.status(404).json({ message: 'Bookmark was not in this clip' });
    }

    res.status(200).json({ message: 'Bookmark removed from clip successfully' });
  } catch (err) {
    console.error('Remove bookmark from clip error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

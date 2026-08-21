import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getDb } from '../db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// --- 1. Authenticated Endpoints (Generating & Revoking Share Links) ---

// Share a single bookmark
router.post('/bookmark/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const db = getDb();
    
    const bookmark = db.prepare('SELECT id FROM bookmarks WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(id, userId);
    if (!bookmark) {
      return res.status(404).json({ message: 'Bookmark not found or unauthorized' });
    }

    const existing = db.prepare('SELECT token FROM shared_links WHERE bookmark_id = ? AND user_id = ?').get(id, userId) as { token: string } | undefined;
    if (existing) {
      return res.status(200).json({
        token: existing.token,
        shareUrl: `/s/${existing.token}`
      });
    }

    const token = crypto.randomBytes(16).toString('hex');
    db.prepare('INSERT INTO shared_links (token, bookmark_id, user_id) VALUES (?, ?, ?)').run(token, id, userId);

    res.status(201).json({
      token,
      shareUrl: `/s/${token}`
    });
  } catch (err) {
    console.error('Share bookmark error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Revoke share for a bookmark
router.delete('/bookmark/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM shared_links WHERE bookmark_id = ? AND user_id = ?').run(id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Share link not found' });
    }

    res.status(200).json({ message: 'Share link revoked successfully' });
  } catch (err) {
    console.error('Revoke bookmark share error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Share a tag collection
router.post('/tag/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const db = getDb();
    
    const tag = db.prepare('SELECT id, name FROM tags WHERE id = ?').get(id) as { id: number; name: string } | undefined;
    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    const existing = db.prepare('SELECT token FROM shared_tags WHERE tag_id = ? AND user_id = ?').get(id, userId) as { token: string } | undefined;
    if (existing) {
      return res.status(200).json({
        token: existing.token,
        shareUrl: `/s/tag/${existing.token}`
      });
    }

    const token = crypto.randomBytes(16).toString('hex');
    db.prepare('INSERT INTO shared_tags (token, tag_id, user_id) VALUES (?, ?, ?)').run(token, id, userId);

    res.status(201).json({
      token,
      shareUrl: `/s/tag/${token}`
    });
  } catch (err) {
    console.error('Share tag error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Revoke share for a tag collection
router.delete('/tag/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM shared_tags WHERE tag_id = ? AND user_id = ?').run(id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Share link not found' });
    }

    res.status(200).json({ message: 'Tag share link revoked successfully' });
  } catch (err) {
    console.error('Revoke tag share error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- 2. Public Read-Only Endpoints (No Auth Required) ---

// Public view for single shared bookmark
router.get('/public/bookmark/:token', (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    const db = getDb();
    const link = db.prepare('SELECT bookmark_id, user_id FROM shared_links WHERE token = ?').get(token) as { bookmark_id: number; user_id: number } | undefined;

    if (!link) {
      return res.status(404).json({ message: 'Shared bookmark link not found or expired' });
    }

    const bookmark = db.prepare(`
      SELECT id, url, title, description, content_type, 
             image_path, favicon_path, reader_html, created_at
      FROM bookmarks WHERE id = ? AND deleted_at IS NULL
    `).get(link.bookmark_id) as any;

    if (!bookmark) {
      return res.status(404).json({ message: 'Bookmark no longer exists' });
    }

    const tags = db.prepare(`
      SELECT t.id, t.name 
      FROM tags t
      JOIN bookmark_tags bt ON t.id = bt.tag_id
      WHERE bt.bookmark_id = ?
    `).all(bookmark.id);

    bookmark.tags = tags;
    res.status(200).json(bookmark);
  } catch (err) {
    console.error('Public bookmark view error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Public view for shared tag collection
router.get('/public/tag/:token', (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    const db = getDb();
    const sharedTag = db.prepare('SELECT tag_id, user_id FROM shared_tags WHERE token = ?').get(token) as { tag_id: number; user_id: number } | undefined;

    if (!sharedTag) {
      return res.status(404).json({ message: 'Shared tag collection not found or expired' });
    }

    const tag = db.prepare('SELECT id, name FROM tags WHERE id = ?').get(sharedTag.tag_id) as { id: number; name: string } | undefined;
    if (!tag) {
      return res.status(404).json({ message: 'Tag no longer exists' });
    }

    const bookmarks = db.prepare(`
      SELECT b.id, b.url, b.title, b.description, b.content_type, 
             b.image_path, b.favicon_path, b.created_at
      FROM bookmarks b
      JOIN bookmark_tags bt ON b.id = bt.bookmark_id
      WHERE bt.tag_id = ? AND b.user_id = ? AND b.deleted_at IS NULL
      ORDER BY b.created_at DESC
    `).all(sharedTag.tag_id, sharedTag.user_id) as any[];

    const tagQuery = db.prepare(`
      SELECT t.id, t.name 
      FROM tags t
      JOIN bookmark_tags bt ON t.id = bt.tag_id
      WHERE bt.bookmark_id = ?
    `);

    for (const b of bookmarks) {
      b.tags = tagQuery.all(b.id);
    }

    res.status(200).json({
      tag: tag.name,
      bookmarks
    });
  } catch (err) {
    console.error('Public tag view error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

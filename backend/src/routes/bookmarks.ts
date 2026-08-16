import { Router, Response } from 'express';
import { getDb } from '../db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { scrapeUrl, ScrapedMetadata } from '../services/scraper';
import { scrapeQueue } from '../services/queue';
import { cacheThumbnail } from '../services/thumbnail';

const router = Router();

router.use(authenticate);

// 1. Get All Bookmarks (Filtered by user, optional contentType or tag)
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { contentType, tag, limit = 50, offset = 0 } = req.query;

  try {
    const db = getDb();
    let query = `
      SELECT b.id, b.user_id, b.url, b.title, b.description, b.content_type, 
             b.image_path, b.favicon_path, b.created_at, b.updated_at
      FROM bookmarks b
    `;
    const params: any[] = [userId];

    if (tag) {
      query += `
        JOIN bookmark_tags bt ON b.id = bt.bookmark_id
        JOIN tags t ON bt.tag_id = t.id
        WHERE b.user_id = ? AND t.name = ?
      `;
      params.push(tag);
    } else {
      query += ` WHERE b.user_id = ?`;
    }

    if (contentType) {
      query += ` AND b.content_type = ?`;
      params.push(contentType);
    }

    query += ` ORDER BY b.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const bookmarks = db.prepare(query).all(...params) as any[];

    // Attach tags for each bookmark
    const tagQuery = db.prepare(`
      SELECT t.id, t.name 
      FROM tags t
      JOIN bookmark_tags bt ON t.id = bt.tag_id
      WHERE bt.bookmark_id = ?
    `);

    for (const b of bookmarks) {
      b.tags = tagQuery.all(b.id);
    }

    res.status(200).json(bookmarks);
  } catch (err) {
    console.error('Fetch bookmarks error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 2. Get Tags for User with Bookmark Counts
router.get('/tags', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const db = getDb();
    const tags = db.prepare(`
      SELECT t.id, t.name, COUNT(bt.bookmark_id) as count
      FROM tags t
      JOIN bookmark_tags bt ON t.id = bt.tag_id
      JOIN bookmarks b ON bt.bookmark_id = b.id
      WHERE b.user_id = ?
      GROUP BY t.id, t.name
      ORDER BY count DESC, t.name ASC
    `).all(userId);

    res.status(200).json(tags);
  } catch (err) {
    console.error('Fetch tags error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 3. Search Bookmarks (Full-Text Search with snippet highlighting and fallback)
router.get('/search', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { q, limit = 50, offset = 0 } = req.query;

  if (!q || typeof q !== 'string' || q.trim() === '') {
    return res.status(200).json([]);
  }

  const cleanQuery = q.trim();
  const db = getDb();

  try {
    const terms = cleanQuery
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 0);

    const sanitizedTerms = terms.map(term => `${term}*`).join(' ');

    let bookmarks: any[] = [];

    if (sanitizedTerms) {
      try {
        const ftsQuery = `
          SELECT b.id, b.user_id, b.url, b.title, b.description, b.content_type, 
                 b.image_path, b.favicon_path, b.created_at, b.updated_at,
                 snippet(bookmarks_fts, -1, '<mark>', '</mark>', '...', 25) as snippet,
                 bm25(bookmarks_fts) as rank
          FROM bookmarks_fts
          JOIN bookmarks b ON bookmarks_fts.rowid = b.id
          WHERE bookmarks_fts MATCH ? AND b.user_id = ?
          ORDER BY rank ASC
          LIMIT ? OFFSET ?
        `;
        bookmarks = db.prepare(ftsQuery).all(sanitizedTerms, userId, Number(limit), Number(offset)) as any[];
      } catch (ftsErr) {
        console.warn('FTS5 query error, falling back to LIKE:', ftsErr);
      }
    }

    if (bookmarks.length === 0 && terms.length > 0) {
      const conditions = terms.map(() => '(b.title LIKE ? OR b.description LIKE ? OR b.raw_text LIKE ?)').join(' AND ');
      const params: any[] = [userId];
      for (const w of terms) {
        const p = `%${w}%`;
        params.push(p, p, p);
      }
      params.push(Number(limit), Number(offset));

      const likeQuery = `
        SELECT b.id, b.user_id, b.url, b.title, b.description, b.content_type, 
               b.image_path, b.favicon_path, b.created_at, b.updated_at
        FROM bookmarks b
        WHERE b.user_id = ? AND (${conditions})
        ORDER BY b.created_at DESC
        LIMIT ? OFFSET ?
      `;
      bookmarks = db.prepare(likeQuery).all(...params) as any[];
    }

    const tagQuery = db.prepare(`
      SELECT t.id, t.name 
      FROM tags t
      JOIN bookmark_tags bt ON t.id = bt.tag_id
      WHERE bt.bookmark_id = ?
    `);

    for (const b of bookmarks) {
      b.tags = tagQuery.all(b.id);
    }

    res.status(200).json(bookmarks);
  } catch (err) {
    console.error('Search bookmarks error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 4. Get Single Bookmark by ID
router.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const db = getDb();
    const bookmark = db.prepare(`
      SELECT * FROM bookmarks WHERE id = ? AND user_id = ?
    `).get(id, userId) as any;

    if (!bookmark) {
      return res.status(404).json({ message: 'Bookmark not found' });
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
    console.error('Fetch bookmark details error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 4. Create Bookmark
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { url, title, description, tags, contentType, imageUrl, faviconUrl, readerHtml } = req.body;

  if (!url) {
    return res.status(400).json({ message: 'URL is required' });
  }

  try {
    let scraped: Partial<ScrapedMetadata> = {};

    if (!title) {
      try {
        scraped = await scrapeQueue.add(() => scrapeUrl(url));
      } catch (err) {
        console.warn('Scraping fallback failed, proceeding with basic URL:', err);
      }
    }

    const finalTitle = title || scraped.title || new URL(url).hostname;
    const finalDesc = description !== undefined ? description : (scraped.description || '');
    const finalContentType = contentType || scraped.contentType || 'website';
    const finalReaderHtml = readerHtml !== undefined ? readerHtml : (scraped.readerHtml || null);
    const finalRawText = scraped.rawText || finalDesc || finalTitle;
    const finalImageUrl = imageUrl || scraped.imageUrl || null;
    const finalFaviconUrl = faviconUrl || scraped.faviconUrl || null;

    let thumbnailPath: string | null = null;
    if (finalImageUrl) {
      thumbnailPath = await cacheThumbnail(finalImageUrl);
    }

    const db = getDb();

    const insertTransaction = db.transaction(() => {
      const insertBookmark = db.prepare(`
        INSERT INTO bookmarks (
          user_id, url, title, description, content_type, 
          reader_html, raw_text, image_path, favicon_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = insertBookmark.run(
        userId,
        url,
        finalTitle,
        finalDesc,
        finalContentType,
        finalReaderHtml,
        finalRawText,
        thumbnailPath || finalImageUrl,
        finalFaviconUrl
      );

      const bookmarkId = result.lastInsertRowid;

      if (Array.isArray(tags) && tags.length > 0) {
        const findOrCreateTag = db.prepare(`
          INSERT INTO tags (name) VALUES (?)
          ON CONFLICT(name) DO UPDATE SET name=excluded.name
          RETURNING id
        `);

        const linkTag = db.prepare(`
          INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)
        `);

        for (const tagName of tags) {
          const cleanName = tagName.trim();
          if (cleanName) {
            const tagRecord = findOrCreateTag.get(cleanName) as { id: number };
            linkTag.run(bookmarkId, tagRecord.id);
          }
        }
      }

      return bookmarkId;
    });

    const newBookmarkId = insertTransaction();

    const createdBookmark = db.prepare(`SELECT * FROM bookmarks WHERE id = ?`).get(newBookmarkId) as any;
    const attachedTags = db.prepare(`
      SELECT t.id, t.name FROM tags t
      JOIN bookmark_tags bt ON t.id = bt.tag_id
      WHERE bt.bookmark_id = ?
    `).all(newBookmarkId);

    createdBookmark.tags = attachedTags;

    res.status(201).json(createdBookmark);
  } catch (err) {
    console.error('Create bookmark error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 5. Update Bookmark
router.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { title, description, contentType, tags } = req.body;

  try {
    const db = getDb();

    const existing = db.prepare(`SELECT id FROM bookmarks WHERE id = ? AND user_id = ?`).get(id, userId);
    if (!existing) {
      return res.status(404).json({ message: 'Bookmark not found or unauthorized' });
    }

    const updateTransaction = db.transaction(() => {
      const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
      const params: any[] = [];

      if (title !== undefined) {
        updates.push('title = ?');
        params.push(title);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
      }
      if (contentType !== undefined) {
        updates.push('content_type = ?');
        params.push(contentType);
      }

      params.push(id, userId);
      db.prepare(`UPDATE bookmarks SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);

      if (Array.isArray(tags)) {
        db.prepare(`DELETE FROM bookmark_tags WHERE bookmark_id = ?`).run(id);

        const findOrCreateTag = db.prepare(`
          INSERT INTO tags (name) VALUES (?)
          ON CONFLICT(name) DO UPDATE SET name=excluded.name
          RETURNING id
        `);

        const linkTag = db.prepare(`
          INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)
        `);

        for (const tagName of tags) {
          const cleanName = tagName.trim();
          if (cleanName) {
            const tagRecord = findOrCreateTag.get(cleanName) as { id: number };
            linkTag.run(id, tagRecord.id);
          }
        }
      }
    });

    updateTransaction();

    const updated = db.prepare(`SELECT * FROM bookmarks WHERE id = ?`).get(id) as any;
    const attachedTags = db.prepare(`
      SELECT t.id, t.name FROM tags t
      JOIN bookmark_tags bt ON t.id = bt.tag_id
      WHERE bt.bookmark_id = ?
    `).all(id);

    updated.tags = attachedTags;

    res.status(200).json(updated);
  } catch (err) {
    console.error('Update bookmark error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 6. Delete Bookmark
router.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const db = getDb();
    const result = db.prepare(`DELETE FROM bookmarks WHERE id = ? AND user_id = ?`).run(id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Bookmark not found or unauthorized' });
    }

    res.status(200).json({ message: 'Bookmark deleted successfully' });
  } catch (err) {
    console.error('Delete bookmark error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 7. Re-scrape Bookmark Metadata
router.post('/:id/rescrape', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const db = getDb();
    const existing = db.prepare(`SELECT * FROM bookmarks WHERE id = ? AND user_id = ?`).get(id, userId) as any;

    if (!existing) {
      return res.status(404).json({ message: 'Bookmark not found or unauthorized' });
    }

    const scraped = await scrapeUrl(existing.url);
    let cachedImagePath = existing.image_path;

    if (scraped.imageUrl) {
      try {
        cachedImagePath = await cacheThumbnail(scraped.imageUrl);
      } catch {
        cachedImagePath = scraped.imageUrl;
      }
    }

    db.prepare(`
      UPDATE bookmarks SET
        title = ?,
        description = ?,
        content_type = ?,
        reader_html = ?,
        raw_text = ?,
        image_path = ?,
        favicon_path = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      scraped.title || existing.title,
      scraped.description || existing.description,
      scraped.contentType || existing.content_type,
      scraped.readerHtml || existing.reader_html,
      scraped.rawText || existing.raw_text,
      cachedImagePath,
      scraped.faviconUrl || existing.favicon_path,
      id
    );

    const updated = db.prepare(`SELECT * FROM bookmarks WHERE id = ?`).get(id) as any;
    const attachedTags = db.prepare(`
      SELECT t.id, t.name FROM tags t
      JOIN bookmark_tags bt ON t.id = bt.tag_id
      WHERE bt.bookmark_id = ?
    `).all(id);

    updated.tags = attachedTags;
    res.status(200).json(updated);
  } catch (err: any) {
    console.error('Rescrape bookmark error:', err);
    res.status(500).json({ message: err.message || 'Failed to rescrape bookmark' });
  }
});

// 8. Global Re-scrape All User Bookmarks
router.post('/rescrape-all', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const db = getDb();
    const userBookmarks = db.prepare(`SELECT id, url, title, description, content_type, image_path, favicon_path FROM bookmarks WHERE user_id = ?`).all(userId) as any[];

    if (userBookmarks.length === 0) {
      return res.status(200).json({ message: 'No bookmarks to rescrape', count: 0 });
    }

    // Queue all bookmarks into background scrapeQueue
    for (const b of userBookmarks) {
      scrapeQueue.add(async () => {
        try {
          const scraped = await scrapeUrl(b.url);
          let cachedImagePath = b.image_path;
          if (scraped.imageUrl) {
            try {
              cachedImagePath = await cacheThumbnail(scraped.imageUrl);
            } catch {
              cachedImagePath = scraped.imageUrl;
            }
          }

          db.prepare(`
            UPDATE bookmarks SET
              title = ?,
              description = ?,
              content_type = ?,
              reader_html = ?,
              raw_text = ?,
              image_path = ?,
              favicon_path = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            scraped.title || b.title,
            scraped.description || b.description,
            scraped.contentType || b.content_type,
            scraped.readerHtml,
            scraped.rawText || scraped.description || scraped.title,
            cachedImagePath,
            scraped.faviconUrl || b.favicon_path,
            b.id
          );
        } catch (queueErr) {
          console.error(`Failed to rescrape bookmark ID ${b.id}:`, queueErr);
        }
      });
    }

    res.status(202).json({
      message: `Global re-scrape initiated for ${userBookmarks.length} bookmarks`,
      count: userBookmarks.length
    });
  } catch (err: any) {
    console.error('Global rescrape error:', err);
    res.status(500).json({ message: err.message || 'Failed to start global rescrape' });
  }
});

export default router;

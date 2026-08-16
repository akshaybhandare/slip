import { Router, Response } from 'express';
import { getDb } from '../db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { parseNetscapeHtml, generateNetscapeHtml, BookmarkExportItem } from '../services/netscape';
import { scrapeUrl } from '../services/scraper';
import { scrapeQueue } from '../services/queue';
import { cacheThumbnail } from '../services/thumbnail';

const router = Router();

router.use(authenticate);

// 1. Batch Import Netscape HTML
router.post('/import', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const htmlContent = typeof req.body === 'string' ? req.body : req.body.html;

  if (!htmlContent || typeof htmlContent !== 'string' || htmlContent.trim().length === 0) {
    return res.status(400).json({ message: 'Netscape bookmark HTML content is required' });
  }

  try {
    const parsedItems = parseNetscapeHtml(htmlContent);

    if (parsedItems.length === 0) {
      return res.status(400).json({ message: 'No valid HTTP/HTTPS bookmarks found in HTML content' });
    }

    const db = getDb();
    const importedIds: number[] = [];

    const importTransaction = db.transaction(() => {
      const insertBookmark = db.prepare(`
        INSERT INTO bookmarks (
          user_id, url, title, description, content_type, raw_text, created_at
        ) VALUES (?, ?, ?, ?, 'website', ?, COALESCE(?, datetime('now')))
      `);

      const findOrCreateTag = db.prepare(`
        INSERT INTO tags (name) VALUES (?)
        ON CONFLICT(name) DO UPDATE SET name=excluded.name
        RETURNING id
      `);

      const linkTag = db.prepare(`
        INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)
      `);

      for (const item of parsedItems) {
        const title = item.title || new URL(item.url).hostname;
        const description = item.description || '';
        const rawText = description || title;

        const result = insertBookmark.run(
          userId,
          item.url,
          title,
          description,
          rawText,
          item.created_at || null
        );

        const bookmarkId = result.lastInsertRowid as number;
        importedIds.push(bookmarkId);

        for (const tagName of item.tags) {
          const cleanName = tagName.trim();
          if (cleanName) {
            const tagRecord = findOrCreateTag.get(cleanName) as { id: number };
            linkTag.run(bookmarkId, tagRecord.id);
          }
        }
      }
    });

    importTransaction();

    // Trigger background metadata / thumbnail enrichment without blocking HTTP response
    if (process.env.NODE_ENV !== 'test') {
      for (const id of importedIds) {
        scrapeQueue.add(async () => {
          try {
            const bm = db.prepare('SELECT url, image_path FROM bookmarks WHERE id = ?').get(id) as { url: string; image_path: string | null } | undefined;
            if (bm && !bm.image_path) {
              const metadata = await scrapeUrl(bm.url);
              let thumbPath: string | null = null;
              if (metadata.imageUrl) {
                thumbPath = await cacheThumbnail(metadata.imageUrl);
              }
              db.prepare(`
                UPDATE bookmarks SET 
                  image_path = COALESCE(?, image_path),
                  favicon_path = COALESCE(?, favicon_path),
                  content_type = COALESCE(?, content_type),
                  reader_html = COALESCE(?, reader_html),
                  raw_text = COALESCE(?, raw_text)
                WHERE id = ?
              `).run(thumbPath || metadata.imageUrl, metadata.faviconUrl, metadata.contentType, metadata.readerHtml, metadata.rawText, id);
            }
          } catch (err) {
            // Graceful background failure
          }
        });
      }
    }

    res.status(201).json({
      message: `Successfully imported ${importedIds.length} bookmarks`,
      importedCount: importedIds.length
    });
  } catch (err) {
    console.error('Import bookmarks error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 2. Export All Bookmarks as Netscape HTML
router.get('/export', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const db = getDb();
    const bookmarks = db.prepare(`
      SELECT id, url, title, description, created_at
      FROM bookmarks
      WHERE user_id = ?
      ORDER BY created_at ASC
    `).all(userId) as BookmarkExportItem[];

    const tagQuery = db.prepare(`
      SELECT t.id, t.name 
      FROM tags t
      JOIN bookmark_tags bt ON t.id = bt.tag_id
      WHERE bt.bookmark_id = ?
    `);

    for (const b of bookmarks) {
      b.tags = tagQuery.all(b.id) as { id: number; name: string }[];
    }

    const htmlOutput = generateNetscapeHtml(bookmarks);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="slip_bookmarks_export.html"');
    res.status(200).send(htmlOutput);
  } catch (err) {
    console.error('Export bookmarks error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

import { Router, Response } from 'express';
import crypto from 'crypto';
import { getDb } from '../db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { scrapeUrl, ScrapedMetadata, extractPlatformTag } from '../services/scraper';
import { scrapeQueue } from '../services/queue';
import { cacheThumbnail, saveUploadedFile, saveUploadedImage } from '../services/thumbnail';
import { autoTagBookmark } from '../services/aiService';

const router = Router();

router.use(authenticate);

async function handleFileUpload(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;

  try {
    let fileBuffer: Buffer | null = null;
    let filename: string | undefined;
    let title: string | undefined;
    let description: string = '';
    let personalNote: string | undefined;
    let tagsInput: any = [];

    // Case 1: Raw binary buffer (Content-Type: image/*, application/pdf, application/octet-stream)
    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      fileBuffer = req.body;
      const rawHeaderName = (req.headers['x-file-name'] as string) || (req.headers['x-filename'] as string) || (req.headers['content-disposition'] || '');
      const match = /filename="?([^";]+)"?/i.exec(rawHeaderName);
      filename = (req.headers['x-file-name'] as string) || (req.headers['x-filename'] as string) || (match ? match[1] : undefined);
      title = (req.headers['x-file-title'] as string) || (req.headers['x-title'] as string) || undefined;
      description = (req.headers['x-file-description'] as string) || (req.headers['x-description'] as string) || '';
      const rawTags = (req.headers['x-file-tags'] as string) || (req.headers['x-tags'] as string);
      if (rawTags) {
        tagsInput = rawTags.split(',').map((t) => t.trim()).filter(Boolean);
      }
    }
    // Case 2: JSON payload with Base64 data
    else if (req.body && (req.body.image_data || req.body.imageData || req.body.file_data || req.body.fileData || req.body.image || req.body.file)) {
      const rawData = req.body.file_data || req.body.fileData || req.body.image_data || req.body.imageData || req.body.image || req.body.file;
      filename = req.body.filename || req.body.fileName;
      title = req.body.title;
      description = req.body.description || '';
      personalNote = req.body.personal_note || req.body.personalNote;
      tagsInput = req.body.tags || [];

      if (typeof rawData === 'string') {
        const base64Data = rawData.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');
        fileBuffer = Buffer.from(base64Data, 'base64');
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ message: 'No valid file data provided. Provide base64 file data in JSON or raw binary body.' });
    }

    const { filePath, imagePath, mimeType, contentType, size } = saveUploadedFile(fileBuffer, filename);

    // Compute clean title
    let finalTitle = title ? title.trim() : '';
    if (!finalTitle && filename) {
      finalTitle = filename.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
    }
    if (!finalTitle) {
      const label = contentType === 'document' ? 'Document' : 'Image';
      finalTitle = `${label} ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }

    const finalUrl = filePath;
    const finalDesc = description || `Uploaded ${contentType === 'document' ? 'document' : 'image'} (${(size / (1024 * 1024)).toFixed(2)} MB, ${mimeType})`;
    const finalRawText = `${finalTitle} ${finalDesc} ${filename || ''}`;

    const db = getDb();
    const insertTransaction = db.transaction(() => {
      const insertBookmark = db.prepare(`
        INSERT INTO bookmarks (
          user_id, url, title, description, personal_note, content_type, 
          reader_html, raw_text, image_path, favicon_path
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)
      `);

      const result = insertBookmark.run(
        userId,
        finalUrl,
        finalTitle,
        finalDesc,
        personalNote || null,
        contentType,
        finalRawText,
        imagePath
      );

      const bookmarkId = result.lastInsertRowid;

      const tagSet = new Set<string>();
      if (Array.isArray(tagsInput)) {
        for (const t of tagsInput) {
          const clean = String(t).trim().toLowerCase().replace(/^#/, '');
          if (clean) tagSet.add(clean);
        }
      } else if (typeof tagsInput === 'string') {
        for (const t of tagsInput.split(',')) {
          const clean = t.trim().toLowerCase().replace(/^#/, '');
          if (clean) tagSet.add(clean);
        }
      }

      if (contentType === 'document') {
        tagSet.add('document');
        tagSet.add('pdf');
      } else {
        tagSet.add('image');
      }

      if (tagSet.size > 0) {
        const findOrCreateTag = db.prepare(`
          INSERT INTO tags (name) VALUES (?)
          ON CONFLICT(name) DO UPDATE SET name=excluded.name
          RETURNING id
        `);

        const linkTag = db.prepare(`
          INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)
        `);

        for (const cleanName of tagSet) {
          const tagRecord = findOrCreateTag.get(cleanName) as { id: number };
          linkTag.run(bookmarkId, tagRecord.id);
        }
      }

      return { bookmarkId, tagSet: Array.from(tagSet) };
    });

    const { bookmarkId, tagSet } = insertTransaction();

    const createdBookmark = db.prepare(`
      SELECT id, user_id, url, title, description, personal_note, content_type, 
             image_path, favicon_path, created_at, updated_at
      FROM bookmarks WHERE id = ?
    `).get(bookmarkId) as any;

    createdBookmark.tags = tagSet;

    return res.status(201).json(createdBookmark);
  } catch (err: any) {
    console.error('File upload error:', err);
    return res.status(400).json({ message: err.message || 'Failed to upload file' });
  }
}

async function handleNoteCreation(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const { title, content, note, personalNote, description, tags } = req.body;

  const noteContent = (content || note || personalNote || '').trim();
  let noteTitle = (title || '').trim();

  if (!noteTitle && noteContent) {
    // Extract first line as title
    noteTitle = noteContent.split('\n')[0].replace(/^[#*`\s-]+/, '').trim().slice(0, 80);
  }
  if (!noteTitle) {
    noteTitle = `Note ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  const finalDesc = description !== undefined ? description : (noteContent ? noteContent.replace(/\n+/g, ' ').slice(0, 200) : '');
  const noteId = `slip://note/${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const rawText = `${noteTitle}\n${noteContent}`;

  try {
    const db = getDb();
    const insertTransaction = db.transaction(() => {
      const insertBookmark = db.prepare(`
        INSERT INTO bookmarks (
          user_id, url, title, description, personal_note, content_type, 
          reader_html, raw_text, image_path, favicon_path
        ) VALUES (?, ?, ?, ?, ?, 'note', NULL, ?, NULL, NULL)
      `);

      const result = insertBookmark.run(
        userId,
        noteId,
        noteTitle,
        finalDesc,
        noteContent,
        rawText
      );

      const bookmarkId = result.lastInsertRowid;

      const tagSet = new Set<string>();
      if (Array.isArray(tags)) {
        for (const t of tags) {
          const clean = String(t).trim().toLowerCase().replace(/^#/, '');
          if (clean) tagSet.add(clean);
        }
      } else if (typeof tags === 'string') {
        for (const t of tags.split(',')) {
          const clean = t.trim().toLowerCase().replace(/^#/, '');
          if (clean) tagSet.add(clean);
        }
      }

      tagSet.add('note');

      if (tagSet.size > 0) {
        const findOrCreateTag = db.prepare(`
          INSERT INTO tags (name) VALUES (?)
          ON CONFLICT(name) DO UPDATE SET name=excluded.name
          RETURNING id
        `);

        const linkTag = db.prepare(`
          INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)
        `);

        for (const cleanName of tagSet) {
          const tagRecord = findOrCreateTag.get(cleanName) as { id: number };
          linkTag.run(bookmarkId, tagRecord.id);
        }
      }

      return { bookmarkId, tagSet: Array.from(tagSet) };
    });

    const { bookmarkId, tagSet } = insertTransaction();
    const finalTagSet = new Set<string>(tagSet);

    // Auto-tag note with AI if user did not specify explicit tags
    const hasCustomTags = Array.isArray(tags) ? tags.length > 0 : Boolean(tags && String(tags).trim());
    if (!hasCustomTags) {
      try {
        const autoResult = await autoTagBookmark({ bookmarkId, userId, force: false });
        if (autoResult && autoResult.tags) {
          for (const t of autoResult.tags) {
            finalTagSet.add(t.name);
          }
        }
      } catch (aiErr) {
        console.warn('AI auto-tag for note creation failed:', aiErr);
      }
    }

    const createdBookmark = db.prepare(`
      SELECT id, user_id, url, title, description, personal_note, content_type, 
             image_path, favicon_path, created_at, updated_at
      FROM bookmarks WHERE id = ?
    `).get(bookmarkId) as any;

    createdBookmark.tags = Array.from(finalTagSet);

    return res.status(201).json(createdBookmark);
  } catch (err: any) {
    console.error('Create note error:', err);
    return res.status(400).json({ message: err.message || 'Failed to create note' });
  }
}

// 3.5 Upload File (Image or PDF) Bookmark & Note Endpoints
const handleImageUpload = handleFileUpload;
router.post('/upload', handleFileUpload);
router.post('/note', handleNoteCreation);


// 1. Get All Bookmarks (Filtered by user, optional contentType or tag)
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { contentType, tag, limit = 50, offset = 0 } = req.query;

  try {
    const db = getDb();
    let query = `
      SELECT b.id, b.user_id, b.url, b.title, b.description, b.personal_note, b.content_type, 
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
          SELECT b.id, b.user_id, b.url, b.title, b.description, b.personal_note, b.content_type, 
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
      const conditions = terms.map(() => '(b.title LIKE ? OR b.description LIKE ? OR b.personal_note LIKE ? OR b.raw_text LIKE ?)').join(' AND ');
      const params: any[] = [userId];
      for (const w of terms) {
        const p = `%${w}%`;
        params.push(p, p, p, p);
      }
      params.push(Number(limit), Number(offset));

      const likeQuery = `
        SELECT b.id, b.user_id, b.url, b.title, b.description, b.personal_note, b.content_type, 
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
  if (!req.body?.url && (req.body?.image_data || req.body?.imageData || req.body?.file_data || req.body?.fileData || req.body?.image || req.body?.file || Buffer.isBuffer(req.body))) {
    return handleFileUpload(req, res);
  }

  if (
    req.body?.contentType === 'note' ||
    req.body?.content_type === 'note' ||
    (!req.body?.url && (req.body?.content || req.body?.note))
  ) {
    return handleNoteCreation(req, res);
  }

  const userId = req.user!.id;
  const { url, title, description, tags, contentType, imageUrl, faviconUrl, readerHtml } = req.body;

  if (!url) {
    return res.status(400).json({ message: 'URL is required' });
  }

  const isInternalUrl = /^(slip|local|file|data):\/\//i.test(url) || url.startsWith('/api/cache');

  try {
    let scraped: Partial<ScrapedMetadata> = {};

    if (!title && !isInternalUrl) {
      try {
        scraped = await scrapeQueue.add(() => scrapeUrl(url));
      } catch (err) {
        console.warn('Scraping fallback failed, proceeding with basic URL:', err);
      }
    }

    let defaultHostname = '';
    try {
      defaultHostname = new URL(url).hostname;
    } catch {
      defaultHostname = url;
    }

    const finalTitle = title || scraped.title || defaultHostname;
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

      const tagSet = new Set<string>();
      if (Array.isArray(tags)) {
        for (const t of tags) {
          const clean = t.trim().toLowerCase().replace(/^#/, '');
          if (clean) tagSet.add(clean);
        }
      }
      const platformTag = extractPlatformTag(url);
      if (platformTag) {
        tagSet.add(platformTag);
      }

      if (tagSet.size > 0) {
        const findOrCreateTag = db.prepare(`
          INSERT INTO tags (name) VALUES (?)
          ON CONFLICT(name) DO UPDATE SET name=excluded.name
          RETURNING id
        `);

        const linkTag = db.prepare(`
          INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)
        `);

        for (const cleanName of tagSet) {
          const tagRecord = findOrCreateTag.get(cleanName) as { id: number };
          linkTag.run(bookmarkId, tagRecord.id);
        }
      }

      return bookmarkId;
    });

    const newBookmarkId = insertTransaction();

    // Auto-tag with AI if user did not provide custom tags
    const hasCustomTags = Array.isArray(tags) ? tags.length > 0 : Boolean(tags && String(tags).trim());
    if (!hasCustomTags) {
      try {
        await autoTagBookmark({ bookmarkId: newBookmarkId, userId, force: false });
      } catch (aiErr) {
        console.warn('AI auto-tag for bookmark creation failed:', aiErr);
      }
    }

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
  const { title, description, personalNote, contentType, tags } = req.body;

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
      if (personalNote !== undefined) {
        updates.push('personal_note = ?');
        params.push(personalNote);
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

// 5.1 Quick Update Personal Sticky Note
router.put('/:id/note', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { note } = req.body;

  try {
    const db = getDb();
    const result = db.prepare(`
      UPDATE bookmarks SET personal_note = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(note !== undefined ? note : null, id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Bookmark not found or unauthorized' });
    }

    const updated = db.prepare(`SELECT * FROM bookmarks WHERE id = ?`).get(id) as any;
    const attachedTags = db.prepare(`
      SELECT t.id, t.name FROM tags t
      JOIN bookmark_tags bt ON t.id = bt.tag_id
      WHERE bt.bookmark_id = ?
    `).all(id);
    updated.tags = attachedTags;

    res.status(200).json(updated);
  } catch (err) {
    console.error('Update note error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 5.2 Get Highlights for Bookmark
router.get('/:id/highlights', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const db = getDb();
    const highlights = db.prepare(`
      SELECT * FROM highlights WHERE bookmark_id = ? AND user_id = ? ORDER BY created_at ASC
    `).all(id, userId);

    res.status(200).json(highlights);
  } catch (err) {
    console.error('Get highlights error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 5.3 Add Text Highlight to Bookmark
router.post('/:id/highlights', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { text, color = 'yellow', note } = req.body;

  if (!text || typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({ message: 'Highlight text is required' });
  }

  try {
    const db = getDb();
    const bm = db.prepare('SELECT id FROM bookmarks WHERE id = ? AND user_id = ?').get(id, userId);
    if (!bm) {
      return res.status(404).json({ message: 'Bookmark not found or unauthorized' });
    }

    const result = db.prepare(`
      INSERT INTO highlights (bookmark_id, user_id, text, color, note)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, text.trim(), color, note || null);

    const created = db.prepare('SELECT * FROM highlights WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    console.error('Create highlight error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 5.4 Delete Text Highlight
router.delete('/:id/highlights/:highlightId', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id, highlightId } = req.params;

  try {
    const db = getDb();
    const result = db.prepare(`
      DELETE FROM highlights WHERE id = ? AND bookmark_id = ? AND user_id = ?
    `).run(highlightId, id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Highlight not found or unauthorized' });
    }

    res.status(200).json({ message: 'Highlight deleted successfully' });
  } catch (err) {
    console.error('Delete highlight error:', err);
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

    if (
      !existing.url ||
      !/^https?:\/\//i.test(existing.url) ||
      ['note', 'document', 'image'].includes(existing.content_type)
    ) {
      return res.status(400).json({ message: 'Cannot re-scrape notes or uploaded files' });
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

    const platformTag = extractPlatformTag(existing.url);
    if (platformTag) {
      const tagRecord = db.prepare(`
        INSERT INTO tags (name) VALUES (?)
        ON CONFLICT(name) DO UPDATE SET name=excluded.name
        RETURNING id
      `).get(platformTag) as { id: number };

      db.prepare(`
        INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)
      `).run(id, tagRecord.id);
    }

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

// 7.5 Auto-tag Bookmark with AI
router.post('/:id/auto-tag', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const db = getDb();
    const existing = db.prepare(`SELECT * FROM bookmarks WHERE id = ? AND user_id = ?`).get(id, userId) as any;
    if (!existing) {
      return res.status(404).json({ message: 'Bookmark not found or unauthorized' });
    }

    const result = await autoTagBookmark({
      bookmarkId: Number(id),
      userId,
      force: true
    });

    const updated = db.prepare(`SELECT * FROM bookmarks WHERE id = ?`).get(id) as any;
    const attachedTags = db.prepare(`
      SELECT t.id, t.name FROM tags t
      JOIN bookmark_tags bt ON t.id = bt.tag_id
      WHERE bt.bookmark_id = ?
    `).all(id);

    updated.tags = attachedTags;
    res.status(200).json(updated);
  } catch (err: any) {
    console.error('Auto-tag bookmark error:', err);
    res.status(500).json({ message: err.message || 'Failed to auto-tag bookmark' });
  }
});

// 8. Global Re-scrape All User Bookmarks & AI Auto-tag Untagged Items
router.post('/rescrape-all', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const db = getDb();
    const userBookmarks = db.prepare(`
      SELECT id, url, title, description, content_type, image_path, favicon_path 
      FROM bookmarks 
      WHERE user_id = ?
        AND url IS NOT NULL
        AND (url LIKE 'http://%' OR url LIKE 'https://%')
        AND content_type NOT IN ('note', 'document', 'image')
    `).all(userId) as any[];

    const untaggedNotes = db.prepare(`
      SELECT b.id, b.url, b.title, b.description, b.content_type
      FROM bookmarks b
      LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
      LEFT JOIN tags t ON bt.tag_id = t.id AND t.name != 'note'
      WHERE b.user_id = ? AND b.content_type = 'note'
      GROUP BY b.id
      HAVING COUNT(t.id) = 0
    `).all(userId) as any[];

    if (userBookmarks.length === 0 && untaggedNotes.length === 0) {
      return res.status(200).json({ message: 'No bookmarks to sync', count: 0 });
    }

    // Queue web bookmarks into background scrapeQueue with auto-tagging hook
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

          const platformTag = extractPlatformTag(b.url);
          if (platformTag) {
            const tagRecord = db.prepare(`
              INSERT INTO tags (name) VALUES (?)
              ON CONFLICT(name) DO UPDATE SET name=excluded.name
              RETURNING id
            `).get(platformTag) as { id: number };

            db.prepare(`
              INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)
            `).run(b.id, tagRecord.id);
          }

          // Hook in auto-tagging for untagged cards
          try {
            await autoTagBookmark({
              bookmarkId: b.id,
              userId,
              force: false
            });
          } catch (aiErr) {
            console.warn(`Auto-tag during sync-all failed for bookmark ${b.id}:`, aiErr);
          }
        } catch (queueErr) {
          console.error(`Failed to rescrape bookmark ID ${b.id}:`, queueErr);
        }
      });
    }

    // Queue untagged note bookmarks for AI auto-tagging
    for (const noteBm of untaggedNotes) {
      scrapeQueue.add(async () => {
        try {
          await autoTagBookmark({
            bookmarkId: noteBm.id,
            userId,
            force: false
          });
        } catch (noteErr) {
          console.warn(`Auto-tag note during sync-all failed for ${noteBm.id}:`, noteErr);
        }
      });
    }

    const totalCount = userBookmarks.length + untaggedNotes.length;
    res.status(202).json({
      message: `Global re-scrape and auto-tag initiated for ${totalCount} items`,
      count: totalCount
    });
  } catch (err: any) {
    console.error('Global rescrape error:', err);
    res.status(500).json({ message: err.message || 'Failed to start global rescrape' });
  }
});

export default router;

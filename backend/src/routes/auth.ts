import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb } from '../db';
import { getJwtSecret } from '../config';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { generateNetscapeHtml, BookmarkExportItem } from '../services/netscape';
import { CACHE_DIR, isSafeFilename } from '../services/thumbnail';

const router = Router();

function validatePassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128;
}

// 1. Register Endpoint
router.post('/register', async (req: AuthenticatedRequest, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  if (!validatePassword(password)) {
    return res.status(400).json({ message: 'Password must be between 8 and 128 characters' });
  }

  try {
    const db = getDb();
    
    // Check if any users exist in the database
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const isFirstUser = userCount.count === 0;

    // If not the first user, require administrator authentication
    if (!isFirstUser) {
      let authenticated = false;
      await new Promise<void>((resolve) => {
        authenticate(req, res, () => {
          authenticated = true;
          resolve();
        });
      });

      if (!authenticated) {
        if (!res.headersSent) {
          return res.status(403).json({
            message: 'An administrator account already exists. Please sign in.'
          });
        }
        return;
      }
    }

    // Check if username is already taken
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash);
    const newUserId = Number(result.lastInsertRowid);

    const secret = getJwtSecret();
    const token = jwt.sign({ userId: newUserId, username }, secret, { expiresIn: '7d' });

    const isAdmin = isFirstUser || newUserId === 1;

    const isSecure = process.env.COOKIE_SECURE === 'true';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      message: isFirstUser ? 'First administrator registered successfully' : 'User registered successfully',
      userId: newUserId,
      user: { id: newUserId, username, isAdmin },
      token
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 1.5 Admin-only User Creation Endpoint (Preserves Admin Session)
router.post('/users', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { username, password } = req.body;
  const caller = req.user!;

  if (caller.id !== 1) {
    return res.status(403).json({ message: 'Forbidden: Only administrators can create new users' });
  }

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  if (!validatePassword(password)) {
    return res.status(400).json({ message: 'Password must be between 8 and 128 characters' });
  }

  try {
    const db = getDb();
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash);
    const newUserId = Number(result.lastInsertRowid);

    res.status(201).json({
      message: 'User created successfully',
      user: { id: newUserId, username }
    });
  } catch (err: any) {
    console.error('Admin create user error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 1.6 Admin-only List Users
router.get('/users', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const caller = req.user!;
  if (caller.id !== 1) {
    return res.status(403).json({ message: 'Forbidden: Only administrators can list users' });
  }

  try {
    const db = getDb();
    const users = db.prepare(`
      SELECT 
        u.id, 
        u.username, 
        u.created_at,
        (SELECT COUNT(*) FROM bookmarks b WHERE b.user_id = u.id) as bookmark_count
      FROM users u
      ORDER BY u.id ASC
    `).all();

    res.status(200).json(users);
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 1.7 Admin-only Delete User with Automatic Data Export
router.delete('/users/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const caller = req.user!;
  if (caller.id !== 1) {
    return res.status(403).json({ message: 'Forbidden: Only administrators can delete users' });
  }

  const targetId = Number(req.params.id);
  if (isNaN(targetId)) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }

  if (targetId === 1 || targetId === caller.id) {
    return res.status(400).json({ message: 'Cannot delete primary administrator account' });
  }

  try {
    const db = getDb();
    const targetUser = db.prepare('SELECT id, username FROM users WHERE id = ?').get(targetId) as { id: number; username: string } | undefined;

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 1. Fetch user's bookmarks, tags, and highlights to export before deletion
    const bookmarks = db.prepare(`
      SELECT id, url, title, description, personal_note, content_type, image_path, favicon_path, created_at
      FROM bookmarks
      WHERE user_id = ?
      ORDER BY created_at ASC
    `).all(targetId) as (BookmarkExportItem & { personal_note?: string; content_type?: string; image_path?: string; favicon_path?: string })[];

    const tagQuery = db.prepare(`
      SELECT t.id, t.name 
      FROM tags t
      JOIN bookmark_tags bt ON t.id = bt.tag_id
      WHERE bt.bookmark_id = ?
    `);

    for (const b of bookmarks) {
      b.tags = tagQuery.all(b.id) as { id: number; name: string }[];
    }

    const highlights = db.prepare(`
      SELECT id, bookmark_id, text, color, note, created_at
      FROM highlights
      WHERE user_id = ?
    `).all(targetId);

    // 2. Generate Netscape HTML format and structured JSON backup
    const exportHtml = generateNetscapeHtml(bookmarks);
    const exportJson = {
      user: { id: targetUser.id, username: targetUser.username },
      exported_at: new Date().toISOString(),
      bookmark_count: bookmarks.length,
      bookmarks,
      highlights
    };

    // 3. Save backup copy to server filesystem
    try {
      const backupDir = path.resolve(__dirname, '../../data/backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupHtmlPath = path.join(backupDir, `deleted_user_${targetUser.id}_${targetUser.username}_${timestamp}.html`);
      const backupJsonPath = path.join(backupDir, `deleted_user_${targetUser.id}_${targetUser.username}_${timestamp}.json`);
      fs.writeFileSync(backupHtmlPath, exportHtml, 'utf-8');
      fs.writeFileSync(backupJsonPath, JSON.stringify(exportJson, null, 2), 'utf-8');
    } catch (backupErr) {
      console.warn('Could not write backup file to disk, proceeding with response payload:', backupErr);
    }

    // 4. Purge cached thumbnails on disk
    for (const b of bookmarks) {
      if (b.image_path && b.image_path.startsWith('/api/cache/')) {
        const filename = b.image_path.replace('/api/cache/', '');
        if (isSafeFilename(filename)) {
          const filePath = path.join(CACHE_DIR, filename);
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch {}
          }
        }
      }
    }

    // 5. Delete user from SQLite in a transaction (cascading deletes bookmarks, highlights, tags links, api keys)
    db.transaction(() => {
      db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
      // Clean up orphaned tags
      db.prepare('DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM bookmark_tags)').run();
    })();

    res.status(200).json({
      message: `User @${targetUser.username} deleted and data exported successfully`,
      deletedUser: targetUser,
      exportHtml,
      exportJson,
      bookmarkCount: bookmarks.length
    });
  } catch (err: any) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 2. Login Endpoint
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as { id: number; username: string; password_hash: string } | undefined;

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const secret = getJwtSecret();
    const token = jwt.sign({ userId: user.id, username: user.username }, secret, { expiresIn: '7d' });

    // Set HttpOnly cookie
    const isSecure = process.env.COOKIE_SECURE === 'true';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    const isAdmin = user.id === 1;
    res.status(200).json({
      message: 'Logged in successfully',
      user: { id: user.id, username: user.username, isAdmin },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 3. Logout Endpoint
router.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.status(200).json({ message: 'Logged out successfully' });
});

// 3.5 Check current session
router.get('/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const isAdmin = req.user?.id === 1;
  res.status(200).json({ user: { ...req.user, isAdmin } });
});

// 3.6 Check initialization status (whether first admin account exists)
router.get('/status', (req, res) => {
  try {
    const db = getDb();
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    res.status(200).json({ initialized: userCount.count > 0 });
  } catch (err: any) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 4. Create API Key
router.post('/apikey', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.body;
  const user = req.user!;

  try {
    const rawKey = 'slip_' + crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const db = getDb();
    db.prepare('INSERT INTO api_keys (user_id, token_hash, name) VALUES (?, ?, ?)').run(user.id, tokenHash, name || 'API Key');

    res.status(201).json({
      message: 'API Key generated successfully',
      apiKey: rawKey
    });
  } catch (err) {
    console.error('API key generation error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 5. List API Keys (Metadatas only)
router.get('/apikey', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;

  try {
    const db = getDb();
    const keys = db.prepare('SELECT id, name, created_at FROM api_keys WHERE user_id = ?').all(user.id);
    res.status(200).json(keys);
  } catch (err) {
    console.error('List API keys error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 6. Delete API Key (Revocation)
router.delete('/apikey/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').run(id, user.id);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'API Key not found or unauthorized' });
    }

    res.status(200).json({ message: 'API Key revoked successfully' });
  } catch (err) {
    console.error('Delete API key error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

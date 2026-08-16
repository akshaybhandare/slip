import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDb } from '../db';
import { getJwtSecret } from '../config';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

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
      user: { id: newUserId, username },
      token
    });
  } catch (err: any) {
    console.error('Registration error:', err);
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

    res.status(200).json({
      message: 'Logged in successfully',
      user: { id: user.id, username: user.username },
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
  res.status(200).json({ user: req.user });
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

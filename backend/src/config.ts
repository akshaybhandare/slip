import crypto from 'crypto';
import { getDb } from './db';

let cachedSecret: string | null = null;

export function getJwtSecret(): string {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  if (process.env.NODE_ENV === 'test') {
    return 'test-secret';
  }
  if (cachedSecret) {
    return cachedSecret;
  }

  // Persist or retrieve JWT secret from database so sessions survive restarts
  try {
    const db = getDb();
    const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get('jwt_secret') as { value: string } | undefined;
    if (existing && existing.value) {
      cachedSecret = existing.value;
      return cachedSecret;
    }

    const newSecret = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('jwt_secret', newSecret);
    cachedSecret = newSecret;
    return cachedSecret;
  } catch {
    if (!cachedSecret) {
      cachedSecret = crypto.randomBytes(32).toString('hex');
    }
    return cachedSecret;
  }
}

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb } from './db';

let cachedSecret: string | null = null;

const projectRoot = path.resolve(__dirname, '../..');

export function getMaxPinnedSlips(): number {
  if (process.env.MAX_PINNED_SLIPS) {
    const parsed = parseInt(process.env.MAX_PINNED_SLIPS, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  if (process.env.PIN_LIMIT) {
    const parsed = parseInt(process.env.PIN_LIMIT, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // Attempt to read from slip.config.json in project root, cwd, or /config directory
  const candidatePaths = [
    path.resolve(projectRoot, 'slip.config.json'),
    path.resolve(process.cwd(), 'slip.config.json'),
    path.resolve('/config', 'slip.config.json')
  ];

  for (const confPath of candidatePaths) {
    try {
      if (fs.existsSync(confPath)) {
        const raw = fs.readFileSync(confPath, 'utf-8');
        const json = JSON.parse(raw);
        const val = json.maxPinnedSlips ?? json.max_pinned_slips ?? json.maxPins ?? json.pinLimit;
        if (typeof val === 'number' && val > 0) {
          return val;
        }
        if (typeof val === 'string') {
          const parsed = parseInt(val, 10);
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
      }
    } catch {
      // Continue to next candidate or fallback
    }
  }

  return 5; // Default max pinned slips
}

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

let cachedInstanceId: string | null = null;

export function getInstanceId(): string {
  if (cachedInstanceId) {
    return cachedInstanceId;
  }
  try {
    const db = getDb();
    const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get('instance_id') as { value: string } | undefined;
    if (existing && existing.value) {
      cachedInstanceId = existing.value;
      return cachedInstanceId;
    }

    const newInstanceId = crypto.randomUUID ? crypto.randomUUID() : (() => {
      const rnd = crypto.randomBytes(16);
      rnd[6] = (rnd[6] & 0x0f) | 0x40;
      rnd[8] = (rnd[8] & 0x3f) | 0x80;
      return rnd.toString('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
    })();

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('instance_id', newInstanceId);
    cachedInstanceId = newInstanceId;
    return cachedInstanceId;
  } catch {
    if (!cachedInstanceId) {
      cachedInstanceId = crypto.randomUUID ? crypto.randomUUID() : 'fallback-uuid-string';
    }
    return cachedInstanceId;
  }
}

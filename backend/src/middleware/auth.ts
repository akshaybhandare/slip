import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getJwtSecret } from '../config';
import { getDb } from '../db';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
  };
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // 1. Check for Authorization header (Bearer JWT or API Key)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.substring(7).trim();
    
    // First try decoding as JWT token
    try {
      const secret = getJwtSecret();
      const decoded = jwt.verify(bearer, secret) as { userId: number; username: string };
      req.user = { id: decoded.userId, username: decoded.username };
      return next();
    } catch {
      // If not a JWT, check if it's an API Key
      const tokenHash = crypto.createHash('sha256').update(bearer).digest('hex');
      try {
        const db = getDb();
        const apiKeyRecord = db.prepare('SELECT user_id FROM api_keys WHERE token_hash = ?').get(tokenHash) as { user_id: number } | undefined;

        if (apiKeyRecord) {
          const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(apiKeyRecord.user_id) as { id: number; username: string } | undefined;
          if (user) {
            req.user = { id: user.id, username: user.username };
            return next();
          }
        }
      } catch (err) {
        console.error('API key verification database error:', err);
      }
    }
  }

  // 2. Check for cookie session token
  const parsedCookies = (req as any).cookies;
  let token: string | null = parsedCookies?.token || null;

  if (!token && req.headers.cookie) {
    const tokenCookie = req.headers.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('token='));
    if (tokenCookie) {
      token = tokenCookie.substring(6);
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as { userId: number; username: string };
    
    req.user = { id: decoded.userId, username: decoded.username };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
}

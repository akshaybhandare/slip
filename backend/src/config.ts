import crypto from 'crypto';

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
  console.warn('JWT_SECRET is missing. Generating an ephemeral secret key. This will invalidate sessions upon server restart!');
  return crypto.randomBytes(32).toString('hex');
}

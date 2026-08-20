import crypto from 'crypto';
import { getJwtSecret } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;
let lastSecret: string | null = null;

function getEncryptionKey(): Buffer {
  const secret = getJwtSecret();
  if (cachedKey && lastSecret === secret) {
    return cachedKey;
  }
  cachedKey = crypto.scryptSync(secret, 'slip_ai_key_salt_v1', 32);
  lastSecret = secret;
  return cachedKey;
}

export function clearEncryptionKeyCache(): void {
  cachedKey = null;
  lastSecret = null;
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  // Format: iv:authTag:encryptedHex
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptSecret(ciphertext: string): string {
  if (!ciphertext) return '';
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted ciphertext format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey) return '';
  return '••••••••••••••••••••••' + apiKey.trim().slice(-4);
}


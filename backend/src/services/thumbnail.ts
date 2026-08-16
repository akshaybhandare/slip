import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';

// Resolve cache directory relative to project root
const projectRoot = path.resolve(__dirname, '../..');
const rawCacheDir = process.env.CACHE_DIR || 'backend/data/cache';
export const CACHE_DIR = path.isAbsolute(rawCacheDir) ? rawCacheDir : path.resolve(projectRoot, rawCacheDir);

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export function isSafeFilename(filename: string): boolean {
  if (!filename || typeof filename !== 'string') return false;
  if (path.basename(filename) !== filename) return false;
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) return false;
  return /^[a-f0-9]{64}\.(jpg|jpeg|png|webp|gif|svg|ico)$/i.test(filename);
}

export async function cacheThumbnail(imageUrl: string): Promise<string | null> {
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
    return null;
  }

  try {
    const hash = crypto.createHash('sha256').update(imageUrl).digest('hex');
    
    // Extract extension or default to .jpg
    const urlObj = new URL(imageUrl);
    const extMatch = urlObj.pathname.match(/\.(jpg|jpeg|png|webp|gif|svg|ico)$/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
    const filename = `${hash}.${ext}`;
    const filePath = path.join(CACHE_DIR, filename);

    // If already cached, return immediately
    if (fs.existsSync(filePath)) {
      return `/api/cache/${filename}`;
    }

    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 8000,
      maxContentLength: 5 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/*'
      }
    });

    const contentType = String(response.headers['content-type'] || '');
    if (!contentType.startsWith('image/') && !extMatch) {
      return null;
    }

    fs.writeFileSync(filePath, Buffer.from(response.data));
    return `/api/cache/${filename}`;
  } catch (err) {
    return null;
  }
}

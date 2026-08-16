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

    // Ignore placeholder / tiny error buffers (< 1000 bytes)
    if (response.data && response.data.length < 1000) {
      return null;
    }

    fs.writeFileSync(filePath, Buffer.from(response.data));
    return `/api/cache/${filename}`;
  } catch (err) {
    return null;
  }
}

export function detectImageType(buffer: Buffer, originalFilename?: string): { ext: string; mime: string } | null {
  if (!buffer || buffer.length < 4) return null;

  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { ext: 'png', mime: 'image/png' };
  }
  // GIF
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return { ext: 'gif', mime: 'image/gif' };
  }
  // WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  // SVG
  if (originalFilename && /\.svg$/i.test(originalFilename)) {
    const head = buffer.subarray(0, 512).toString('utf8').trim();
    if (head.includes('<svg') || head.includes('<?xml')) {
      return { ext: 'svg', mime: 'image/svg+xml' };
    }
  }

  return null;
}

export function saveUploadedImage(buffer: Buffer, originalFilename?: string): {
  imagePath: string;
  filename: string;
  mimeType: string;
  size: number;
} {
  const detected = detectImageType(buffer, originalFilename);
  if (!detected) {
    throw new Error('Unsupported image format. Allowed formats: JPG, PNG, WEBP, GIF, SVG.');
  }

  // Enforce max 25MB file size
  const MAX_SIZE = 25 * 1024 * 1024;
  if (buffer.length > MAX_SIZE) {
    throw new Error('Image exceeds maximum file size of 25MB.');
  }

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const filename = `${hash}.${detected.ext}`;
  const filePath = path.join(CACHE_DIR, filename);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, buffer);
  }

  return {
    imagePath: `/api/cache/${filename}`,
    filename,
    mimeType: detected.mime,
    size: buffer.length
  };
}


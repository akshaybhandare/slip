import { Bookmark } from '../types';

/**
 * Checks if a bookmark is a Document/PDF type slip.
 */
export function isDocumentSlip(bookmark?: Partial<Bookmark> | null): boolean {
  if (!bookmark) return false;
  const url = bookmark.url || '';
  const imgPath = bookmark.image_path || '';
  return bookmark.content_type === 'document' || url.endsWith('.pdf') || imgPath.endsWith('.pdf');
}

/**
 * Checks if a bookmark is a Note type slip.
 */
export function isNoteSlip(bookmark?: Partial<Bookmark> | null): boolean {
  if (!bookmark) return false;
  const url = bookmark.url || '';
  return bookmark.content_type === 'note' || url.startsWith('slip://note/');
}

/**
 * Checks if a bookmark is a locally cached image slip.
 */
export function isLocalImageSlip(bookmark?: Partial<Bookmark> | null): boolean {
  if (!bookmark) return false;
  const url = bookmark.url || '';
  return bookmark.content_type === 'image' && (url.startsWith('/api/cache') || url.startsWith('local://'));
}

/**
 * Extracts a clean, human-readable original filename for a PDF slip,
 * strictly rejecting internal 32+ character hexadecimal cache hashes.
 */
export function extractPdfOriginalFilename(bookmark?: Partial<Bookmark> | null): string {
  if (!bookmark) return 'document.pdf';

  // 1. Check description for "Uploaded document: <filename.pdf>"
  if (bookmark.description) {
    const match = bookmark.description.match(/Uploaded (?:document|file):\s*([^\s()]+\.pdf)/i);
    if (match && match[1] && !/^[a-f0-9]{32,}\.pdf$/i.test(match[1])) {
      return match[1];
    }
  }

  // 2. Check title if it explicitly has .pdf and is not a hash
  if (bookmark.title && bookmark.title.toLowerCase().endsWith('.pdf') && !/^[a-f0-9]{32,}\.pdf$/i.test(bookmark.title)) {
    return bookmark.title;
  }

  // 3. Check url if it is an external URL (not /api/cache/<hash>.pdf)
  if (bookmark.url && !bookmark.url.startsWith('/api/cache/')) {
    try {
      const parsed = new URL(bookmark.url);
      const fname = parsed.pathname.split('/').pop();
      if (fname && fname.toLowerCase().endsWith('.pdf') && !/^[a-f0-9]{32,}\.pdf$/i.test(fname)) {
        return decodeURIComponent(fname);
      }
    } catch {}
  }

  // 4. Check raw_text for original filename
  if (bookmark.raw_text) {
    const rawMatch = bookmark.raw_text.match(/([a-zA-Z0-9_\-.]+\.pdf)/i);
    if (rawMatch && rawMatch[1] && !/^[a-f0-9]{32,}\.pdf$/i.test(rawMatch[1])) {
      return rawMatch[1];
    }
  }

  // 5. Fallback slug from title (never return gibberish 64-char hash)
  if (bookmark.title && !/^[a-f0-9]{32,}/i.test(bookmark.title)) {
    const slug = bookmark.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 35);
    return slug ? `${slug}.pdf` : 'document.pdf';
  }

  return 'document.pdf';
}

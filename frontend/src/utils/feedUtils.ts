import { Bookmark, ContentType, SortBy, SortOrder } from '../types';

export interface GroupedBookmarks {
  type: ContentType;
  label: string;
  bookmarks: Bookmark[];
}

export const CONTENT_TYPE_ORDER: { type: ContentType; label: string }[] = [
  { type: 'article', label: 'Articles' },
  { type: 'note', label: 'Notes' },
  { type: 'document', label: 'Documents' },
  { type: 'image', label: 'Images' },
  { type: 'website', label: 'Websites' },
  { type: 'product', label: 'Products' },
  { type: 'video', label: 'Videos' }
];

export function sortBookmarks(bookmarks: Bookmark[], sortBy: SortBy, sortOrder: SortOrder): Bookmark[] {
  return [...bookmarks].sort((a, b) => {
    // 1. Pinned slips always come first
    const aPin = Boolean(a.is_pinned) ? 1 : 0;
    const bPin = Boolean(b.is_pinned) ? 1 : 0;
    if (aPin !== bPin) return bPin - aPin;

    // 2. Among pinned slips
    if (aPin && bPin) {
      if (sortBy === 'title') {
        const titleA = (a.title || '').toLowerCase();
        const titleB = (b.title || '').toLowerCase();
        const cmp = titleA.localeCompare(titleB);
        if (cmp !== 0) return sortOrder === 'asc' ? cmp : -cmp;
      } else if (sortBy === 'updated_at') {
        const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        if (timeA !== timeB) return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      } else {
        const aPinnedTime = a.pinned_at ? new Date(a.pinned_at).getTime() : 0;
        const bPinnedTime = b.pinned_at ? new Date(b.pinned_at).getTime() : 0;
        if (aPinnedTime !== bPinnedTime) return sortOrder === 'asc' ? aPinnedTime - bPinnedTime : bPinnedTime - aPinnedTime;
      }
    }

    // 3. Main sort criteria
    if (sortBy === 'title') {
      const titleA = (a.title || '').toLowerCase();
      const titleB = (b.title || '').toLowerCase();
      const cmp = titleA.localeCompare(titleB);
      if (cmp !== 0) return sortOrder === 'asc' ? cmp : -cmp;
    } else if (sortBy === 'updated_at') {
      const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      if (timeA !== timeB) return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    } else {
      // created_at
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (timeA !== timeB) return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    }

    // Secondary tie-breaker by ID
    return sortOrder === 'asc' ? a.id - b.id : b.id - a.id;
  });
}

export function groupBookmarksByType(
  bookmarks: Bookmark[],
  sortBy: SortBy = 'created_at',
  sortOrder: SortOrder = 'desc'
): GroupedBookmarks[] {
  const groupsMap = new Map<ContentType, Bookmark[]>();

  for (const b of bookmarks) {
    const type: ContentType = b.content_type || 'website';
    if (!groupsMap.has(type)) {
      groupsMap.set(type, []);
    }
    groupsMap.get(type)!.push(b);
  }

  const result: GroupedBookmarks[] = [];

  // Add defined categories in order if they contain bookmarks
  for (const def of CONTENT_TYPE_ORDER) {
    const list = groupsMap.get(def.type);
    if (list && list.length > 0) {
      result.push({
        type: def.type,
        label: def.label,
        bookmarks: sortBookmarks(list, sortBy, sortOrder)
      });
      groupsMap.delete(def.type);
    }
  }

  // Add any other dynamic categories remaining
  for (const [type, list] of groupsMap.entries()) {
    if (list.length > 0) {
      const label = type.charAt(0).toUpperCase() + type.slice(1);
      result.push({
        type,
        label,
        bookmarks: sortBookmarks(list, sortBy, sortOrder)
      });
    }
  }

  return result;
}

import { Bookmark, ContentType, Tag, User, UserListItem, Clip, ClipDetail, PinConfig } from './types';

const API_BASE = '/api';

async function apiFetch<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const headers = new Headers(init?.headers);

  if (init?.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: 'include' // Pass secure HttpOnly session cookies automatically
  });

  if (!res.ok) {
    let errorMessage = `Request failed with status ${res.status}`;
    try {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json && json.message) {
          errorMessage = json.message;
        }
      } catch {
        if (text && text.trim().length > 0 && text.length < 200) {
          errorMessage = text.trim();
        }
      }
    } catch {
      // Fallback
    }
    throw new Error(errorMessage);
  }


  return res.json();
}

// --- Auth APIs ---

export async function loginUser(username: string, password: string): Promise<{ user: User; token?: string }> {
  return apiFetch<{ user: User; token?: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export async function registerUser(username: string, password: string): Promise<{ message: string; userId: number; user?: User; token?: string }> {
  return apiFetch<{ message: string; userId: number; user?: User; token?: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export async function createAdminUser(username: string, password: string): Promise<{ message: string; user: User }> {
  return apiFetch<{ message: string; user: User }>('/auth/users', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export async function fetchAdminUsers(): Promise<UserListItem[]> {
  return apiFetch<UserListItem[]>('/auth/users');
}

export async function deleteAdminUser(userId: number): Promise<{
  message: string;
  deletedUser: User;
  exportHtml: string;
  exportJson: any;
  bookmarkCount: number;
}> {
  return apiFetch<{
    message: string;
    deletedUser: User;
    exportHtml: string;
    exportJson: any;
    bookmarkCount: number;
  }>(`/auth/users/${userId}`, {
    method: 'DELETE'
  });
}

export async function logoutUser(): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/auth/logout', {
    method: 'POST'
  });
}

export async function getMe(): Promise<{ user: User }> {
  return apiFetch<{ user: User }>('/auth/me');
}

export async function getAuthStatus(): Promise<{ initialized: boolean }> {
  return apiFetch<{ initialized: boolean }>('/auth/status');
}

// --- Bookmarks APIs ---

export async function fetchBookmarks(contentType?: ContentType, tag?: string): Promise<Bookmark[]> {
  const params = new URLSearchParams();
  if (contentType && contentType !== 'all') params.append('contentType', contentType);
  if (tag) params.append('tag', tag);

  const queryStr = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<Bookmark[]>(`/bookmarks${queryStr}`);
}

export async function searchBookmarks(query: string): Promise<Bookmark[]> {
  return apiFetch<Bookmark[]>(`/bookmarks/search?q=${encodeURIComponent(query)}`);
}

export async function smartSearchBookmarks(query: string): Promise<Bookmark[]> {
  return apiFetch<Bookmark[]>(`/bookmarks/search?q=${encodeURIComponent(query)}&smart=true`);
}

export async function fetchBookmarkById(id: number): Promise<Bookmark> {
  return apiFetch<Bookmark>(`/bookmarks/${id}`);
}

export async function createBookmark(data: {
  url: string;
  title?: string;
  description?: string;
  tags?: string[];
  contentType?: string;
}): Promise<Bookmark> {
  return apiFetch<Bookmark>('/bookmarks', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function uploadFileBookmark(data: {
  file?: File;
  imageData?: string;
  fileData?: string;
  filename?: string;
  title?: string;
  description?: string;
  personalNote?: string;
  tags?: string[];
}): Promise<Bookmark> {
  let base64 = data.fileData || data.imageData;
  let filename = data.filename || data.file?.name;

  if (data.file && !base64) {
    base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(data.file!);
    });
  }

  if (!base64) {
    throw new Error('Please select a file to upload.');
  }

  return apiFetch<Bookmark>('/bookmarks/upload', {
    method: 'POST',
    body: JSON.stringify({
      file_data: base64,
      image_data: base64,
      filename,
      title: data.title,
      description: data.description,
      personal_note: data.personalNote,
      tags: data.tags
    })
  });
}



export async function createNoteBookmark(data: {
  title?: string;
  content: string;
  tags?: string[];
}): Promise<Bookmark> {
  return apiFetch<Bookmark>('/bookmarks/note', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}


export async function updateBookmark(id: number, data: {
  title?: string;
  description?: string;
  personalNote?: string;
  tags?: string[];
  contentType?: string;
}): Promise<Bookmark> {
  return apiFetch<Bookmark>(`/bookmarks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function updateBookmarkNote(id: number, note: string): Promise<Bookmark> {
  return apiFetch<Bookmark>(`/bookmarks/${id}/note`, {
    method: 'PUT',
    body: JSON.stringify({ note })
  });
}

export async function fetchHighlights(bookmarkId: number): Promise<any[]> {
  return apiFetch<any[]>(`/bookmarks/${bookmarkId}/highlights`);
}

export async function createHighlight(bookmarkId: number, data: {
  text: string;
  color?: string;
  note?: string;
}): Promise<any> {
  return apiFetch<any>(`/bookmarks/${bookmarkId}/highlights`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function deleteHighlight(bookmarkId: number, highlightId: number): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/bookmarks/${bookmarkId}/highlights/${highlightId}`, {
    method: 'DELETE'
  });
}

export async function rescrapeBookmark(id: number): Promise<Bookmark> {
  return apiFetch<Bookmark>(`/bookmarks/${id}/rescrape`, {
    method: 'POST'
  });
}

export async function autoTagBookmark(id: number): Promise<Bookmark> {
  return apiFetch<Bookmark>(`/bookmarks/${id}/auto-tag`, {
    method: 'POST'
  });
}

export async function rescrapeAllBookmarks(): Promise<{ message: string; count: number }> {
  return apiFetch<{ message: string; count: number }>('/bookmarks/rescrape-all', {
    method: 'POST'
  });
}

export async function deleteBookmark(id: number): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/bookmarks/${id}`, {
    method: 'DELETE'
  });
}

export async function fetchRecycleClip(): Promise<Bookmark[]> {
  return apiFetch<Bookmark[]>('/bookmarks/recycle-clip');
}

export async function restoreBookmark(id: number): Promise<{ message: string; bookmark: Bookmark }> {
  return apiFetch<{ message: string; bookmark: Bookmark }>(`/bookmarks/${id}/restore`, {
    method: 'POST'
  });
}

export async function permanentlyDeleteBookmark(id: number): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/bookmarks/${id}/permanent`, {
    method: 'DELETE'
  });
}

export async function emptyRecycleClip(): Promise<{ message: string; deletedCount: number }> {
  return apiFetch<{ message: string; deletedCount: number }>('/bookmarks/recycle-clip/empty', {
    method: 'POST'
  });
}

export async function fetchPinConfig(): Promise<PinConfig> {
  return apiFetch<PinConfig>('/bookmarks/pin-config');
}

export async function togglePinBookmark(id: number, pinned?: boolean): Promise<Bookmark> {
  return apiFetch<Bookmark>(`/bookmarks/${id}/pin`, {
    method: 'PUT',
    body: JSON.stringify(typeof pinned === 'boolean' ? { pinned } : {})
  });
}

export async function fetchTags(): Promise<Tag[]> {
  return apiFetch<Tag[]>('/bookmarks/tags');
}

// --- Share APIs ---

export async function shareBookmark(id: number): Promise<{ token: string; shareUrl: string }> {
  return apiFetch<{ token: string; shareUrl: string }>(`/share/bookmark/${id}`, {
    method: 'POST'
  });
}

export async function revokeShareBookmark(id: number): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/share/bookmark/${id}`, {
    method: 'DELETE'
  });
}

// --- IO APIs ---

export async function importBookmarksHtml(html: string): Promise<{ message: string; importedCount: number }> {
  return apiFetch<{ message: string; importedCount: number }>('/io/import', {
    method: 'POST',
    body: JSON.stringify({ html })
  });
}

// --- AI APIs ---

export interface AIConfigResponse {
  isConnected: boolean;
  provider: 'openai' | 'claude' | 'gemini' | 'custom';
  model?: string;
  maskedApiKey: string;
  apiUrl: string;
  lastTestedAt: string | null;
  isAdmin: boolean;
}

export async function fetchAIConfig(): Promise<AIConfigResponse> {
  return apiFetch<AIConfigResponse>('/ai/config');
}

export async function testAIConnectionApi(data: {
  provider: string;
  apiKey?: string;
  apiUrl?: string;
  model?: string;
}): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  return apiFetch<{ success: boolean; message: string; latencyMs?: number }>('/ai/test', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function saveAIConfigApi(data: {
  provider: string;
  apiKey: string;
  apiUrl?: string;
  model?: string;
}): Promise<{ message: string; config: AIConfigResponse; testResult?: any }> {
  return apiFetch<{ message: string; config: AIConfigResponse; testResult?: any }>('/ai/config', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function disconnectAIConfigApi(): Promise<{ message: string; config: AIConfigResponse }> {
  return apiFetch<{ message: string; config: AIConfigResponse }>('/ai/config', {
    method: 'DELETE'
  });
}

export type NoteAssistAction =
  | 'continue'
  | 'rephrase'
  | 'fix_grammar'
  | 'rewrite'
  | 'propose'
  | 'title'
  | 'custom';

export interface NoteAssistParams {
  action: NoteAssistAction;
  text: string;
  title?: string;
  instruction?: string;
}

export interface NoteAssistResponse {
  result: string;
  proposedTitle?: string;
}

export async function assistNoteApi(params: NoteAssistParams): Promise<NoteAssistResponse> {
  return apiFetch<NoteAssistResponse>('/ai/note-assist', {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

// --- Clips (Folders) APIs ---

export async function fetchClips(): Promise<Clip[]> {
  return apiFetch<Clip[]>('/clips');
}

export async function fetchClip(id: number): Promise<ClipDetail> {
  return apiFetch<ClipDetail>(`/clips/${id}`);
}

export async function createClip(name: string, parentId?: number | null): Promise<Clip> {
  return apiFetch<Clip>('/clips', {
    method: 'POST',
    body: JSON.stringify({ name, parentId: parentId || null })
  });
}

export async function updateClip(id: number, data: { name?: string; parentId?: number | null }): Promise<Clip> {
  return apiFetch<Clip>(`/clips/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function deleteClip(id: number, includeChildren: boolean = true): Promise<{ message: string; id: number; includedChildren: boolean }> {
  return apiFetch<{ message: string; id: number; includedChildren: boolean }>(`/clips/${id}?include_children=${includeChildren}`, {
    method: 'DELETE'
  });
}

export async function fetchRecycleClips(): Promise<Clip[]> {
  return apiFetch<Clip[]>('/clips/recycle-clip');
}

export async function restoreClip(id: number): Promise<{ message: string; clip: Clip }> {
  return apiFetch<{ message: string; clip: Clip }>(`/clips/${id}/restore`, {
    method: 'POST'
  });
}

export async function permanentlyDeleteClip(id: number): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/clips/${id}/permanent`, {
    method: 'DELETE'
  });
}

export async function addBookmarkToClip(clipId: number, bookmarkId: number): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/clips/${clipId}/bookmarks`, {
    method: 'POST',
    body: JSON.stringify({ bookmarkId })
  });
}

export async function removeBookmarkFromClip(clipId: number, bookmarkId: number): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/clips/${clipId}/bookmarks/${bookmarkId}`, {
    method: 'DELETE'
  });
}

export async function fetchBookmarkClips(bookmarkId: number): Promise<Clip[]> {
  return apiFetch<Clip[]>(`/clips/bookmark/${bookmarkId}`);
}

export async function setBookmarkClip(bookmarkId: number, clipId: number | null): Promise<{ message: string; clip: Clip | null; clips: Clip[] }> {
  return apiFetch<{ message: string; clip: Clip | null; clips: Clip[] }>(`/clips/bookmark/${bookmarkId}`, {
    method: 'PUT',
    body: JSON.stringify({ clipId })
  });
}

export async function setBookmarkClips(bookmarkId: number, clipIds: number[]): Promise<{ message: string; clips: Clip[] }> {
  return apiFetch<{ message: string; clips: Clip[] }>(`/clips/bookmark/${bookmarkId}`, {
    method: 'PUT',
    body: JSON.stringify({ clipIds })
  });
}




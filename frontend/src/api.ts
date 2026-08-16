import { Bookmark, ContentType, Tag, User } from './types';

const API_BASE = '/api';

async function apiFetch<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const headers = new Headers(init?.headers);

  if (init?.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Include Bearer token from localStorage for mobile & cross-origin reliability
  const token = localStorage.getItem('slip_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: 'include' // Always pass session cookies!
  });

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('slip_token');
    }
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
  const res = await apiFetch<{ user: User; token?: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  if (res.token) {
    localStorage.setItem('slip_token', res.token);
  }
  return res;
}

export async function registerUser(username: string, password: string): Promise<{ message: string; userId: number; user?: User; token?: string }> {
  const res = await apiFetch<{ message: string; userId: number; user?: User; token?: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  if (res.token) {
    localStorage.setItem('slip_token', res.token);
  }
  return res;
}

export async function logoutUser(): Promise<{ message: string }> {
  localStorage.removeItem('slip_token');
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

export async function uploadImageBookmark(data: {
  file?: File;
  imageData?: string;
  filename?: string;
  title?: string;
  description?: string;
  personalNote?: string;
  tags?: string[];
}): Promise<Bookmark> {
  let base64 = data.imageData;
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
    throw new Error('Please select an image file to upload.');
  }

  return apiFetch<Bookmark>('/bookmarks/upload', {
    method: 'POST',
    body: JSON.stringify({
      image_data: base64,
      filename,
      title: data.title,
      description: data.description,
      personal_note: data.personalNote,
      tags: data.tags
    })
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

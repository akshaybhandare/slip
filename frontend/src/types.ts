export type ContentType = 'all' | 'article' | 'image' | 'document' | 'note' | 'product' | 'video' | 'website';

export interface Tag {
  id: number;
  name: string;
  count?: number;
}

export interface Highlight {
  id: number;
  bookmark_id: number;
  user_id: number;
  text: string;
  color: string;
  note?: string | null;
  created_at: string;
}

export interface Bookmark {
  id: number;
  user_id: number;
  url: string;
  title: string;
  description?: string;
  personal_note?: string | null;
  content_type: ContentType;
  image_path?: string | null;
  favicon_path?: string | null;
  reader_html?: string | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
  snippet?: string;
}

export interface User {
  id: number;
  username: string;
  isAdmin?: boolean;
}

export interface UserListItem {
  id: number;
  username: string;
  created_at: string;
  bookmark_count: number;
}

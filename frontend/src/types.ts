export type ContentType = 'all' | 'article' | 'image' | 'product' | 'video' | 'website';

export interface Tag {
  id: number;
  name: string;
  count?: number;
}

export interface Bookmark {
  id: number;
  user_id: number;
  url: string;
  title: string;
  description?: string;
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
}

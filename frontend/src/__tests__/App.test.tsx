import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import App from '../App';
import * as api from '../api';
import { Bookmark } from '../types';

vi.mock('../api', () => ({
  fetchBookmarks: vi.fn(),
  searchBookmarks: vi.fn(),
  fetchTags: vi.fn(),
  createBookmark: vi.fn(),
  deleteBookmark: vi.fn(),
  logoutUser: vi.fn(),
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  shareBookmark: vi.fn(),
  revokeShareBookmark: vi.fn(),
  importBookmarksHtml: vi.fn(),
  getMe: vi.fn(),
  getAuthStatus: vi.fn(),
  updateBookmark: vi.fn(),
  rescrapeBookmark: vi.fn(),
  rescrapeAllBookmarks: vi.fn()
}));

describe('Frontend SPA Component Architecture & Mobile UI Interactions', () => {
  const mockBookmarks: Bookmark[] = [
    {
      id: 1,
      user_id: 1,
      url: 'https://example.com/article-1',
      title: 'Deep Architecture of SQLite',
      description: 'Understanding B-Trees and WAL mode.',
      content_type: 'article',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [{ id: 1, name: 'database' }]
    },
    {
      id: 2,
      user_id: 1,
      url: 'https://youtube.com/watch?v=123',
      title: 'React 19 Walkthrough Video',
      description: 'Overview of Actions and Server Functions.',
      content_type: 'video',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [{ id: 2, name: 'react' }]
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getMe).mockResolvedValue({ user: { id: 1, username: 'testuser' } });
    vi.mocked(api.getAuthStatus).mockResolvedValue({ initialized: true });
    vi.mocked(api.fetchBookmarks).mockResolvedValue(mockBookmarks);
    vi.mocked(api.fetchTags).mockResolvedValue([
      { id: 1, name: 'database', count: 1 },
      { id: 2, name: 'react', count: 1 }
    ]);
    vi.mocked(api.rescrapeAllBookmarks).mockResolvedValue({ message: 'Global re-scrape initiated for 2 bookmarks', count: 2 });
  });

  it('renders navbar brand title, search input, and global sync button', async () => {
    render(<App />);

    expect(screen.getByText('Slip')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search your archive/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Global Re-scrape/i)).toBeInTheDocument();
  });

  it('renders bookmark cards with titles, tags, and content types in stable stream columns', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Deep Architecture of SQLite')).toBeInTheDocument();
      expect(screen.getByText('React 19 Walkthrough Video')).toBeInTheDocument();
      expect(screen.getAllByText('#database').length).toBeGreaterThan(0);
    });
  });

  it('switches content type categories when filter tabs are clicked', async () => {
    render(<App />);

    const articleTab = screen.getByRole('button', { name: /Articles/i });
    fireEvent.click(articleTab);

    await waitFor(() => {
      expect(api.fetchBookmarks).toHaveBeenCalledWith('article', undefined);
    });
  });

  it('opens and closes Add Bookmark modal with interactive TagInput chips', async () => {
    render(<App />);

    // Wait for initial tags to load
    await waitFor(() => {
      expect(api.fetchTags).toHaveBeenCalled();
    });

    const saveBtn = screen.getByTitle('Save Link');
    fireEvent.click(saveBtn);

    expect(screen.getByText('Save to Slip')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Saved Tags:/i)).toBeInTheDocument();
    });

    // Click a saved tag chip to add it
    const dbTagBtn = screen.getByRole('button', { name: /#database/i });
    fireEvent.click(dbTagBtn);

    // Tag removal button in chip should exist
    expect(screen.getByLabelText('Remove tag database')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText('Save to Slip')).not.toBeInTheDocument();
    });
  });

  it('triggers global re-scrape when Sync All button is clicked', async () => {
    render(<App />);

    const syncBtn = screen.getByTitle(/Global Re-scrape/i);
    fireEvent.click(syncBtn);

    await waitFor(() => {
      expect(api.rescrapeAllBookmarks).toHaveBeenCalled();
    });
  });

  it('renders mobile Floating Action Button (FAB) and opens modal on click', async () => {
    render(<App />);

    const fabBtn = screen.getByLabelText('Save bookmark');
    expect(fabBtn).toBeInTheDocument();

    fireEvent.click(fabBtn);
    expect(screen.getByText('Save to Slip')).toBeInTheDocument();
  });

  it('toggles light, dark, and system themes when theme toggle button is clicked', async () => {
    render(<App />);

    const themeToggleBtn = screen.getByLabelText(/Toggle light, dark, and system theme/i);
    expect(themeToggleBtn).toBeInTheDocument();

    fireEvent.click(themeToggleBtn);
    expect(document.documentElement.getAttribute('data-theme')).toBeTruthy();
  });
});

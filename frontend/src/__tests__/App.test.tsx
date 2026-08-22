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
  uploadImageBookmark: vi.fn(),
  uploadFileBookmark: vi.fn(),
  createNoteBookmark: vi.fn(),
  deleteBookmark: vi.fn(),
  logoutUser: vi.fn(),
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  createAdminUser: vi.fn(),
  fetchAdminUsers: vi.fn(),
  deleteAdminUser: vi.fn(),
  shareBookmark: vi.fn(),
  revokeShareBookmark: vi.fn(),
  importBookmarksHtml: vi.fn(),
  getMe: vi.fn(),
  getAuthStatus: vi.fn(),
  updateBookmark: vi.fn(),
  rescrapeBookmark: vi.fn(),
  rescrapeAllBookmarks: vi.fn(),
  fetchAIConfig: vi.fn(),
  saveAIConfigApi: vi.fn(),
  testAIConnectionApi: vi.fn(),
  disconnectAIConfigApi: vi.fn(),
  fetchPinConfig: vi.fn().mockResolvedValue({ maxPinnedSlips: 5 }),
  togglePinBookmark: vi.fn(),
  fetchClips: vi.fn().mockResolvedValue([]),
  fetchClip: vi.fn(),
  createClip: vi.fn(),
  updateClip: vi.fn(),
  deleteClip: vi.fn(),
  addBookmarkToClip: vi.fn(),
  removeBookmarkFromClip: vi.fn(),
  fetchBookmarkClips: vi.fn().mockResolvedValue([]),
  setBookmarkClip: vi.fn().mockResolvedValue({ message: 'Success', clip: null, clips: [] }),
  setBookmarkClips: vi.fn().mockResolvedValue({ message: 'Success', clips: [] }),
  fetchRecycleClip: vi.fn().mockResolvedValue([]),
  fetchRecycleClips: vi.fn().mockResolvedValue([]),
  restoreClip: vi.fn().mockResolvedValue({ message: 'Clip restored', clip: {} }),
  permanentlyDeleteClip: vi.fn().mockResolvedValue({ message: 'Clip permanently deleted' }),
  restoreBookmark: vi.fn().mockResolvedValue({ message: 'Bookmark restored successfully', bookmark: {} }),
  permanentlyDeleteBookmark: vi.fn().mockResolvedValue({ message: 'Bookmark permanently deleted' }),
  emptyRecycleClip: vi.fn().mockResolvedValue({ message: 'Recycle clip emptied', deletedCount: 0 })
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
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(api.getMe).mockResolvedValue({ user: { id: 1, username: 'testuser', isAdmin: true } });
    vi.mocked(api.getAuthStatus).mockResolvedValue({ initialized: true });
    vi.mocked(api.fetchBookmarks).mockResolvedValue(mockBookmarks);
    vi.mocked(api.fetchPinConfig).mockResolvedValue({ maxPinnedSlips: 5 });
    vi.mocked(api.fetchTags).mockResolvedValue([
      { id: 1, name: 'database', count: 1 },
      { id: 2, name: 'react', count: 1 }
    ]);
    vi.mocked(api.fetchAdminUsers).mockResolvedValue([
      { id: 1, username: 'testuser', created_at: new Date().toISOString(), bookmark_count: 2 }
    ]);
    vi.mocked(api.rescrapeAllBookmarks).mockResolvedValue({ message: 'Global re-scrape initiated for 2 bookmarks', count: 2 });
    vi.mocked(api.fetchAIConfig).mockResolvedValue({
      isConnected: false,
      provider: 'openai',
      maskedApiKey: '',
      apiUrl: '',
      lastTestedAt: null,
      isAdmin: true
    });
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

    // Type partial input "rea" to filter suggestions down to #react
    const tagInput = screen.getByPlaceholderText(/Add more.../i);
    fireEvent.change(tagInput, { target: { value: 'rea' } });

    // The suggested button for #react should be visible
    const reactTagBtn = screen.getByRole('button', { name: /#react/i });
    fireEvent.mouseDown(reactTagBtn);
    fireEvent.click(reactTagBtn);

    // Should have added tag 'react' and not the partial text 'rea'
    expect(screen.getByLabelText('Remove tag react')).toBeInTheDocument();
    expect(screen.queryByLabelText('Remove tag rea')).not.toBeInTheDocument();

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

  it('opens mobile overflow menu and presents sync, import, export, and logout options', async () => {
    render(<App />);

    const moreBtn = screen.getByLabelText('Open menu');
    expect(moreBtn).toBeInTheDocument();

    fireEvent.click(moreBtn);

    await waitFor(() => {
      expect(screen.getByText(/Sync & Re-scrape All/i)).toBeInTheDocument();
      expect(screen.getByText(/Import HTML Bookmarks/i)).toBeInTheDocument();
      expect(screen.getByText(/Export HTML Bookmarks/i)).toBeInTheDocument();
      expect(screen.getByText(/Log out \(@testuser\)/i)).toBeInTheDocument();
    });
  });

  it('opens and closes Add User modal when admin clicks Add User', async () => {
    render(<App />);

    const addUserBtn = await screen.findByTitle('Manage Users & API Keys');
    expect(addUserBtn).toBeInTheDocument();

    fireEvent.click(addUserBtn);

    expect(screen.getByText('Manage Users')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g. alex/i)).toBeInTheDocument();

    const closeBtn = screen.getByLabelText('Close modal');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText('Manage Users')).not.toBeInTheDocument();
    });
  });

  it('renders Notes and Documents categories in filter tabs and switches to them', async () => {
    render(<App />);

    const notesTab = screen.getByRole('button', { name: /Notes/i });
    expect(notesTab).toBeInTheDocument();
    fireEvent.click(notesTab);

    await waitFor(() => {
      expect(api.fetchBookmarks).toHaveBeenCalledWith('note', undefined);
    });

    const docsTab = screen.getByRole('button', { name: /Documents/i });
    expect(docsTab).toBeInTheDocument();
    fireEvent.click(docsTab);

    await waitFor(() => {
      expect(api.fetchBookmarks).toHaveBeenCalledWith('document', undefined);
    });
  });

  it('supports creating a Standalone Note with formatting toolbar in Add modal', async () => {
    vi.mocked(api.createNoteBookmark).mockResolvedValue({
      id: 3,
      user_id: 1,
      url: 'slip://note/12345',
      title: 'Weekly Standup Notes',
      description: 'Review PDF and Note features',
      personal_note: '## Weekly Plan\n- **Item 1**\n- *Item 2*',
      content_type: 'note',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [{ id: 3, name: 'notes' }]
    });

    render(<App />);

    const saveBtn = screen.getByTitle('Save Link');
    fireEvent.click(saveBtn);

    const noteTab = screen.getByRole('button', { name: /New Note/i });
    fireEvent.click(noteTab);

    expect(screen.getByPlaceholderText(/Note title or leave blank/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Start typing your note/i)).toBeInTheDocument();

    // Check formatting toolbar buttons exist
    expect(screen.getByTitle(/Bold/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Italic/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Strikethrough/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Bullet List/i)).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText(/Note title or leave blank/i);
    fireEvent.change(titleInput, { target: { value: 'Weekly Standup Notes' } });

    const contentTextarea = screen.getByPlaceholderText(/Start typing your note/i);
    fireEvent.change(contentTextarea, { target: { value: '## Weekly Plan\n- **Item 1**' } });

    const submitBtn = screen.getByRole('button', { name: /Save Note/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.createNoteBookmark).toHaveBeenCalledWith({
        title: 'Weekly Standup Notes',
        content: '## Weekly Plan\n- **Item 1**',
        tags: []
      });
    });
  });

  it('toggles Clips view when Clips button is clicked in Navbar', async () => {
    vi.mocked(api.fetchClips).mockResolvedValue([
      {
        id: 10,
        user_id: 1,
        name: 'Hobbies',
        parent_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        item_count: 2,
        subclip_count: 1
      }
    ]);

    render(<App />);

    const clipsBtn = screen.getByRole('button', { name: /Clips/i });
    expect(clipsBtn).toBeInTheDocument();
    fireEvent.click(clipsBtn);

    await waitFor(() => {
      expect(screen.getByText('Clip Hierarchy')).toBeInTheDocument();
      expect(screen.getByText('All Clips (Root)')).toBeInTheDocument();
      expect(screen.getByText('Hobbies')).toBeInTheDocument();
      expect(localStorage.getItem('slip_clips_view')).toBe('true');
    });

    // Clicking Main Stream button returns to feed and updates persistence
    const backBtn = screen.getByRole('button', { name: /Clips & Folders/i });
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(screen.queryByText('Clip Hierarchy')).not.toBeInTheDocument();
      expect(localStorage.getItem('slip_clips_view')).toBe('false');
    });
  });

  it('renders tactile pushpin on bookmark cards and toggles pin status on click', async () => {
    const mockPins: Bookmark[] = [
      {
        id: 101,
        user_id: 1,
        url: 'https://example.com/pinned-item',
        title: 'Important Pinned Architecture Memo',
        description: 'Key system diagram',
        content_type: 'website',
        is_pinned: true,
        pinned_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: []
      },
      {
        id: 102,
        user_id: 1,
        url: 'https://example.com/unpinned-item',
        title: 'Regular Unpinned Article',
        description: 'Just a regular read',
        content_type: 'website',
        is_pinned: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: []
      }
    ];

    vi.mocked(api.fetchBookmarks).mockResolvedValue(mockPins);
    vi.mocked(api.fetchPinConfig).mockResolvedValue({ maxPinnedSlips: 5 });
    vi.mocked(api.togglePinBookmark).mockResolvedValue({
      ...mockPins[1],
      is_pinned: true,
      pinned_at: new Date().toISOString()
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Important Pinned Architecture Memo')).toBeInTheDocument();
      expect(screen.getByText('Regular Unpinned Article')).toBeInTheDocument();
      expect(screen.getByText(/1 of 5 slips pinned to top/i)).toBeInTheDocument();
    });

    // Check pushpin button for unpinned article
    const unpinnedBtn = screen.getByRole('button', { name: 'Pin slip to top' });
    expect(unpinnedBtn).toBeInTheDocument();

    fireEvent.click(unpinnedBtn);

    await waitFor(() => {
      expect(api.togglePinBookmark).toHaveBeenCalledWith(102);
    });
  });

  it('displays notice when attempting to pin beyond maxPinnedSlips limit', async () => {
    const mockPinnedList: Bookmark[] = [
      {
        id: 201,
        user_id: 1,
        url: 'https://example.com/p1',
        title: 'Pinned Item 1',
        description: 'First pinned item',
        content_type: 'website',
        is_pinned: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: []
      },
      {
        id: 202,
        user_id: 1,
        url: 'https://example.com/p2',
        title: 'Pinned Item 2',
        description: 'Second pinned item',
        content_type: 'website',
        is_pinned: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: []
      },
      {
        id: 203,
        user_id: 1,
        url: 'https://example.com/p3',
        title: 'Unpinned Item 3',
        description: 'Third unpinned item',
        content_type: 'website',
        is_pinned: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: []
      }
    ];

    vi.mocked(api.fetchBookmarks).mockResolvedValue(mockPinnedList);
    vi.mocked(api.fetchPinConfig).mockResolvedValue({ maxPinnedSlips: 2 });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Pinned Item 1')).toBeInTheDocument();
      expect(screen.getByText('Unpinned Item 3')).toBeInTheDocument();
      expect(screen.getByText(/2 of 2 slips pinned to top/i)).toBeInTheDocument();
    });

    const unpinBtn = screen.getByRole('button', { name: 'Pin slip to top' });
    fireEvent.click(unpinBtn);

    await waitFor(() => {
      expect(screen.getByText(/Pinboard full! You can pin up to 2 slips at once/i)).toBeInTheDocument();
      expect(api.togglePinBookmark).not.toHaveBeenCalled();
    });
  });
});



import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { BookmarkCard } from '../components/BookmarkCard';
import { ClipsView } from '../components/ClipsView';
import { App } from '../App';
import * as api from '../api';
import { Bookmark, Clip } from '../types';

vi.mock('../api', () => ({
  fetchBookmarks: vi.fn(),
  searchBookmarks: vi.fn(),
  fetchTags: vi.fn(),
  createBookmark: vi.fn(),
  uploadFileBookmark: vi.fn(),
  createNoteBookmark: vi.fn(),
  deleteBookmark: vi.fn(),
  restoreBookmark: vi.fn(),
  permanentlyDeleteBookmark: vi.fn(),
  emptyRecycleClip: vi.fn(),
  fetchRecycleClip: vi.fn(),
  fetchRecycleClips: vi.fn(),
  restoreClip: vi.fn(),
  permanentlyDeleteClip: vi.fn(),
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
  fetchClips: vi.fn(),
  fetchClip: vi.fn(),
  createClip: vi.fn(),
  updateClip: vi.fn(),
  deleteClip: vi.fn(),
  removeBookmarkFromClip: vi.fn(),
  fetchBookmarkClips: vi.fn(),
  setBookmarkClip: vi.fn(),
  setBookmarkClips: vi.fn()
}));

describe('Story 14: Recycle Clip Frontend UX & Components', () => {
  const sampleBookmark: Bookmark = {
    id: 10,
    user_id: 1,
    url: 'https://example.com/item1',
    title: 'Item to Recycle',
    description: 'A test slip for recycling bin',
    content_type: 'website',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const trashedBookmark: Bookmark = {
    id: 20,
    user_id: 1,
    url: 'https://example.com/trashed-item',
    title: 'Trashed Slip',
    description: 'Waiting in Recycle Clip',
    content_type: 'article',
    deleted_at: new Date().toISOString(),
    original_clip_name: 'Hobbies',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const mockRootClips: Clip[] = [
    {
      id: 1,
      user_id: 1,
      name: 'Work',
      parent_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      item_count: 2,
      subclip_count: 0
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(api.getMe).mockResolvedValue({ user: { id: 1, username: 'testuser', isAdmin: true } });
    vi.mocked(api.getAuthStatus).mockResolvedValue({ initialized: true });
    vi.mocked(api.fetchBookmarks).mockResolvedValue([sampleBookmark]);
    vi.mocked(api.fetchPinConfig).mockResolvedValue({ maxPinnedSlips: 5 });
    vi.mocked(api.fetchTags).mockResolvedValue([]);
    vi.mocked(api.fetchClips).mockResolvedValue(mockRootClips);
    vi.mocked(api.fetchRecycleClip).mockResolvedValue([trashedBookmark]);
    vi.mocked(api.fetchRecycleClips).mockResolvedValue([]);
    vi.mocked(api.fetchAIConfig).mockResolvedValue({
      isConnected: false,
      provider: 'openai',
      maskedApiKey: '',
      apiUrl: '',
      lastTestedAt: null,
      isAdmin: true
    });
  });

  describe('BookmarkCard Recycle Bin & Active Modes', () => {
    it('renders "Move to Recycle Clip" in active mode dropdown menu', () => {
      const onDeleteMock = vi.fn();
      render(
        <BookmarkCard
          bookmark={sampleBookmark}
          onDelete={onDeleteMock}
        />
      );

      const moreBtn = screen.getByTitle('More actions');
      fireEvent.click(moreBtn);

      const moveItem = screen.getByText('Move to Recycle Clip');
      expect(moveItem).toBeInTheDocument();

      fireEvent.click(moveItem);
      expect(onDeleteMock).toHaveBeenCalledWith(10);
    });

    it('renders Restore and Delete Forever action buttons in isRecycleBin mode', () => {
      const onRestoreMock = vi.fn();
      const onPermanentDeleteMock = vi.fn();

      render(
        <BookmarkCard
          bookmark={trashedBookmark}
          isRecycleBin={true}
          onRestore={onRestoreMock}
          onPermanentDelete={onPermanentDeleteMock}
        />
      );

      // Verify direct action buttons are visible without opening menu
      const restoreBtn = screen.getByTitle('Restore Slip to active archive');
      expect(restoreBtn).toBeInTheDocument();
      expect(screen.getByText('Restore')).toBeInTheDocument();

      const permDeleteBtn = screen.getByTitle('Permanently eradicate this slip');
      expect(permDeleteBtn).toBeInTheDocument();
      expect(screen.getByText('Delete Forever')).toBeInTheDocument();

      // Click restore
      fireEvent.click(restoreBtn);
      expect(onRestoreMock).toHaveBeenCalledWith(20);

      // Click permanent delete
      fireEvent.click(permDeleteBtn);
      expect(onPermanentDeleteMock).toHaveBeenCalledWith(20);
    });
  });

  describe('ClipsView Recycle Clip Integration', () => {
    it('displays Recycle Clip tile and spine link with item counts', async () => {
      render(
        <ClipsView
          onBackToFeed={vi.fn()}
          onOpenReader={vi.fn()}
          onShare={vi.fn()}
          onEdit={vi.fn()}
          onRescrape={vi.fn()}
          onDeleteBookmark={vi.fn()}
          onTagClick={vi.fn()}
          onManageBookmarkClips={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('All Clips (Root)')).toBeInTheDocument();
      });

      // Spine link and shelf banner should both display Recycle Clip
      const recycleTexts = screen.getAllByText('Recycle Clip');
      expect(recycleTexts.length).toBeGreaterThanOrEqual(1);

      // Verify count text / badge
      expect(screen.getAllByText(/1 deleted slip|1/i).length).toBeGreaterThan(0);
    });

    it('opens Recycle Clip view and handles Safe Empty Modal', async () => {
      vi.mocked(api.emptyRecycleClip).mockResolvedValue({ message: 'Recycle clip emptied', deletedCount: 1 });

      const { container } = render(
        <ClipsView
          onBackToFeed={vi.fn()}
          onOpenReader={vi.fn()}
          onShare={vi.fn()}
          onEdit={vi.fn()}
          onRescrape={vi.fn()}
          onDeleteBookmark={vi.fn()}
          onTagClick={vi.fn()}
          onManageBookmarkClips={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('All Clips (Root)')).toBeInTheDocument();
      });

      // Click the Recycle Clip shelf button or spine link
      const recycleCard = screen.getAllByText('Recycle Clip')[0];
      fireEvent.click(recycleCard);

      await waitFor(() => {
        expect(screen.getByText('Trashed Slip')).toBeInTheDocument();
      });

      // Click Empty Recycle Clip button in deck header
      const emptyBtn = screen.getByRole('button', { name: /Empty Recycle Clip/i });
      expect(emptyBtn).toBeInTheDocument();
      fireEvent.click(emptyBtn);

      // Safe Empty Modal appears
      await waitFor(() => {
        expect(screen.getByText('Empty Recycle Clip?')).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you want to permanently delete all/)).toBeInTheDocument();
      });

      // Click confirm in modal footer
      const confirmEmptyBtn = container.querySelector('.modal-footer button.btn-primary') as HTMLElement;
      expect(confirmEmptyBtn).toBeInTheDocument();
      fireEvent.click(confirmEmptyBtn);

      await waitFor(() => {
        expect(api.emptyRecycleClip).toHaveBeenCalled();
      });
    });

    it('displays soft-deleted clips in Recycle Clip view and handles clip restore', async () => {
      const trashedClip: Clip = {
        id: 99,
        user_id: 1,
        name: 'Archived Projects',
        parent_id: null,
        deleted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        item_count: 3,
        subclip_count: 0
      };

      vi.mocked(api.fetchRecycleClips).mockResolvedValue([trashedClip]);
      vi.mocked(api.restoreClip).mockResolvedValue({ message: 'Clip restored', clip: trashedClip });

      render(
        <ClipsView
          initialViewRecycleClip={true}
          onBackToFeed={vi.fn()}
          onOpenReader={vi.fn()}
          onShare={vi.fn()}
          onEdit={vi.fn()}
          onRescrape={vi.fn()}
          onDeleteBookmark={vi.fn()}
          onTagClick={vi.fn()}
          onManageBookmarkClips={vi.fn()}
        />
      );

      // Verify soft-deleted clip card appears in the recycle view
      await waitFor(() => {
        expect(screen.getByText('Archived Projects')).toBeInTheDocument();
        expect(screen.getByText('Deleted Clips (1)')).toBeInTheDocument();
      });

      // Find restore button for clip
      const restoreButtons = screen.getAllByRole('button', { name: /Restore/i });
      fireEvent.click(restoreButtons[0]);

      await waitFor(() => {
        expect(api.restoreClip).toHaveBeenCalledWith(99);
      });
    });

    it('opens Delete Clip modal with sub-clips inclusion checkbox', async () => {
      const parentClipWithChildren: Clip = {
        id: 50,
        user_id: 1,
        name: 'Parent Deck',
        parent_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        item_count: 1,
        subclip_count: 2
      };

      vi.mocked(api.fetchClips).mockResolvedValue([parentClipWithChildren]);
      vi.mocked(api.deleteClip).mockResolvedValue({ message: 'Clip moved to Recycle Clip', id: 50, includedChildren: true });

      const { container } = render(
        <ClipsView
          onBackToFeed={vi.fn()}
          onOpenReader={vi.fn()}
          onShare={vi.fn()}
          onEdit={vi.fn()}
          onRescrape={vi.fn()}
          onDeleteBookmark={vi.fn()}
          onTagClick={vi.fn()}
          onManageBookmarkClips={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Parent Deck')).toBeInTheDocument();
      });

      // Click delete button on the clip card
      const delBtn = screen.getByTitle('Delete clip');
      fireEvent.click(delBtn);

      // Verify Delete Clip Modal appears
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Delete Clip' })).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument();
        expect(screen.getByText('Include all sub-clips and slips within')).toBeInTheDocument();
      });

      // Click confirm in modal footer
      const confirmMoveBtn = container.querySelector('.modal-footer button.btn-primary') as HTMLElement;
      expect(confirmMoveBtn).toBeInTheDocument();
      fireEvent.click(confirmMoveBtn);

      await waitFor(() => {
        expect(api.deleteClip).toHaveBeenCalledWith(50, true);
      });
    });
  });

  describe('Navbar 1-Click Direct Access & App Instant Undo Toast', () => {
    it('opens Recycle Clip directly in 1-click when clicking Recycle button in Navbar', async () => {
      const { container } = render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Item to Recycle')).toBeInTheDocument();
      });

      // Navbar has Recycle quick button
      const navRecycleBtn = container.querySelector('.nav-recycle-btn') as HTMLElement;
      expect(navRecycleBtn).toBeInTheDocument();

      // Click navbar recycle button
      fireEvent.click(navRecycleBtn);

      // Directly switches to Recycle Clip view
      await waitFor(() => {
        expect(screen.getByText('Trashed Slip')).toBeInTheDocument();
        expect(screen.getAllByText('Empty Recycle Clip').length).toBeGreaterThan(0);
      });
    });

    it('shows floating 6-second Undo Toast on delete and restores bookmark when Undo is clicked', async () => {
      vi.mocked(api.deleteBookmark).mockResolvedValue({ message: 'Bookmark moved to Recycle Clip' });
      vi.mocked(api.restoreBookmark).mockResolvedValue({ message: 'Bookmark restored', bookmark: sampleBookmark });

      const { container } = render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Item to Recycle')).toBeInTheDocument();
      });

      // Open card dropdown and click Move to Recycle Clip
      const cardMoreBtn = container.querySelector('.card-more-btn') as HTMLElement;
      expect(cardMoreBtn).toBeInTheDocument();
      fireEvent.click(cardMoreBtn);

      const moveBtn = screen.getByText('Move to Recycle Clip');
      fireEvent.click(moveBtn);

      // Instant Undo Toast should appear
      await waitFor(() => {
        expect(screen.getByText(/Moved/)).toBeInTheDocument();
        expect(screen.getByText(/"Item to Recycle"/)).toBeInTheDocument();
      });

      // Item should be removed from active view
      expect(screen.queryByText('A test slip for recycling bin')).not.toBeInTheDocument();

      // Click Undo button
      const undoBtn = screen.getByRole('button', { name: /Undo/i });
      fireEvent.click(undoBtn);

      await waitFor(() => {
        expect(api.restoreBookmark).toHaveBeenCalledWith(10);
      });

      // Slip should be restored to the view
      await waitFor(() => {
        expect(screen.getByText('Item to Recycle')).toBeInTheDocument();
      });
    });
  });
});

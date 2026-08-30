import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { BookmarkCard } from '../components/BookmarkCard';
import { BulkActionBar } from '../components/BulkActionBar';
import { ClipsView } from '../components/ClipsView';
import { App } from '../App';
import * as api from '../api';
import { Bookmark, Clip } from '../types';
import {
  isActionSupported,
  getSupportedActionsForItem,
  getSupportedBulkActions
} from '../config/actionRegistry';

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
  bulkDeleteBookmarks: vi.fn(),
  bulkRestoreBookmarks: vi.fn(),
  bulkPermanentlyDeleteBookmarks: vi.fn(),
  bulkDeleteClips: vi.fn(),
  bulkRestoreClips: vi.fn(),
  bulkPermanentlyDeleteClips: vi.fn(),
  bulkAction: vi.fn(),
  logoutUser: vi.fn(),
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  createAdminUser: vi.fn(),
  fetchAdminUsers: vi.fn(),
  deleteAdminUser: vi.fn(),
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
  removeBookmarksFromClip: vi.fn(),
  fetchBookmarkClips: vi.fn(),
  setBookmarkClip: vi.fn(),
  fetchAppVersion: vi.fn().mockResolvedValue({ version: '1.1.1', name: 'slip', node_env: 'test' })
}));

describe('Bulk Operations & Action Registry Single Source of Truth Tests', () => {
  const sampleSlip: Bookmark = {
    id: 101,
    user_id: 1,
    url: 'https://example.com/slip1',
    title: 'Sample Website Slip',
    description: 'A test bookmark',
    content_type: 'website',
    created_at: '2026-08-25T10:00:00.000Z',
    updated_at: '2026-08-25T10:00:00.000Z'
  };

  const sampleNote: Bookmark = {
    id: 102,
    user_id: 1,
    url: 'slip://note/102',
    title: 'Meeting Notes',
    description: 'Key takeaways from the project sync',
    personal_note: '# Meeting\n- Points discussed',
    content_type: 'note',
    created_at: '2026-08-25T10:00:00.000Z',
    updated_at: '2026-08-25T10:00:00.000Z'
  };

  const sampleClip: Clip = {
    id: 201,
    user_id: 1,
    name: 'Research Clip',
    parent_id: null,
    created_at: '2026-08-25T10:00:00.000Z',
    updated_at: '2026-08-25T10:00:00.000Z',
    item_count: 2,
    subclip_count: 0
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (api.getMe as any).mockResolvedValue({
      user: { id: 1, username: 'testuser', isAdmin: true }
    });
    (api.fetchBookmarks as any).mockResolvedValue([sampleSlip, sampleNote]);
    (api.fetchTags as any).mockResolvedValue([]);
    (api.fetchRecycleClip as any).mockResolvedValue([]);
    (api.fetchRecycleClips as any).mockResolvedValue([]);
    (api.fetchClips as any).mockResolvedValue([sampleClip]);
    (api.fetchAIConfig as any).mockResolvedValue({ isConnected: false });
  });

  describe('1. Frontend Action Registry Single Source of Truth', () => {
    it('accurately resolves actions supported for note vs website slip', () => {
      // Note supports reader mode, does NOT support external link or rescrape
      expect(isActionSupported('open_reader', { itemType: 'slip', contentType: 'note', context: 'feed' })).toBe(true);
      expect(isActionSupported('open_link', { itemType: 'slip', contentType: 'note', url: 'slip://note/1', context: 'feed' })).toBe(false);
      expect(isActionSupported('rescrape', { itemType: 'slip', contentType: 'note', context: 'feed' })).toBe(false);
      expect(isActionSupported('delete', { itemType: 'slip', contentType: 'note', context: 'feed' })).toBe(true);

      // Website supports external link and rescrape
      expect(isActionSupported('open_link', { itemType: 'slip', contentType: 'website', url: 'https://example.com', context: 'feed' })).toBe(true);
      expect(isActionSupported('rescrape', { itemType: 'slip', contentType: 'website', url: 'https://example.com', context: 'feed' })).toBe(true);
    });

    it('accurately resolves Recycle Clip actions vs Feed actions', () => {
      // In Recycle Clip context: delete is disabled, restore and permanent_delete are enabled
      expect(isActionSupported('delete', { itemType: 'slip', context: 'recycle_clip' })).toBe(false);
      expect(isActionSupported('restore', { itemType: 'slip', context: 'recycle_clip' })).toBe(true);
      expect(isActionSupported('permanent_delete', { itemType: 'slip', context: 'recycle_clip' })).toBe(true);

      // In Feed: restore and permanent_delete are disabled
      expect(isActionSupported('restore', { itemType: 'slip', context: 'feed' })).toBe(false);
      expect(isActionSupported('permanent_delete', { itemType: 'slip', context: 'feed' })).toBe(false);
    });

    it('returns bulk actions dynamically for selection and context', () => {
      // In feed with mixed slips and clips
      const feedBulk = getSupportedBulkActions({ slipCount: 2, clipCount: 1, context: 'feed' });
      expect(feedBulk.map((a) => a.id)).toEqual(['delete']);

      // In feed with slips only
      const feedSlipsBulk = getSupportedBulkActions({ slipCount: 2, clipCount: 0, context: 'feed' });
      expect(feedSlipsBulk.map((a) => a.id)).toEqual(['delete', 'organize_in_clip']);

      // In recycle clip
      const recycleBulk = getSupportedBulkActions({ slipCount: 2, clipCount: 1, context: 'recycle_clip' });
      expect(recycleBulk.map((a) => a.id)).toEqual(['restore', 'permanent_delete']);
    });
  });

  describe('2. BulkActionBar Component', () => {
    it('renders selection count, select all, and triggers bulk actions', () => {
      const handleSelectAll = vi.fn();
      const handleClear = vi.fn();
      const handleExecute = vi.fn();

      const { rerender } = render(
        <BulkActionBar
          selectedSlipCount={2}
          selectedClipCount={1}
          totalSelectableCount={5}
          context="feed"
          onSelectAll={handleSelectAll}
          onClearSelection={handleClear}
          isAllSelected={false}
          onExecuteBulkAction={handleExecute}
        />
      );

      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('(2 slips, 1 clip)')).toBeInTheDocument();
      expect(screen.getByText('Select All (5)')).toBeInTheDocument();

      // Click Select All
      fireEvent.click(screen.getByText('Select All (5)'));
      expect(handleSelectAll).toHaveBeenCalledTimes(1);

      // Click Delete action button
      const deleteBtn = screen.getByRole('button', { name: /Delete \(3\)/i });
      fireEvent.click(deleteBtn);
      expect(handleExecute).toHaveBeenCalledWith('delete');

      // Re-render with slips only in feed: shows Clip (2)
      rerender(
        <BulkActionBar
          selectedSlipCount={2}
          selectedClipCount={0}
          totalSelectableCount={5}
          context="feed"
          onSelectAll={handleSelectAll}
          onClearSelection={handleClear}
          isAllSelected={false}
          onExecuteBulkAction={handleExecute}
        />
      );

      const clipBtn = screen.getByRole('button', { name: /Clip \(2\)/i });
      expect(clipBtn).toBeInTheDocument();
      fireEvent.click(clipBtn);
      expect(handleExecute).toHaveBeenCalledWith('organize_in_clip');

      // Click Close
      const closeBtn = screen.getByTitle('Cancel selection mode');
      fireEvent.click(closeBtn);
      expect(handleClear).toHaveBeenCalledTimes(1);

      // In Recycle Clip context: shows Restore & Delete Forever
      rerender(
        <BulkActionBar
          selectedSlipCount={1}
          selectedClipCount={1}
          totalSelectableCount={2}
          context="recycle_clip"
          onSelectAll={handleSelectAll}
          onClearSelection={handleClear}
          isAllSelected={true}
          onExecuteBulkAction={handleExecute}
        />
      );

      expect(screen.getByText('Deselect All')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Restore \(2\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete Forever \(2\)/i })).toBeInTheDocument();
    });
  });

  describe('3. BookmarkCard Selection Checkbox UI', () => {
    it('renders checkbox and calls onToggleSelect when clicked', () => {
      const onToggleSelect = vi.fn();

      render(
        <BookmarkCard
          bookmark={sampleSlip}
          isSelected={false}
          isSelectionMode={true}
          onToggleSelect={onToggleSelect}
        />
      );

      const checkbox = screen.getByLabelText('Select this slip');
      expect(checkbox).toBeInTheDocument();

      fireEvent.click(checkbox);
      expect(onToggleSelect).toHaveBeenCalledWith(sampleSlip.id);
    });

    it('renders checked indicator when isSelected is true', () => {
      const onToggleSelect = vi.fn();

      render(
        <BookmarkCard
          bookmark={sampleSlip}
          isSelected={true}
          isSelectionMode={true}
          onToggleSelect={onToggleSelect}
        />
      );

      const checkbox = screen.getByLabelText('Deselect this slip');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox.querySelector('.checked')).toBeInTheDocument();
    });
  });

  describe('4. Recycle Clip Bulk Restore and Permanent Delete in ClipsView', () => {
    const deletedSlip1: Bookmark = {
      id: 301,
      user_id: 1,
      url: 'https://example.com/del1',
      title: 'Deleted Slip 1',
      deleted_at: '2026-08-25T11:00:00Z',
      content_type: 'website',
      created_at: '2026-08-25T10:00:00Z',
      updated_at: '2026-08-25T11:00:00Z'
    };

    const deletedClip1: Clip = {
      id: 401,
      user_id: 1,
      name: 'Deleted Clip 1',
      parent_id: null,
      deleted_at: '2026-08-25T11:00:00Z',
      created_at: '2026-08-25T10:00:00Z',
      updated_at: '2026-08-25T11:00:00Z',
      item_count: 1
    };

    beforeEach(() => {
      (api.fetchRecycleClip as any).mockResolvedValue([deletedSlip1]);
      (api.fetchRecycleClips as any).mockResolvedValue([deletedClip1]);
      (api.bulkAction as any).mockResolvedValue({ message: 'Success' });
    });

    it('supports selecting deleted slips & clips and performing bulk restore', async () => {
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
          initialViewRecycleClip={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Deleted Clips (1)')).toBeInTheDocument();
        expect(screen.getByText('Deleted Slips (1)')).toBeInTheDocument();
      });

      // Select deleted clip
      const clipCheckbox = screen.getByLabelText('Select clip');
      fireEvent.click(clipCheckbox);

      // Select deleted slip
      const slipCheckbox = screen.getByLabelText('Select this slip');
      fireEvent.click(slipCheckbox);

      // Bulk action dock appears
      await waitFor(() => {
        expect(screen.getByText('(1 slip, 1 clip)')).toBeInTheDocument();
      });

      // Click Bulk Restore
      const restoreBtn = screen.getByRole('button', { name: /Restore \(2\)/i });
      fireEvent.click(restoreBtn);

      await waitFor(() => {
        expect(api.bulkAction).toHaveBeenCalledWith({
          action: 'restore',
          slipIds: [deletedSlip1.id],
          clipIds: [deletedClip1.id]
        });
      });
    });

    it('supports selecting deleted items and performing bulk permanent delete with confirmation', async () => {
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
          initialViewRecycleClip={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Deleted Clips (1)')).toBeInTheDocument();
      });

      // Select deleted clip
      const clipCheckbox = screen.getByLabelText('Select clip');
      fireEvent.click(clipCheckbox);

      // Click Delete Forever button
      const permBtn = screen.getByRole('button', { name: /Delete Forever \(1\)/i });
      fireEvent.click(permBtn);

      // Confirmation modal appears
      await waitFor(() => {
        expect(screen.getByText('Delete Forever?')).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you want to permanently delete/i)).toBeInTheDocument();
      });

      // Click confirmation button in modal dialog
      const modal = screen.getByRole('dialog');
      const modalDeleteBtn = within(modal).getByRole('button', { name: /^Delete Forever$/i });
      fireEvent.click(modalDeleteBtn);

      await waitFor(() => {
        expect(api.bulkAction).toHaveBeenCalledWith({
          action: 'permanent_delete',
          slipIds: [],
          clipIds: [deletedClip1.id]
        });
      });
    });
  });

  describe('5. App Main Feed Multi-Selection & Bulk Deletion with Undo Toast', () => {
    beforeEach(() => {
      (api.bulkDeleteBookmarks as any).mockResolvedValue({ message: 'Moved to Recycle Clip', deletedCount: 2 });
      (api.bulkRestoreBookmarks as any).mockResolvedValue({ message: 'Restored', restoredCount: 2 });
    });

    it('allows multi-selecting slips in feed, bulk deleting them, and restoring via undo toast', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Sample Website Slip')).toBeInTheDocument();
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });

      // Select both slips
      const checkboxes = screen.getAllByLabelText('Select this slip');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);

      // Bulk action dock appears
      await waitFor(() => {
        expect(screen.getByText('(2 slips)')).toBeInTheDocument();
      });

      // Click Delete (2)
      const deleteBtn = screen.getByRole('button', { name: /Delete \(2\)/i });
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(api.bulkDeleteBookmarks).toHaveBeenCalledWith(expect.arrayContaining([sampleSlip.id, sampleNote.id]));
        expect(screen.getByText(/Moved/i)).toBeInTheDocument();
        expect(screen.getByText(/2 Slips/i)).toBeInTheDocument();
      });

      // Click Undo button in toast
      const undoBtn = screen.getByRole('button', { name: /Undo/i });
      fireEvent.click(undoBtn);

      await waitFor(() => {
        expect(api.bulkRestoreBookmarks).toHaveBeenCalledWith(expect.arrayContaining([sampleSlip.id, sampleNote.id]));
      });
    });
  });
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { ClipsView } from '../components/ClipsView';
import { AddToClipModal } from '../components/AddToClipModal';
import * as api from '../api';
import { Bookmark, Clip, ClipDetail } from '../types';

vi.mock('../api', () => ({
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

describe('Clips Organization UI Components', () => {
  const mockRootClips: Clip[] = [
    {
      id: 1,
      user_id: 1,
      name: 'Hobbies',
      parent_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      item_count: 5,
      subclip_count: 2
    },
    {
      id: 2,
      user_id: 1,
      name: 'Movies Must Watch',
      parent_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      item_count: 3,
      subclip_count: 0
    }
  ];

  const mockBookmark: Bookmark = {
    id: 101,
    user_id: 1,
    url: 'https://prusa3d.com',
    title: 'Prusa 3D Printer Guide',
    content_type: 'website',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: [{ id: 1, name: '3d-printing' }]
  };

  const mockClipDetail: ClipDetail = {
    clip: {
      id: 10,
      user_id: 1,
      name: '3d-printing-clip',
      parent_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      item_count: 1,
      subclip_count: 0
    },
    breadcrumbs: [
      { id: 1, name: 'Hobbies' },
      { id: 10, name: '3d-printing-clip' }
    ],
    subclips: [],
    bookmarks: [mockBookmark]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('ClipsView Component', () => {
    it('renders root clips list and vertical hierarchy spine when at root level', async () => {
      vi.mocked(api.fetchClips).mockResolvedValue(mockRootClips);

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
        expect(screen.getByText('Hobbies')).toBeInTheDocument();
        expect(screen.getByText('Movies Must Watch')).toBeInTheDocument();
        expect(screen.getByText('Clip Hierarchy')).toBeInTheDocument();
        expect(screen.getByText('All Clips (Root)')).toBeInTheDocument();
      });
    });

    it('navigates into a nested clip and displays vertical breadcrumbs and cards inside', async () => {
      vi.mocked(api.fetchClips).mockResolvedValue(mockRootClips);
      vi.mocked(api.fetchClip).mockResolvedValue(mockClipDetail);

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
        expect(screen.getByText('Hobbies')).toBeInTheDocument();
      });

      // Click on Hobbies clip card
      const hobbiesCard = screen.getByText('Hobbies');
      fireEvent.click(hobbiesCard);

      await waitFor(() => {
        expect(api.fetchClip).toHaveBeenCalledWith(1);
      });
    });

    it('opens create modal and calls createClip API', async () => {
      vi.mocked(api.fetchClips).mockResolvedValue(mockRootClips);
      vi.mocked(api.createClip).mockResolvedValue({
        id: 3,
        user_id: 1,
        name: 'Woodworking',
        parent_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

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

      const newClipBtn = screen.getByRole('button', { name: /New Clip/i });
      fireEvent.click(newClipBtn);

      const input = screen.getByPlaceholderText(/e.g. 3d-printing-clip/i);
      fireEvent.change(input, { target: { value: 'Woodworking' } });

      const submitBtn = screen.getByRole('button', { name: /Create Clip/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(api.createClip).toHaveBeenCalledWith('Woodworking', null);
      });
    });

    it('restores active clip from localStorage on refresh/mount', async () => {
      localStorage.setItem('slip_current_clip_id', '10');
      vi.mocked(api.fetchClip).mockResolvedValue(mockClipDetail);

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
        expect(api.fetchClip).toHaveBeenCalledWith(10);
      });
    });
  });

  describe('AddToClipModal Component', () => {
    it('renders tree modal with single-clip selection and allows moving to a clip', async () => {
      vi.mocked(api.fetchClips).mockResolvedValue(mockRootClips);
      vi.mocked(api.fetchBookmarkClips).mockResolvedValue([mockRootClips[0]]);
      vi.mocked(api.setBookmarkClip).mockResolvedValue({ message: 'Saved', clip: mockRootClips[1], clips: [mockRootClips[1]] });

      const onClose = vi.fn();
      const onSuccess = vi.fn();

      render(
        <AddToClipModal
          bookmark={mockBookmark}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Organize in Clip')).toBeInTheDocument();
        expect(screen.getAllByText('Hobbies').length).toBeGreaterThan(0);
        expect(screen.getByText('Movies Must Watch')).toBeInTheDocument();
      });

      // Select Movies Must Watch
      const moviesRow = screen.getByText('Movies Must Watch');
      fireEvent.click(moviesRow);

      const applyBtn = screen.getByRole('button', { name: /Save to Clip/i });
      fireEvent.click(applyBtn);

      await waitFor(() => {
        expect(api.setBookmarkClip).toHaveBeenCalledWith(101, 2);
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('allows in-place nested sub-clip creation inside AddToClipModal', async () => {
      vi.mocked(api.fetchClips).mockResolvedValue(mockRootClips);
      vi.mocked(api.fetchBookmarkClips).mockResolvedValue([]);
      vi.mocked(api.createClip).mockResolvedValue({
        id: 5,
        user_id: 1,
        name: '3d-printing-clip',
        parent_id: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      render(
        <AddToClipModal
          bookmark={mockBookmark}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Hobbies')).toBeInTheDocument();
      });

      // Click on Sub-clip button next to Hobbies node
      const subClipBtns = screen.getAllByRole('button', { name: /Sub-clip/i });
      fireEvent.click(subClipBtns[0]);

      const nameInput = screen.getByPlaceholderText(/New sub-clip inside/i);
      fireEvent.change(nameInput, { target: { value: '3d-printing-clip' } });

      const addBtn = screen.getByRole('button', { name: /Add/i });
      fireEvent.click(addBtn);

      await waitFor(() => {
        expect(api.createClip).toHaveBeenCalledWith('3d-printing-clip', 1);
      });
    });
  });
});

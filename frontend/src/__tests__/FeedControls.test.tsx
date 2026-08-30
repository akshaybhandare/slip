import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedToolbar } from '../components/FeedToolbar';
import { MasonryGrid } from '../components/MasonryGrid';
import { sortBookmarks, groupBookmarksByType } from '../utils/feedUtils';
import { Bookmark, ContentType } from '../types';
import { App } from '../App';
import * as api from '../api';

vi.mock('../api');

const mockBookmarks: Bookmark[] = [
  {
    id: 1,
    user_id: 1,
    url: 'https://example.com/article1',
    title: 'Alpha Article',
    description: 'First article',
    content_type: 'article',
    is_pinned: false,
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
    tags: []
  },
  {
    id: 2,
    user_id: 1,
    url: 'slip://note/2',
    title: 'Zeta Note',
    description: 'A quick memo',
    content_type: 'note',
    is_pinned: true,
    pinned_at: '2026-08-20T10:00:00Z',
    created_at: '2026-08-05T10:00:00Z',
    updated_at: '2026-08-05T10:00:00Z',
    tags: []
  },
  {
    id: 3,
    user_id: 1,
    url: 'https://example.com/article2',
    title: 'Beta Article',
    description: 'Second article',
    content_type: 'article',
    is_pinned: false,
    created_at: '2026-08-10T10:00:00Z',
    updated_at: '2026-08-15T10:00:00Z',
    tags: []
  },
  {
    id: 4,
    user_id: 1,
    url: 'slip://images/doc.pdf',
    title: 'Document PDF',
    description: 'A PDF file',
    content_type: 'document',
    is_pinned: false,
    created_at: '2026-08-12T10:00:00Z',
    updated_at: '2026-08-12T10:00:00Z',
    tags: []
  }
];

describe('Feed Controls & View Preferences (Sort & Group By)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('1. feedUtils sorting and grouping logic', () => {
    it('sorts bookmarks newest first by default with pinned slips at top', () => {
      const sorted = sortBookmarks(mockBookmarks, 'created_at', 'desc');
      // Pinned slip (id 2) must be first
      expect(sorted[0].id).toBe(2);
      // Remaining unpinned slips ordered by created_at desc: id 4 (Aug 12), id 3 (Aug 10), id 1 (Aug 1)
      expect(sorted.slice(1).map((b) => b.id)).toEqual([4, 3, 1]);
    });

    it('sorts bookmarks oldest first (created_at asc) with pinned slips remaining at top', () => {
      const sorted = sortBookmarks(mockBookmarks, 'created_at', 'asc');
      expect(sorted[0].id).toBe(2);
      // Unpinned slips ordered by created_at asc: id 1 (Aug 1), id 3 (Aug 10), id 4 (Aug 12)
      expect(sorted.slice(1).map((b) => b.id)).toEqual([1, 3, 4]);
    });

    it('sorts bookmarks by title (A to Z and Z to A) while preserving pinned priority', () => {
      const sortedAsc = sortBookmarks(mockBookmarks, 'title', 'asc');
      expect(sortedAsc[0].id).toBe(2);
      expect(sortedAsc.slice(1).map((b) => b.title)).toEqual([
        'Alpha Article',
        'Beta Article',
        'Document PDF'
      ]);

      const sortedDesc = sortBookmarks(mockBookmarks, 'title', 'desc');
      expect(sortedDesc[0].id).toBe(2);
      expect(sortedDesc.slice(1).map((b) => b.title)).toEqual([
        'Document PDF',
        'Beta Article',
        'Alpha Article'
      ]);
    });

    it('groups bookmarks by content type in structured sections with item counts', () => {
      const groups = groupBookmarksByType(mockBookmarks, 'created_at', 'desc');
      // Should have Articles, Notes, Documents groups
      const types = groups.map((g) => g.type);
      expect(types).toContain('article');
      expect(types).toContain('note');
      expect(types).toContain('document');

      const articleGroup = groups.find((g) => g.type === 'article');
      expect(articleGroup?.bookmarks.length).toBe(2);
      expect(articleGroup?.label).toBe('Articles');

      const noteGroup = groups.find((g) => g.type === 'note');
      expect(noteGroup?.bookmarks.length).toBe(1);
      expect(noteGroup?.label).toBe('Notes');
    });
  });

  describe('2. FeedToolbar Component', () => {
    it('renders sort and group selectors with current values and count', () => {
      const onSortChange = vi.fn();
      const onGroupByChange = vi.fn();

      render(
        <FeedToolbar
          sortBy="created_at"
          sortOrder="desc"
          groupBy="none"
          onSortChange={onSortChange}
          onGroupByChange={onGroupByChange}
          totalCount={4}
        />
      );

      expect(screen.getByText('4 slips')).toBeInTheDocument();
      expect(screen.getByTestId('feed-sort-select')).toHaveValue('created_at:desc');
      expect(screen.getByTestId('feed-group-select')).toHaveValue('none');
    });

    it('triggers onSortChange when user selects a different sort order', () => {
      const onSortChange = vi.fn();
      const onGroupByChange = vi.fn();

      render(
        <FeedToolbar
          sortBy="created_at"
          sortOrder="desc"
          groupBy="none"
          onSortChange={onSortChange}
          onGroupByChange={onGroupByChange}
          totalCount={4}
        />
      );

      const sortSelect = screen.getByTestId('feed-sort-select');
      fireEvent.change(sortSelect, { target: { value: 'created_at:asc' } });
      expect(onSortChange).toHaveBeenCalledWith('created_at', 'asc');

      fireEvent.change(sortSelect, { target: { value: 'title:asc' } });
      expect(onSortChange).toHaveBeenCalledWith('title', 'asc');
    });

    it('triggers onGroupByChange when user toggles group by type', () => {
      const onSortChange = vi.fn();
      const onGroupByChange = vi.fn();

      render(
        <FeedToolbar
          sortBy="created_at"
          sortOrder="desc"
          groupBy="none"
          onSortChange={onSortChange}
          onGroupByChange={onGroupByChange}
          totalCount={4}
        />
      );

      const groupSelect = screen.getByTestId('feed-group-select');
      fireEvent.change(groupSelect, { target: { value: 'type' } });
      expect(onGroupByChange).toHaveBeenCalledWith('type');
    });
  });

  describe('3. MasonryGrid with Group By Content Type', () => {
    it('renders collapsible section headers when groupBy is type', () => {
      const noop = vi.fn();
      render(
        <MasonryGrid
          bookmarks={mockBookmarks}
          onOpenReader={noop}
          onShare={noop}
          onEdit={noop}
          onRescrape={vi.fn()}
          onDelete={noop}
          onTagClick={noop}
          groupBy="type"
          sortBy="created_at"
          sortOrder="desc"
        />
      );

      expect(screen.getByTestId('group-header-article')).toBeInTheDocument();
      expect(screen.getByTestId('group-header-note')).toBeInTheDocument();
      expect(screen.getByTestId('group-header-document')).toBeInTheDocument();

      // Slips are rendered inside sections
      expect(screen.getByText('Alpha Article')).toBeInTheDocument();
      expect(screen.getByText('Zeta Note')).toBeInTheDocument();
    });

    it('allows expanding and collapsing grouped sections on click', () => {
      const noop = vi.fn();
      render(
        <MasonryGrid
          bookmarks={mockBookmarks}
          onOpenReader={noop}
          onShare={noop}
          onEdit={noop}
          onRescrape={vi.fn()}
          onDelete={noop}
          onTagClick={noop}
          groupBy="type"
          sortBy="created_at"
          sortOrder="desc"
        />
      );

      const articleHeader = screen.getByTestId('group-header-article');
      expect(articleHeader).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('Alpha Article')).toBeInTheDocument();

      // Collapse section
      fireEvent.click(articleHeader);
      expect(articleHeader).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText('Alpha Article')).not.toBeInTheDocument();

      // Expand section again
      fireEvent.click(articleHeader);
      expect(articleHeader).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('Alpha Article')).toBeInTheDocument();
    });
  });

  describe('4. Full App Integration & Settings Preferences', () => {
    it('initializes with default sorting and reflects changes in localStorage and Settings', async () => {
      vi.mocked(api.getMe).mockResolvedValue({ user: { id: 1, username: 'testuser', isAdmin: true } });
      vi.mocked(api.fetchBookmarks).mockResolvedValue(mockBookmarks);
      vi.mocked(api.fetchTags).mockResolvedValue([]);
      vi.mocked(api.fetchPinConfig).mockResolvedValue({ maxPinnedSlips: 5 });
      vi.mocked(api.fetchRecycleClip).mockResolvedValue([]);
      vi.mocked(api.fetchRecycleClips).mockResolvedValue([]);
      vi.mocked(api.fetchAIConfig).mockResolvedValue({
        isConnected: false,
        provider: 'openai',
        maskedApiKey: '',
        apiUrl: '',
        lastTestedAt: null,
        isAdmin: true
      });
      vi.mocked(api.fetchAppVersion).mockResolvedValue({ version: '1.1.1', node_env: 'test' });
      vi.mocked(api.fetchAPIKeys).mockResolvedValue([]);
      vi.mocked(api.fetchAdminUsers).mockResolvedValue([]);
      vi.mocked(api.getTelemetryStatus).mockResolvedValue({ disabled: false });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Alpha Article')).toBeInTheDocument();
        expect(screen.getByTestId('feed-sort-select')).toHaveValue('created_at:desc');
      });

      // Change sort in toolbar
      const sortSelect = screen.getByTestId('feed-sort-select');
      fireEvent.change(sortSelect, { target: { value: 'created_at:asc' } });

      expect(localStorage.getItem('slip_sort_by')).toBe('created_at');
      expect(localStorage.getItem('slip_sort_order')).toBe('asc');

      // Change grouping in toolbar
      const groupSelect = screen.getByTestId('feed-group-select');
      fireEvent.change(groupSelect, { target: { value: 'type' } });

      expect(localStorage.getItem('slip_group_by')).toBe('type');
      expect(screen.getByTestId('group-header-article')).toBeInTheDocument();

      // Change sort in toolbar to Title (A to Z)
      fireEvent.change(sortSelect, { target: { value: 'title:asc' } });
      expect(localStorage.getItem('slip_sort_by')).toBe('title');
      expect(localStorage.getItem('slip_sort_order')).toBe('asc');
    });
  });
});

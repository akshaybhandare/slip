import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReaderModal } from '../components/ReaderModal';
import { Bookmark } from '../types';
import * as api from '../api';

vi.mock('../api');

const mockPrimaryBookmark: Bookmark = {
  id: 101,
  user_id: 1,
  url: 'https://react.dev/blog/react-19',
  title: 'React 19 Server Components',
  description: 'Deep dive into actions, server components, and asset loading.',
  reader_html: '<p>React 19 brings unified async rendering.</p>',
  content_type: 'article',
  is_pinned: false,
  created_at: '2026-08-28T10:00:00Z',
  updated_at: '2026-08-28T10:00:00Z',
  tags: [{ id: 1, name: 'react', count: 4 }]
};

const mockRelatedBookmarks: Bookmark[] = [
  {
    id: 102,
    user_id: 1,
    url: 'https://nextjs.org/docs/app',
    title: 'Next.js App Router Architecture',
    description: 'Server components and routing guide for React applications.',
    reader_html: '<p>Next.js App Router uses React 19 primitives.</p>',
    content_type: 'article',
    is_pinned: false,
    created_at: '2026-08-28T11:00:00Z',
    updated_at: '2026-08-28T11:00:00Z',
    similarityScore: 88,
    tags: [{ id: 2, name: 'nextjs', count: 3 }]
  },
  {
    id: 103,
    user_id: 1,
    url: 'https://vuejs.org',
    title: 'Vue 3 Composition API Guide',
    description: 'Reactive state and composables in modern Vue.',
    reader_html: '<p>Vue 3 reactivity explained.</p>',
    content_type: 'article',
    is_pinned: false,
    created_at: '2026-08-28T12:00:00Z',
    updated_at: '2026-08-28T12:00:00Z',
    similarityScore: 65,
    tags: [{ id: 3, name: 'vue', count: 2 }]
  }
];

describe('On-Device Related Slips in Reader Mode (Issue #40)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchHighlights).mockResolvedValue([]);
    vi.mocked(api.fetchRelatedBookmarks).mockResolvedValue(mockRelatedBookmarks);
  });

  it('fetches and renders related slips cards with similarity score pills', async () => {
    render(
      <ReaderModal
        bookmark={mockPrimaryBookmark}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(api.fetchRelatedBookmarks).toHaveBeenCalledWith(101, 3);
    });

    expect(screen.getByTestId('reader-related-section')).toBeInTheDocument();
    expect(screen.getByText('Related Slips')).toBeInTheDocument();
    expect(screen.getByText('Next.js App Router Architecture')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();
    // 65% match is below the 70% confidence threshold so it must not be shown
    expect(screen.queryByText('Vue 3 Composition API Guide')).not.toBeInTheDocument();
    expect(screen.queryByText('65%')).not.toBeInTheDocument();
  });

  it('does not render related slips section if all matches are below 70%', async () => {
    vi.mocked(api.fetchRelatedBookmarks).mockResolvedValueOnce([
      {
        ...mockRelatedBookmarks[1],
        similarityScore: 55
      }
    ]);

    render(
      <ReaderModal
        bookmark={mockPrimaryBookmark}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(api.fetchRelatedBookmarks).toHaveBeenCalledWith(101, 3);
    });

    expect(screen.queryByTestId('reader-related-section')).not.toBeInTheDocument();
  });

  it('clicking a related slip switches the reader modal to view that slip', async () => {
    render(
      <ReaderModal
        bookmark={mockPrimaryBookmark}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Next.js App Router Architecture')).toBeInTheDocument();
    });

    const relatedCard = screen.getByTestId('reader-related-card-102');
    fireEvent.click(relatedCard);

    await waitFor(() => {
      expect(screen.getAllByText('Next.js App Router Architecture').length).toBeGreaterThanOrEqual(1);
      expect(api.fetchHighlights).toHaveBeenCalledWith(102);
    });
  });
});

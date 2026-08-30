import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReaderModal } from '../components/ReaderModal';
import { Bookmark, Tag } from '../types';
import * as api from '../api';

vi.mock('../api');

const mockBookmarkWithTags: Bookmark = {
  id: 42,
  user_id: 1,
  url: 'https://example.com/deep-dive-article',
  title: 'Architecture Deep Dive',
  description: 'An extensive breakdown of architecture patterns.',
  reader_html: '<p>Paragraph 1 of article text.</p><p>Paragraph 2.</p>',
  content_type: 'article',
  is_pinned: false,
  created_at: '2026-08-25T10:00:00Z',
  updated_at: '2026-08-25T10:00:00Z',
  tags: [
    { id: 1, name: 'architecture', count: 5 },
    { id: 2, name: 'react', count: 8 }
  ]
};

const mockNoteBookmarkWithoutTags: Bookmark = {
  id: 43,
  user_id: 1,
  url: 'slip://note/43',
  title: 'Meeting Notes',
  description: 'Team retrospective notes.',
  personal_note: '# Team Retro\n- Point 1\n- Point 2',
  content_type: 'note',
  is_pinned: false,
  created_at: '2026-08-26T10:00:00Z',
  updated_at: '2026-08-26T10:00:00Z',
  tags: []
};

const mockAvailableTags: Tag[] = [
  { id: 1, name: 'architecture', count: 5 },
  { id: 2, name: 'react', count: 8 },
  { id: 3, name: 'performance', count: 3 },
  { id: 4, name: 'database', count: 2 }
];

describe('Reader Mode Tags Display & Management (Issue #36)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchHighlights).mockResolvedValue([]);
  });

  it('renders existing tags attached to the slip in Reader Mode', async () => {
    render(
      <ReaderModal
        bookmark={mockBookmarkWithTags}
        onClose={vi.fn()}
        onTagClick={vi.fn()}
      />
    );

    expect(screen.getByTestId('reader-tags-section')).toBeInTheDocument();
    expect(screen.getByText('Tags (2)')).toBeInTheDocument();
    expect(screen.getByText('#architecture')).toBeInTheDocument();
    expect(screen.getByText('#react')).toBeInTheDocument();
  });

  it('triggers onTagClick when clicking a tag pill inside Reader Mode', async () => {
    const handleTagClick = vi.fn();
    render(
      <ReaderModal
        bookmark={mockBookmarkWithTags}
        onClose={vi.fn()}
        onTagClick={handleTagClick}
      />
    );

    const archTagBtn = screen.getByRole('button', { name: /#architecture/i });
    fireEvent.click(archTagBtn);

    expect(handleTagClick).toHaveBeenCalledWith('architecture');
  });

  it('displays empty state hint when a slip has no tags', async () => {
    render(
      <ReaderModal
        bookmark={mockNoteBookmarkWithoutTags}
        onClose={vi.fn()}
        onTagClick={vi.fn()}
      />
    );

    expect(screen.getByText(/No tags attached/i)).toBeInTheDocument();
  });

  it('allows adding a new tag via inline input and triggers onUpdateTags', async () => {
    const handleUpdateTags = vi.fn().mockResolvedValue(undefined);
    render(
      <ReaderModal
        bookmark={mockBookmarkWithTags}
        onClose={vi.fn()}
        onTagClick={vi.fn()}
        onUpdateTags={handleUpdateTags}
        availableTags={mockAvailableTags}
      />
    );

    const addTagBtn = screen.getByTestId('reader-add-tag-btn');
    fireEvent.click(addTagBtn);

    const tagInput = screen.getByTestId('reader-tag-input');
    expect(tagInput).toBeInTheDocument();

    fireEvent.change(tagInput, { target: { value: 'typescript' } });
    const saveBtn = screen.getByTestId('reader-tag-save-btn');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(handleUpdateTags).toHaveBeenCalledWith(42, ['architecture', 'react', 'typescript']);
      expect(screen.getByText('#typescript')).toBeInTheDocument();
    });
  });

  it('supports selecting suggested tags when adding a tag', async () => {
    const handleUpdateTags = vi.fn().mockResolvedValue(undefined);
    render(
      <ReaderModal
        bookmark={mockBookmarkWithTags}
        onClose={vi.fn()}
        onTagClick={vi.fn()}
        onUpdateTags={handleUpdateTags}
        availableTags={mockAvailableTags}
      />
    );

    const addTagBtn = screen.getByTestId('reader-add-tag-btn');
    fireEvent.click(addTagBtn);

    // Suggestions should show 'performance' and 'database' (since architecture and react are already selected)
    const perfSuggestion = screen.getByRole('button', { name: /#performance/i });
    expect(perfSuggestion).toBeInTheDocument();

    fireEvent.click(perfSuggestion);

    await waitFor(() => {
      expect(handleUpdateTags).toHaveBeenCalledWith(42, ['architecture', 'react', 'performance']);
      expect(screen.getByText('#performance')).toBeInTheDocument();
    });
  });

  it('allows removing a tag via the remove button and triggers onUpdateTags', async () => {
    const handleUpdateTags = vi.fn().mockResolvedValue(undefined);
    render(
      <ReaderModal
        bookmark={mockBookmarkWithTags}
        onClose={vi.fn()}
        onTagClick={vi.fn()}
        onUpdateTags={handleUpdateTags}
      />
    );

    const removeArchBtn = screen.getByRole('button', { name: /Remove tag architecture/i });
    fireEvent.click(removeArchBtn);

    await waitFor(() => {
      expect(handleUpdateTags).toHaveBeenCalledWith(42, ['react']);
      expect(screen.queryByText('#architecture')).not.toBeInTheDocument();
      expect(screen.getByText('#react')).toBeInTheDocument();
    });
  });

  it('renders full multi-line personal_note for a big note instead of truncated description in Reader Mode', () => {
    const bigNoteBookmark: Bookmark = {
      id: 99,
      user_id: 1,
      url: 'slip://note/99',
      title: 'Comprehensive Engineering Strategy',
      description: 'First 200 chars preview of the note for cards...',
      personal_note: '# Executive Summary\n\nThis is paragraph 1 of the full note.\n\n## Section 1: Architecture\n- Scalable SQLite with WAL\n- Float32 cosine dot-products in RAM\n\n## Section 2: Implementation Details\nFull paragraph 2 with **important bold points** and more details.',
      content_type: 'note',
      is_pinned: false,
      created_at: '2026-08-30T10:00:00Z',
      updated_at: '2026-08-30T10:00:00Z',
      tags: []
    };

    render(
      <ReaderModal
        bookmark={bigNoteBookmark}
        onClose={vi.fn()}
      />
    );

    // Full note headers and contents must be rendered, not the 200-char preview description
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    expect(screen.getByText('This is paragraph 1 of the full note.')).toBeInTheDocument();
    expect(screen.getByText('Section 1: Architecture')).toBeInTheDocument();
    expect(screen.getByText(/Scalable SQLite with WAL/i)).toBeInTheDocument();
    expect(screen.getByText(/Float32 cosine dot-products in RAM/i)).toBeInTheDocument();
    expect(screen.getByText('Section 2: Implementation Details')).toBeInTheDocument();
    expect(screen.getByText(/important bold points/i)).toBeInTheDocument();
    expect(screen.queryByText('First 200 chars preview of the note for cards...')).not.toBeInTheDocument();
  });
});

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  renderInlineMarkdown,
  renderFormattedNote,
  applyListFormatting,
  applyInlineFormatting,
  handleListEnterKey
} from '../utils/markdown';
import { NoteEditor } from '../components/NoteEditor';
import { EditBookmarkModal } from '../components/EditBookmarkModal';
import { ShareModal } from '../components/ShareModal';
import { BookmarkCard } from '../components/BookmarkCard';
import { Bookmark } from '../types';

describe('Markdown Parsing & List Interactions Utility', () => {
  it('resolves strikethrough, bold, italic, and inline code in inline text/titles', () => {
    const { container } = render(
      <div>{renderInlineMarkdown('This has ~~strikethrough~~, **bold**, and *italic* and `code` text')}</div>
    );

    const delEl = container.querySelector('del');
    expect(delEl).toBeInTheDocument();
    expect(delEl?.textContent).toBe('strikethrough');

    const strongEl = container.querySelector('strong');
    expect(strongEl).toBeInTheDocument();
    expect(strongEl?.textContent).toBe('bold');

    const emEl = container.querySelector('em');
    expect(emEl).toBeInTheDocument();
    expect(emEl?.textContent).toBe('italic');

    const codeEl = container.querySelector('code');
    expect(codeEl).toBeInTheDocument();
    expect(codeEl?.textContent).toBe('code');
  });

  it('renders multi-line headers, bullet points, numbers, and blockquotes', () => {
    const markdown = `# Header 1\n- Item 1\n- Item 2\n1. Step 1\n2. Step 2\n> Quoted line`;
    const { container } = render(<div>{renderFormattedNote(markdown)}</div>);

    expect(screen.getByText('Header 1')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
    expect(screen.getByText('Quoted line')).toBeInTheDocument();
  });

  it('applies bullet list formatting across multi-line selections', () => {
    const text = 'Line 1\nLine 2\nLine 3';
    const result = applyListFormatting(text, 0, text.length, 'bullet');
    expect(result.newContent).toBe('- Line 1\n- Line 2\n- Line 3');

    // Toggle off when all are bullets
    const toggled = applyListFormatting(result.newContent, 0, result.newContent.length, 'bullet');
    expect(toggled.newContent).toBe('Line 1\nLine 2\nLine 3');
  });

  it('applies numbered list formatting across multi-line selections', () => {
    const text = 'Alpha\nBeta\nGamma';
    const result = applyListFormatting(text, 0, text.length, 'number');
    expect(result.newContent).toBe('1. Alpha\n2. Beta\n3. Gamma');
  });

  it('handles smart list auto-continuation and cancellation on Enter', () => {
    // 1. Continue bullet
    const bulletText = '- First item';
    const res1 = handleListEnterKey(bulletText, bulletText.length);
    expect(res1?.newContent).toBe('- First item\n- ');

    // 2. Cancel bullet on empty bullet
    const emptyBulletText = '- First item\n- ';
    const res2 = handleListEnterKey(emptyBulletText, emptyBulletText.length);
    expect(res2?.newContent).toBe('- First item\n\n');

    // 3. Continue numbered list with increment
    const numText = '1. First step';
    const res3 = handleListEnterKey(numText, numText.length);
    expect(res3?.newContent).toBe('1. First step\n2. ');

    // 4. Cancel numbered list on empty number
    const emptyNumText = '1. First step\n2. ';
    const res4 = handleListEnterKey(emptyNumText, emptyNumText.length);
    expect(res4?.newContent).toBe('1. First step\n\n');
  });
});

describe('NoteEditor Component UX & Interactions', () => {
  it('toggles cleanly between Write and Preview modes with clear visual feedback', () => {
    const handleTitle = vi.fn();
    const handleContent = vi.fn();

    render(
      <NoteEditor
        title="Todo List"
        onTitleChange={handleTitle}
        content="- **Buy milk**\n- ~~Old task~~"
        onContentChange={handleContent}
      />
    );

    const writeTab = screen.getByRole('button', { name: /Write/i });
    const previewTab = screen.getByRole('button', { name: /Preview/i });

    expect(writeTab).toHaveClass('active');
    expect(previewTab).not.toHaveClass('active');

    // Switch to preview mode
    fireEvent.click(previewTab);

    expect(previewTab).toHaveClass('active');
    expect(writeTab).not.toHaveClass('active');

    // Preview should render formatted markdown with del
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
    expect(screen.getByText('Old task')).toBeInTheDocument();
  });
});

describe('EditBookmarkModal Note vs Non-Note fields', () => {
  const noteBookmark: Bookmark = {
    id: 10,
    user_id: 1,
    url: 'slip://note/12345',
    title: 'My Memo ~~Draft~~',
    description: 'Auto snippet',
    personal_note: 'My Memo content',
    content_type: 'note',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: []
  };

  const pdfBookmark: Bookmark = {
    id: 12,
    user_id: 1,
    url: '/api/cache/annual_report.pdf',
    title: 'Q3 Financials',
    description: 'PDF 1.2 MB',
    content_type: 'document',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: []
  };

  const webBookmark: Bookmark = {
    id: 11,
    user_id: 1,
    url: 'https://example.com',
    title: 'Web Article',
    description: 'A great article',
    personal_note: 'Sticky note',
    content_type: 'website',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: []
  };

  it('does NOT show Description field when editing a Note card', () => {
    render(
      <EditBookmarkModal
        bookmark={noteBookmark}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByText('Edit Note')).toBeInTheDocument();
    expect(screen.getByText('Note Content')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Description$/i)).not.toBeInTheDocument();
  });

  it('shows Description and Personal Sticky Note fields when editing a standard bookmark', () => {
    render(
      <EditBookmarkModal
        bookmark={webBookmark}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByText('Edit Bookmark')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Personal Sticky Note')).toBeInTheDocument();
  });

  it('provides Copy text to clipboard and Download as .md file for Notes in ShareModal', () => {
    render(<ShareModal bookmark={noteBookmark} onClose={vi.fn()} />);

    expect(screen.getByText('Share Note')).toBeInTheDocument();
    expect(screen.getByText('Copy Text to Clipboard')).toBeInTheDocument();
    expect(screen.getByText('Download as .md file')).toBeInTheDocument();
  });

  it('provides Download PDF to Device for PDF Document bookmarks in ShareModal', () => {
    render(<ShareModal bookmark={pdfBookmark} onClose={vi.fn()} />);

    expect(screen.getByText('Share PDF Document')).toBeInTheDocument();
    expect(screen.getByText('Download PDF to Device')).toBeInTheDocument();
    expect(screen.getByText('Open PDF in New Tab')).toBeInTheDocument();
  });

  it('toggles personal note drawer cleanly on BookmarkCard without duplicate preview', () => {
    const onEditMock = vi.fn();
    const bookmarkWithNote: Bookmark = {
      id: 20,
      user_id: 1,
      url: 'https://example.com/item',
      title: 'Item Title',
      description: 'Item Desc',
      personal_note: 'Secret Note Content',
      content_type: 'website',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: []
    };

    render(
      <BookmarkCard
        bookmark={bookmarkWithNote}
        onOpenReader={vi.fn()}
        onShare={vi.fn()}
        onEdit={onEditMock}
        onRescrape={vi.fn()}
        onDelete={vi.fn()}
        onTagClick={vi.fn()}
      />
    );

    // When showNote is false by default, note content is NOT rendered
    expect(screen.queryByText('Secret Note Content')).not.toBeInTheDocument();

    // Click note toggle button
    const noteBtn = screen.getByTitle('View Personal Note');
    fireEvent.click(noteBtn);

    // Note drawer is now open
    expect(screen.getByText('Secret Note Content')).toBeInTheDocument();
    expect(screen.getByText('📝 Personal Note')).toBeInTheDocument();

    // Click close button (×)
    const closeBtn = screen.getByLabelText('Close note');
    fireEvent.click(closeBtn);

    // Note drawer is collapsed again
    expect(screen.queryByText('Secret Note Content')).not.toBeInTheDocument();
  });
});

import React, { useState, useRef } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Eye,
  Edit2
} from 'lucide-react';
import {
  renderFormattedNote,
  applyInlineFormatting,
  applyListFormatting,
  handleListEnterKey
} from '../utils/markdown';

interface NoteEditorProps {
  title: string;
  onTitleChange: (title: string) => void;
  content: string;
  onContentChange: (content: string) => void;
  titlePlaceholder?: string;
  contentPlaceholder?: string;
  minHeight?: string;
  autoFocus?: boolean;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  title,
  onTitleChange,
  content,
  onContentChange,
  titlePlaceholder = 'Note title (optional)',
  contentPlaceholder = 'Start typing your note... Use bullet points, **bold**, *italic*, ~~strikethrough~~, or markdown shortcuts.',
  minHeight = '160px',
  autoFocus = false
}) => {
  const [previewMode, setPreviewMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInlineClick = (prefix: string, suffix = prefix, placeholder = 'text') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const { newContent, newCursorStart, newCursorEnd } = applyInlineFormatting(
      content,
      start,
      end,
      prefix,
      suffix,
      placeholder
    );

    onContentChange(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorStart, newCursorEnd);
    }, 0);
  };

  const handleListClick = (type: 'bullet' | 'number' | 'quote') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const { newContent, newCursorStart, newCursorEnd } = applyListFormatting(
      content,
      start,
      end,
      type
    );

    onContentChange(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorStart, newCursorEnd);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // 1. Smart Enter list continuation
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      const cursorPos = textarea.selectionStart;
      const result = handleListEnterKey(content, cursorPos);
      if (result) {
        e.preventDefault();
        onContentChange(result.newContent);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(result.newCursorPos, result.newCursorPos);
        }, 0);
        return;
      }
    }

    // 2. Keyboard shortcuts
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        handleInlineClick('**', '**', 'bold text');
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        handleInlineClick('*', '*', 'italic text');
      } else if (e.shiftKey && (e.key === 'X' || e.key === 'x')) {
        e.preventDefault();
        handleInlineClick('~~', '~~', 'strikethrough text');
      }
    }
  };

  return (
    <div className="note-editor-wrapper">
      <div className="form-group">
        <label className="form-label">Note Title</label>
        <input
          type="text"
          className="form-input"
          style={{ width: '100%', fontWeight: 600 }}
          placeholder={titlePlaceholder}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          autoFocus={autoFocus}
        />
      </div>

      <div className="form-group" style={{ marginTop: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label className="form-label" style={{ margin: 0 }}>Note Content</label>

          {/* Distinct Segmented Mode Switcher */}
          <div className="note-mode-segmented-bar">
            <button
              type="button"
              className={`note-mode-tab ${!previewMode ? 'active' : ''}`}
              onClick={() => setPreviewMode(false)}
            >
              <Edit2 size={12} />
              <span>Write</span>
            </button>
            <button
              type="button"
              className={`note-mode-tab ${previewMode ? 'active' : ''}`}
              onClick={() => setPreviewMode(true)}
            >
              <Eye size={12} />
              <span>Preview</span>
            </button>
          </div>
        </div>

        {!previewMode ? (
          <div className="note-editor-write-container">
            {/* Writing Tools Bar */}
            <div className="note-writing-toolbar">
              <button
                type="button"
                className="toolbar-btn"
                title="Bold (Cmd+B / Ctrl+B)"
                onClick={() => handleInlineClick('**', '**', 'bold text')}
              >
                <Bold size={13} />
              </button>
              <button
                type="button"
                className="toolbar-btn"
                title="Italic (Cmd+I / Ctrl+I)"
                onClick={() => handleInlineClick('*', '*', 'italic text')}
              >
                <Italic size={13} />
              </button>
              <button
                type="button"
                className="toolbar-btn"
                title="Strikethrough (Cmd+Shift+X)"
                onClick={() => handleInlineClick('~~', '~~', 'strikethrough text')}
              >
                <Strikethrough size={13} />
              </button>
              <div className="toolbar-divider" />
              <button
                type="button"
                className="toolbar-btn"
                title="Bullet List (- item)"
                onClick={() => handleListClick('bullet')}
              >
                <List size={13} />
              </button>
              <button
                type="button"
                className="toolbar-btn"
                title="Numbered List (1. item)"
                onClick={() => handleListClick('number')}
              >
                <ListOrdered size={13} />
              </button>
              <button
                type="button"
                className="toolbar-btn"
                title="Quote (> quote)"
                onClick={() => handleListClick('quote')}
              >
                <Quote size={13} />
              </button>
              <button
                type="button"
                className="toolbar-btn"
                title="Inline Code (`code`)"
                onClick={() => handleInlineClick('`', '`', 'code')}
              >
                <Code size={13} />
              </button>
            </div>

            <textarea
              ref={textareaRef}
              className="form-input note-textarea"
              style={{
                width: '100%',
                minHeight,
                resize: 'vertical',
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
                fontFamily: 'inherit',
                lineHeight: 1.6
              }}
              placeholder={contentPlaceholder}
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        ) : (
          <div
            className="note-live-preview"
            style={{
              minHeight,
              maxHeight: '300px',
              overflowY: 'auto',
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              fontSize: '14px',
              lineHeight: 1.6
            }}
          >
            {content.trim() ? (
              renderFormattedNote(content)
            ) : (
              <span style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>Nothing written yet. Click Write to start taking notes.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

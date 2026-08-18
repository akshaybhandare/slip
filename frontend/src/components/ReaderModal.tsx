import React, { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, Highlighter, Trash2, Copy, Check } from 'lucide-react';
import { Bookmark, Highlight } from '../types';
import { fetchHighlights, createHighlight, deleteHighlight } from '../api';
import { renderFormattedNote, renderInlineMarkdown } from '../utils/markdown';

interface ReaderModalProps {
  bookmark: Bookmark | null;
  onClose: () => void;
}

export const ReaderModal: React.FC<ReaderModalProps> = ({ bookmark, onClose }) => {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [floatingToolbarPos, setFloatingToolbarPos] = useState<{ x: number; y: number } | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'article' | 'highlights'>('article');
  const articleRef = useRef<HTMLDivElement>(null);

  const isNote = bookmark ? (bookmark.content_type === 'note' || bookmark.url.startsWith('slip://note/')) : false;

  useEffect(() => {
    if (bookmark) {
      fetchHighlights(bookmark.id)
        .then(setHighlights)
        .catch(() => setHighlights([]));
      setSelectedText('');
      setFloatingToolbarPos(null);
    }
  }, [bookmark]);

  if (!bookmark) return null;

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setFloatingToolbarPos(null);
      setSelectedText('');
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 3) {
      setFloatingToolbarPos(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setSelectedText(text);
    setFloatingToolbarPos({
      x: Math.max(10, rect.left + rect.width / 2 - 80),
      y: Math.max(10, rect.top - 48)
    });
  };

  const handleSaveHighlight = async (color: 'yellow' | 'green' = 'yellow') => {
    if (!selectedText || !bookmark) return;

    try {
      const newHl = await createHighlight(bookmark.id, {
        text: selectedText,
        color
      });
      setHighlights((prev) => [...prev, newHl]);
      window.getSelection()?.removeAllRanges();
      setFloatingToolbarPos(null);
      setSelectedText('');
    } catch (err) {
      console.error('Failed to save highlight:', err);
    }
  };

  const handleDeleteHighlight = async (hlId: number) => {
    if (!bookmark) return;
    try {
      await deleteHighlight(bookmark.id, hlId);
      setHighlights((prev) => prev.filter((h) => h.id !== hlId));
    } catch (err) {
      console.error('Failed to delete highlight:', err);
    }
  };

  const handleCopyQuote = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content reader-modal" onClick={(e) => e.stopPropagation()}>
        {/* Floating Highlight Toolbar */}
        {floatingToolbarPos && (
          <div
            className="floating-highlight-toolbar"
            style={{
              position: 'fixed',
              top: `${floatingToolbarPos.y}px`,
              left: `${floatingToolbarPos.x}px`,
              zIndex: 2000
            }}
          >
            <button
              className="highlight-color-btn yellow"
              onClick={() => handleSaveHighlight('yellow')}
              title="Highlight Yellow"
            >
              🟡
            </button>
            <button
              className="highlight-color-btn green"
              onClick={() => handleSaveHighlight('green')}
              title="Highlight Green"
            >
              🟢
            </button>
            <span className="toolbar-divider"></span>
            <span className="toolbar-label">Save Insight</span>
          </div>
        )}

        <div className="modal-header">
          <div>
            <span className="reader-badge">
              {isNote ? '📝 Markdown Note' : 'Reader Mode'}
            </span>
            <h1 className="reader-title">
              {renderInlineMarkdown(bookmark.title)}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!isNote && (
              <a
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ height: '34px', padding: '0 12px', fontSize: '13px' }}
              >
                <ExternalLink size={14} />
                <span className="btn-text-hide-mobile">Original</span>
              </a>
            )}
            <button className="modal-close" onClick={onClose} title="Close Reader">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Reader Sub-Tabs */}
        <div className="reader-tab-bar">
          <button
            className={`reader-tab-btn ${activeTab === 'article' ? 'active' : ''}`}
            onClick={() => setActiveTab('article')}
          >
            {isNote ? 'Note Content' : 'Article Text'}
          </button>
          <button
            className={`reader-tab-btn ${activeTab === 'highlights' ? 'active' : ''}`}
            onClick={() => setActiveTab('highlights')}
          >
            <Highlighter size={13} />
            <span>Highlights ({highlights.length})</span>
          </button>
        </div>

        {activeTab === 'article' ? (
          <div
            ref={articleRef}
            className="reader-article"
            onMouseUp={handleTextSelection}
            onTouchEnd={handleTextSelection}
          >
            {isNote ? (
              <div style={{ fontSize: '16px', lineHeight: 1.7, color: 'var(--color-on-surface)' }}>
                {renderFormattedNote(bookmark.personal_note || bookmark.description || '')}
              </div>
            ) : bookmark.reader_html ? (
              <div dangerouslySetInnerHTML={{ __html: bookmark.reader_html }} />
            ) : (
              <div style={{ padding: '2rem 0', color: 'var(--color-muted)' }}>
                <p>{bookmark.description || 'No reader view content available for this bookmark.'}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="reader-highlights-list">
            {highlights.length === 0 ? (
              <div className="empty-highlights">
                <Highlighter size={32} style={{ color: 'var(--color-primary)', margin: '0 auto 12px' }} />
                <p style={{ fontWeight: 600, color: 'var(--color-secondary)' }}>No highlights yet</p>
                <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginTop: '4px' }}>
                  Select any text in the article view to save key insights and quotes.
                </p>
              </div>
            ) : (
              highlights.map((h) => (
                <div key={h.id} className={`highlight-card ${h.color || 'yellow'}`}>
                  <blockquote className="highlight-quote">“{h.text}”</blockquote>
                  <div className="highlight-footer">
                    <span className="highlight-date">{new Date(h.created_at).toLocaleDateString()}</span>
                    <div className="highlight-actions">
                      <button
                        className="icon-btn-small"
                        onClick={() => handleCopyQuote(h.text, h.id)}
                        title="Copy Quote"
                      >
                        {copiedId === h.id ? <Check size={13} style={{ color: '#16a34a' }} /> : <Copy size={13} />}
                      </button>
                      <button
                        className="icon-btn-small"
                        onClick={() => handleDeleteHighlight(h.id)}
                        title="Delete Highlight"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

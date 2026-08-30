import React, { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, Highlighter, Trash2, Copy, Check, Tag as TagIcon, Plus, Sparkles } from 'lucide-react';
import { Bookmark, Highlight, Tag } from '../types';
import { fetchHighlights, createHighlight, deleteHighlight, fetchRelatedBookmarks, fetchBookmarkById } from '../api';
import { renderFormattedNote, renderInlineMarkdown } from '../utils/markdown';
import { copyToClipboard } from '../utils/clipboard';
import { isNoteSlip, isDocumentSlip, extractPdfOriginalFilename } from '../utils/bookmarkUtils';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface ReaderModalProps {
  bookmark: Bookmark | null;
  onClose: () => void;
  onTagClick?: (tagName: string) => void;
  onUpdateTags?: (bookmarkId: number, tags: string[]) => Promise<void>;
  availableTags?: Tag[];
}

export const ReaderModal: React.FC<ReaderModalProps> = ({
  bookmark,
  onClose,
  onTagClick,
  onUpdateTags,
  availableTags = []
}) => {
  const [currentBookmark, setCurrentBookmark] = useState<Bookmark | null>(bookmark);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [relatedSlips, setRelatedSlips] = useState<Bookmark[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [floatingToolbarPos, setFloatingToolbarPos] = useState<{ x: number; y: number } | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'article' | 'highlights'>('article');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isSubmittingTag, setIsSubmittingTag] = useState(false);
  const articleRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const isNote = isNoteSlip(currentBookmark);
  const isDoc = isDocumentSlip(currentBookmark);
  const pdfFilename = isDoc ? extractPdfOriginalFilename(currentBookmark) : null;

  useEscapeKey(onClose, Boolean(currentBookmark));

  useEffect(() => {
    if (bookmark) {
      setCurrentBookmark(bookmark);
      Promise.resolve(fetchHighlights(bookmark.id))
        .then(setHighlights)
        .catch(() => setHighlights([]));
      Promise.resolve(fetchRelatedBookmarks(bookmark.id, 3))
        .then((res) => setRelatedSlips(Array.isArray(res) ? res.slice(0, 3) : []))
        .catch(() => setRelatedSlips([]));
      Promise.resolve(fetchBookmarkById(bookmark.id))
        .then((fullBookmark) => {
          if (fullBookmark) {
            setCurrentBookmark((prev) => (prev && prev.id === fullBookmark.id ? { ...prev, ...fullBookmark } : prev));
          }
        })
        .catch(() => {});
      setSelectedText('');
      setFloatingToolbarPos(null);
      setIsAddingTag(false);
      setNewTagInput('');
    } else {
      setCurrentBookmark(null);
      setRelatedSlips([]);
    }
  }, [bookmark]);

  const handleSelectRelatedSlip = (rel: Bookmark) => {
    setCurrentBookmark(rel);
    Promise.resolve(fetchHighlights(rel.id))
      .then(setHighlights)
      .catch(() => setHighlights([]));
    Promise.resolve(fetchRelatedBookmarks(rel.id, 3))
      .then((res) => setRelatedSlips(Array.isArray(res) ? res.slice(0, 3) : []))
      .catch(() => setRelatedSlips([]));
    Promise.resolve(fetchBookmarkById(rel.id))
      .then((fullBookmark) => {
        if (fullBookmark) {
          setCurrentBookmark((prev) => (prev && prev.id === fullBookmark.id ? { ...prev, ...fullBookmark } : prev));
        }
      })
      .catch(() => {});
    if (articleRef.current) {
      articleRef.current.scrollTop = 0;
    }
  };

  if (!currentBookmark) return null;

  const handleAddTagSubmit = async () => {
    const clean = newTagInput.trim().replace(/^#/, '').toLowerCase();
    if (!clean || !currentBookmark) return;

    const currentTagNames = (currentBookmark.tags || []).map((t) => t.name.toLowerCase());
    if (currentTagNames.includes(clean)) {
      setIsAddingTag(false);
      setNewTagInput('');
      return;
    }

    const updatedTagNames = [...currentTagNames, clean];
    setIsSubmittingTag(true);

    const optimisticTags = [...(currentBookmark.tags || []), { id: Date.now(), name: clean, count: 1 }];
    setCurrentBookmark((prev) => (prev ? { ...prev, tags: optimisticTags } : null));
    setIsAddingTag(false);
    setNewTagInput('');

    try {
      if (onUpdateTags) {
        await onUpdateTags(currentBookmark.id, updatedTagNames);
      }
    } catch (err) {
      console.error('Failed to add tag in reader mode:', err);
      setCurrentBookmark(bookmark);
    } finally {
      setIsSubmittingTag(false);
    }
  };

  const handleAddSuggestedTag = async (tagName: string) => {
    const clean = tagName.trim().replace(/^#/, '').toLowerCase();
    if (!clean || !currentBookmark) return;

    const currentTagNames = (currentBookmark.tags || []).map((t) => t.name.toLowerCase());
    if (currentTagNames.includes(clean)) return;

    const updatedTagNames = [...currentTagNames, clean];
    setIsSubmittingTag(true);

    const optimisticTags = [...(currentBookmark.tags || []), { id: Date.now(), name: clean, count: 1 }];
    setCurrentBookmark((prev) => (prev ? { ...prev, tags: optimisticTags } : null));
    setIsAddingTag(false);
    setNewTagInput('');

    try {
      if (onUpdateTags) {
        await onUpdateTags(currentBookmark.id, updatedTagNames);
      }
    } catch (err) {
      console.error('Failed to add suggested tag:', err);
      setCurrentBookmark(bookmark);
    } finally {
      setIsSubmittingTag(false);
    }
  };

  const handleRemoveTag = async (tagNameToRemove: string) => {
    if (!currentBookmark) return;
    const clean = tagNameToRemove.toLowerCase();
    const updatedTags = (currentBookmark.tags || []).filter((t) => t.name.toLowerCase() !== clean);
    const updatedTagNames = updatedTags.map((t) => t.name);

    setCurrentBookmark((prev) => (prev ? { ...prev, tags: updatedTags } : null));

    try {
      if (onUpdateTags) {
        await onUpdateTags(currentBookmark.id, updatedTagNames);
      }
    } catch (err) {
      console.error('Failed to remove tag in reader mode:', err);
      setCurrentBookmark(bookmark);
    }
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTagSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsAddingTag(false);
      setNewTagInput('');
    }
  };

  const currentTagNames = new Set((currentBookmark.tags || []).map((t) => t.name.toLowerCase()));
  const filteredSuggestions = availableTags
    .filter((t) => !currentTagNames.has(t.name.toLowerCase()))
    .filter((t) => !newTagInput.trim() || t.name.toLowerCase().includes(newTagInput.trim().toLowerCase()))
    .slice(0, 8);

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
    if (!selectedText || !currentBookmark) return;

    try {
      const newHl = await createHighlight(currentBookmark.id, {
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
    if (!currentBookmark) return;
    try {
      await deleteHighlight(currentBookmark.id, hlId);
      setHighlights((prev) => prev.filter((h) => h.id !== hlId));
    } catch (err) {
      console.error('Failed to delete highlight:', err);
    }
  };

  const handleCopyQuote = async (text: string, id: number) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }
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
              {isNote ? '📝 Markdown Note' : isDoc ? '📄 PDF Summary' : 'Reader Mode'}
            </span>
            <h1 className="reader-title">
              {renderInlineMarkdown(currentBookmark.title)}
            </h1>
            {isDoc && pdfFilename && (
              <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>File: {pdfFilename}</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!isNote && (
              <a
                href={currentBookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ height: '34px', padding: '0 12px', fontSize: '13px' }}
              >
                <ExternalLink size={14} />
                <span className="btn-text-hide-mobile">{isDoc ? 'Open PDF' : 'Original'}</span>
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
            {isNote ? 'Note Content' : isDoc ? 'Summary & Insights' : 'Article Text'}
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
          <>
            <div
              ref={articleRef}
              className="reader-article"
              onMouseUp={handleTextSelection}
              onTouchEnd={handleTextSelection}
            >
              {isNote ? (
                <div style={{ fontSize: '16px', lineHeight: 1.7, color: 'var(--color-on-surface)' }}>
                  {renderFormattedNote(currentBookmark.personal_note || currentBookmark.raw_text || currentBookmark.description || '')}
                </div>
              ) : isDoc ? (
                <div style={{ fontSize: '16px', lineHeight: 1.7, color: 'var(--color-on-surface)' }}>
                  {renderFormattedNote(currentBookmark.description || currentBookmark.personal_note || currentBookmark.raw_text || '')}
                </div>
              ) : currentBookmark.reader_html ? (
                <div dangerouslySetInnerHTML={{ __html: currentBookmark.reader_html }} />
              ) : (
                <div style={{ padding: '2rem 0', color: 'var(--color-muted)' }}>
                  <p>{currentBookmark.description || 'No reader view content available for this bookmark.'}</p>
                </div>
              )}
            </div>

            {/* Reader Mode Tags Section */}
            <div className="reader-tags-section" data-testid="reader-tags-section">
              <div className="reader-tags-header">
                <div className="reader-tags-label">
                  <TagIcon size={13} className="reader-tags-icon" />
                  <span>Tags ({currentBookmark.tags?.length || 0})</span>
                </div>
                {!isAddingTag && onUpdateTags && (
                  <button
                    type="button"
                    className="reader-add-tag-btn"
                    onClick={() => {
                      setIsAddingTag(true);
                      setTimeout(() => tagInputRef.current?.focus(), 50);
                    }}
                    title="Add a tag to this slip"
                    data-testid="reader-add-tag-btn"
                  >
                    <Plus size={12} />
                    <span>Add Tag</span>
                  </button>
                )}
              </div>

              <div className="reader-tags-list">
                {currentBookmark.tags && currentBookmark.tags.map((t) => (
                  <span
                    key={t.id || t.name}
                    className="reader-tag-pill"
                    data-testid={`reader-tag-pill-${t.name}`}
                  >
                    <button
                      type="button"
                      className="reader-tag-pill-btn"
                      onClick={() => {
                        if (onTagClick) {
                          onTagClick(t.name);
                        }
                      }}
                      title={`Filter by #${t.name}`}
                    >
                      #{t.name}
                    </button>
                    {onUpdateTags && (
                      <button
                        type="button"
                        className="reader-tag-pill-remove"
                        onClick={() => handleRemoveTag(t.name)}
                        aria-label={`Remove tag ${t.name}`}
                        title={`Remove #${t.name}`}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </span>
                ))}

                {isAddingTag && (
                  <div className="reader-tag-input-wrap">
                    <span className="reader-tag-prefix">#</span>
                    <input
                      type="text"
                      ref={tagInputRef}
                      className="reader-tag-input"
                      placeholder="tag-name..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={handleTagInputKeyDown}
                      autoFocus
                      data-testid="reader-tag-input"
                    />
                    <button
                      type="button"
                      className="reader-tag-save-btn"
                      onClick={handleAddTagSubmit}
                      disabled={!newTagInput.trim() || isSubmittingTag}
                      title="Save tag"
                      data-testid="reader-tag-save-btn"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      className="reader-tag-cancel-btn"
                      onClick={() => {
                        setIsAddingTag(false);
                        setNewTagInput('');
                      }}
                      title="Cancel"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {(!currentBookmark.tags || currentBookmark.tags.length === 0) && !isAddingTag && (
                  <span className="reader-no-tags-hint">No tags attached. Click "+ Add Tag" to categorize.</span>
                )}
              </div>

              {/* Tag Suggestions when adding a tag */}
              {isAddingTag && filteredSuggestions.length > 0 && (
                <div className="reader-tag-suggestions">
                  <span className="reader-suggestions-label">Suggestions:</span>
                  <div className="reader-suggestions-pills">
                    {filteredSuggestions.map((st) => (
                      <button
                        key={st.id || st.name}
                        type="button"
                        className="reader-suggestion-pill"
                        onClick={() => handleAddSuggestedTag(st.name)}
                      >
                        <Plus size={10} />
                        <span>#{st.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Issue #40: Related Slips Section */}
              {relatedSlips.length > 0 && (
                <div className="reader-related-section" data-testid="reader-related-section">
                  <div className="reader-related-header">
                    <Sparkles size={14} style={{ color: 'var(--color-primary)' }} />
                    <span className="reader-related-title">Related Slips</span>
                  </div>
                  <div className="reader-related-grid">
                    {relatedSlips.map((rel) => (
                      <div
                        key={rel.id}
                        className="reader-related-card"
                        onClick={() => handleSelectRelatedSlip(rel)}
                        role="button"
                        tabIndex={0}
                        data-testid={`reader-related-card-${rel.id}`}
                      >
                        <div className="reader-related-card-header">
                          <span className="reader-related-card-title">{rel.title}</span>
                          {rel.similarityScore !== undefined && (
                            <span className="reader-related-score" title="Semantic Similarity">
                              {rel.similarityScore}%
                            </span>
                          )}
                        </div>
                        {rel.description && (
                          <p className="reader-related-card-desc">{rel.description.slice(0, 90)}...</p>
                        )}
                        {rel.tags && rel.tags.length > 0 && (
                          <div className="reader-related-card-tags">
                            {rel.tags.slice(0, 3).map((t) => (
                              <span key={t.id || t.name} className="reader-related-tag">
                                #{t.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
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

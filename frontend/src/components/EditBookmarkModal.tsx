import React, { useState, useEffect } from 'react';
import { X, Edit3, FileText } from 'lucide-react';
import { Bookmark, ContentType, Tag } from '../types';
import { TagInput } from './TagInput';
import { NoteEditor } from './NoteEditor';

interface EditBookmarkModalProps {
  bookmark: Bookmark | null;
  onClose: () => void;
  onUpdate: (id: number, data: { title: string; description: string; personalNote?: string; contentType: string; tags: string[] }) => Promise<void>;
  availableTags?: Tag[];
  isAIConnected?: boolean;
  onOpenAISettings?: () => void;
}

export const EditBookmarkModal: React.FC<EditBookmarkModalProps> = ({
  bookmark,
  onClose,
  onUpdate,
  availableTags = [],
  isAIConnected = true,
  onOpenAISettings
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [personalNote, setPersonalNote] = useState('');
  const [contentType, setContentType] = useState<ContentType>('website');
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (bookmark) {
      setTitle(bookmark.title || '');
      setDescription(bookmark.description || '');
      setPersonalNote(bookmark.personal_note || '');
      setContentType(bookmark.content_type || 'website');
      setTags((bookmark.tags || []).map((t) => t.name));
      setError('');
    }
  }, [bookmark]);

  if (!bookmark) return null;

  const isNote = contentType === 'note';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !isNote) return;
    if (isNote && !title.trim() && !personalNote.trim()) return;

    setError('');
    setLoading(true);

    try {
      await onUpdate(bookmark.id, {
        title: title.trim(),
        description: isNote ? personalNote.trim().slice(0, 300) : description.trim(),
        personalNote: personalNote.trim(),
        contentType,
        tags
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update bookmark');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: isNote ? '560px' : '480px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit3 size={18} style={{ color: 'var(--color-primary)' }} />
            <h2 className="modal-title">{isNote ? 'Edit Note' : 'Edit Bookmark'}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{ color: 'var(--color-error)', fontSize: '13px', marginBottom: '16px', background: 'rgba(228, 43, 12, 0.08)', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isNote ? (
            /* Note Editor for Note Cards (No Description field!) */
            <NoteEditor
              title={title}
              onTitleChange={setTitle}
              content={personalNote}
              onContentChange={setPersonalNote}
              titlePlaceholder="Note title"
              contentPlaceholder="Write note content with bullet points, **bold**, *italic*, ~~strikethrough~~..."
              minHeight="160px"
              autoFocus
              isAIConnected={isAIConnected}
              onOpenAISettings={onOpenAISettings}
            />
          ) : (
            /* Standard Fields for Web / Image / Doc / Product / Video Bookmarks */
            <>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} style={{ color: 'var(--color-primary)' }} />
                  <span>Personal Sticky Note</span>
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Add your private reflections, highlights, or reminders..."
                  value={personalNote}
                  onChange={(e) => setPersonalNote(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </>
          )}

          <div className="form-group" style={{ marginTop: '14px' }}>
            <label className="form-label">Category</label>
            <select
              className="form-input"
              value={contentType}
              onChange={(e) => setContentType(e.target.value as ContentType)}
            >
              <option value="website">Website</option>
              <option value="article">Article</option>
              <option value="note">Note / Memo</option>
              <option value="document">Document (PDF)</option>
              <option value="video">Video</option>
              <option value="product">Product</option>
              <option value="image">Image</option>
            </select>
          </div>

          <div className="form-group" style={{ marginTop: '14px' }}>
            <label className="form-label">Tags</label>
            <TagInput
              tags={tags}
              onChange={setTags}
              availableTags={availableTags}
              placeholder="Add tag and press Enter..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || (!title.trim() && !personalNote.trim())}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

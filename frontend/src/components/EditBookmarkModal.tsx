import React, { useState, useEffect } from 'react';
import { X, Edit3 } from 'lucide-react';
import { Bookmark, ContentType, Tag } from '../types';
import { TagInput } from './TagInput';

interface EditBookmarkModalProps {
  bookmark: Bookmark | null;
  onClose: () => void;
  onUpdate: (id: number, data: { title: string; description: string; contentType: string; tags: string[] }) => Promise<void>;
  availableTags?: Tag[];
}

export const EditBookmarkModal: React.FC<EditBookmarkModalProps> = ({
  bookmark,
  onClose,
  onUpdate,
  availableTags = []
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentType, setContentType] = useState<ContentType>('website');
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (bookmark) {
      setTitle(bookmark.title || '');
      setDescription(bookmark.description || '');
      setContentType(bookmark.content_type || 'website');
      setTags((bookmark.tags || []).map((t) => t.name));
      setError('');
    }
  }, [bookmark]);

  if (!bookmark) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setError('');
    setLoading(true);

    try {
      await onUpdate(bookmark.id, {
        title: title.trim(),
        description: description.trim(),
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
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit3 size={18} style={{ color: 'var(--color-primary)' }} />
            <h2 className="modal-title">Edit Bookmark</h2>
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
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-input"
              value={contentType}
              onChange={(e) => setContentType(e.target.value as ContentType)}
            >
              <option value="website">Website</option>
              <option value="article">Article</option>
              <option value="video">Video</option>
              <option value="product">Product</option>
              <option value="image">Image</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Tags & Collection</label>
            <TagInput tags={tags} onChange={setTags} availableTags={availableTags} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { X, Link2 } from 'lucide-react';
import { Tag } from '../types';
import { TagInput } from './TagInput';

interface AddBookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { url: string; tags: string[] }) => Promise<void>;
  availableTags?: Tag[];
}

export const AddBookmarkModal: React.FC<AddBookmarkModalProps> = ({
  isOpen,
  onClose,
  onSave,
  availableTags = []
}) => {
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setError('');
    setLoading(true);

    try {
      await onSave({ url: url.trim(), tags });
      setUrl('');
      setTags([]);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save bookmark');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Save to Slip</h2>
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
            <label className="form-label">URL</label>
            <div style={{ position: 'relative' }}>
              <Link2 size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
              <input
                type="url"
                required
                className="form-input"
                style={{ width: '100%', paddingLeft: '40px' }}
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoFocus
              />
            </div>
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
              {loading ? 'Archiving...' : 'Save Bookmark'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

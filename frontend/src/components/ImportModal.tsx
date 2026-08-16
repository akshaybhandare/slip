import React, { useState } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import { importBookmarksHtml } from '../api';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImportSuccess }) => {
  const [htmlContent, setHtmlContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setHtmlContent(content || '');
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!htmlContent.trim()) return;

    setLoading(true);
    setError('');

    try {
      await importBookmarksHtml(htmlContent);
      setHtmlContent('');
      setFileName('');
      onImportSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to import bookmarks');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Upload size={18} style={{ color: 'var(--color-primary)' }} />
            <h2 className="modal-title">Import Bookmarks</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '14px', color: 'var(--color-muted)', marginBottom: '20px' }}>
          Upload a standard HTML bookmark file exported from Chrome, Safari, Firefox, Edge, or Raindrop.
        </p>

        {error && (
          <div style={{ color: 'var(--color-error)', fontSize: '13px', marginBottom: '16px', background: 'rgba(228, 43, 12, 0.08)', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Select HTML File</label>
            <div style={{
              border: '2px dashed var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '28px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'var(--color-background)'
            }}>
              <input
                type="file"
                accept=".html,.htm"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                id="file-upload"
              />
              <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <FileText size={28} style={{ color: 'var(--color-muted)' }} />
                <span style={{ fontWeight: 500, fontSize: '14px', color: 'var(--color-secondary)' }}>
                  {fileName ? fileName : 'Click or drag Netscape HTML file here'}
                </span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Or Paste Netscape HTML</label>
            <textarea
              className="form-input"
              rows={4}
              placeholder="<!DOCTYPE NETSCAPE-Bookmark-file-1>..."
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || !htmlContent.trim()}>
              {loading ? 'Importing...' : 'Start Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

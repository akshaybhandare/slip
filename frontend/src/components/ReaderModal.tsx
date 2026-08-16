import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Bookmark } from '../types';

interface ReaderModalProps {
  bookmark: Bookmark | null;
  onClose: () => void;
}

export const ReaderModal: React.FC<ReaderModalProps> = ({ bookmark, onClose }) => {
  if (!bookmark) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content reader-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Reader View
            </span>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '0.25rem', lineHeight: 1.25 }}>
              {bookmark.title}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.8rem' }}
            >
              <ExternalLink size={14} />
              <span>Original</span>
            </a>
            <button className="modal-close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {bookmark.reader_html ? (
          <div
            className="reader-article"
            dangerouslySetInnerHTML={{ __html: bookmark.reader_html }}
          />
        ) : (
          <div style={{ padding: '2rem 0', color: 'var(--text-secondary)' }}>
            <p>{bookmark.description || 'No reader view content available for this bookmark.'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

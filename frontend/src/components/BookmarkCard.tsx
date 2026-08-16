import React, { useState } from 'react';
import { ExternalLink, Eye, Share2, Trash2, Globe, Edit3, RefreshCw, FileText } from 'lucide-react';
import { Bookmark } from '../types';

interface BookmarkCardProps {
  bookmark: Bookmark;
  onOpenReader: (bookmark: Bookmark) => void;
  onShare: (bookmark: Bookmark) => void;
  onEdit: (bookmark: Bookmark) => void;
  onRescrape: (id: number) => Promise<void>;
  onDelete: (id: number) => void;
  onTagClick: (tagName: string) => void;
}

export const BookmarkCard: React.FC<BookmarkCardProps> = ({
  bookmark,
  onOpenReader,
  onShare,
  onEdit,
  onRescrape,
  onDelete,
  onTagClick
}) => {
  const [rescaping, setRescraping] = useState(false);
  const [showNote, setShowNote] = useState(false);

  let hostname = '';
  try {
    hostname = new URL(bookmark.url).hostname.replace(/^www\./, '');
  } catch {
    hostname = bookmark.url;
  }

  const isArticle = bookmark.content_type === 'article' || (bookmark.reader_html && bookmark.reader_html.length > 0);

  const handleRescrapeClick = async () => {
    setRescraping(true);
    try {
      await onRescrape(bookmark.id);
    } finally {
      setRescraping(false);
    }
  };

  return (
    <article className="bookmark-card">
      {bookmark.image_path ? (
        <div
          className="card-media"
          onClick={() => (isArticle ? onOpenReader(bookmark) : window.open(bookmark.url, '_blank'))}
        >
          <img
            src={bookmark.image_path}
            alt={bookmark.title}
            className="card-image"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      ) : (
        <div
          style={{
            background: 'linear-gradient(135deg, var(--color-tertiary) 0%, #ebebeb 100%)',
            padding: '24px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {bookmark.favicon_path ? (
              <img src={bookmark.favicon_path} alt="" className="favicon-icon" style={{ width: '18px', height: '18px' }} />
            ) : (
              <Globe size={18} style={{ color: 'var(--color-muted)' }} />
            )}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-secondary)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {hostname}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {bookmark.content_type}
            </span>
          </div>
        </div>
      )}

      <div className="card-content">
        {bookmark.image_path && (
          <div className="card-header-info">
            {bookmark.favicon_path ? (
              <img src={bookmark.favicon_path} alt="" className="favicon-icon" />
            ) : (
              <Globe size={13} />
            )}
            <span className="card-domain">{hostname}</span>
            <span className="card-type-badge">{bookmark.content_type}</span>
          </div>
        )}

        <a
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          className="card-title"
        >
          {bookmark.title}
        </a>

        {bookmark.description && (
          <p className="card-description">{bookmark.description}</p>
        )}

        {/* Personal Sticky Note Preview */}
        {bookmark.personal_note && !showNote && (
          <div
            className="card-note-preview-badge"
            onClick={() => setShowNote(true)}
            title="View personal note"
          >
            <FileText size={12} className="note-badge-icon" />
            <span className="note-badge-text">{bookmark.personal_note}</span>
          </div>
        )}

        {/* Expanded Note Drawer */}
        {showNote && (
          <div className="card-note-drawer">
            <div className="card-note-header">
              <span className="card-note-label">📝 Personal Note</span>
              <button
                type="button"
                className="card-note-close"
                onClick={() => setShowNote(false)}
                title="Close note"
              >
                ×
              </button>
            </div>
            <p className="card-note-text">
              {bookmark.personal_note || <em>No note written yet. Click Edit to add thoughts.</em>}
            </p>
          </div>
        )}

        {bookmark.tags && bookmark.tags.length > 0 && (
          <div className="card-tags">
            {bookmark.tags.slice(0, 3).map((t) => (
              <span
                key={t.id || t.name}
                className="tag-pill"
                onClick={() => onTagClick(t.name)}
              >
                #{t.name}
              </span>
            ))}
            {bookmark.tags.length > 3 && (
              <span
                className="tag-pill-more"
                title={bookmark.tags.slice(3).map((t) => `#${t.name}`).join(', ')}
              >
                +{bookmark.tags.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="card-actions">
          {isArticle && (
            <button
              className="icon-btn"
              title="Reader Mode"
              onClick={() => onOpenReader(bookmark)}
            >
              <Eye size={15} />
            </button>
          )}

          <button
            className={`icon-btn ${bookmark.personal_note ? 'has-note-btn' : ''}`}
            title={bookmark.personal_note ? 'View / Toggle Personal Note' : 'Add Personal Note'}
            onClick={() => setShowNote(!showNote)}
          >
            <FileText size={14} />
          </button>

          <button
            className="icon-btn"
            title="Re-scrape Metadata"
            onClick={handleRescrapeClick}
            disabled={rescaping}
          >
            <RefreshCw size={14} className={rescaping ? 'spin-animation' : ''} />
          </button>

          <button
            className="icon-btn"
            title="Edit Bookmark"
            onClick={() => onEdit(bookmark)}
          >
            <Edit3 size={14} />
          </button>

          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="icon-btn"
            title="Open in new tab"
          >
            <ExternalLink size={15} />
          </a>

          <button
            className="icon-btn"
            title="Share Bookmark"
            onClick={() => onShare(bookmark)}
          >
            <Share2 size={15} />
          </button>

          <button
            className="icon-btn"
            title="Delete Bookmark"
            onClick={() => onDelete(bookmark.id)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </article>
  );
};

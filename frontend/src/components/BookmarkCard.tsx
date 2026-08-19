import React, { useState, useRef, useEffect } from 'react';
import {
  ExternalLink,
  Eye,
  Share2,
  Trash2,
  Globe,
  Edit3,
  RefreshCw,
  FileText,
  Image as ImageIcon,
  FileCode2,
  MoreHorizontal,
  Sparkles,
  Paperclip,
  Pin,
  PinOff
} from 'lucide-react';
import { Bookmark } from '../types';
import { renderFormattedNote, renderInlineMarkdown } from '../utils/markdown';

export const SlipPinIcon: React.FC<{ isPinned: boolean; isPinning?: boolean; size?: number }> = ({ isPinned, size = 15 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={`slip-pin-svg ${isPinned ? 'is-pinned-svg' : 'is-unpinned-svg'}`}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id={`pinHeadGrad-${isPinned ? 'pinned' : 'unpinned'}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={isPinned ? '#ff6042' : '#94a3b8'} />
        <stop offset="55%" stopColor={isPinned ? '#e42b0c' : '#64748b'} />
        <stop offset="100%" stopColor={isPinned ? '#a81a00' : '#475569'} />
      </linearGradient>
      <linearGradient id={`pinNeedleGrad-${isPinned ? 'pinned' : 'unpinned'}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={isPinned ? '#e2e8f0' : '#cbd5e1'} />
        <stop offset="100%" stopColor={isPinned ? '#94a3b8' : '#64748b'} />
      </linearGradient>
    </defs>
    {/* Fine Needle */}
    <path
      d="M9.8 14.2 L4 20"
      stroke={`url(#pinNeedleGrad-${isPinned ? 'pinned' : 'unpinned'})`}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    {/* Pin Top Cap / Bevel */}
    <path
      d="M19.2 8.8 L15.2 4.8 C14.6 4.2 13.6 4.2 13 4.8 L11.8 6 L18 12.2 L19.2 11 C19.8 10.4 19.8 9.4 19.2 8.8 Z"
      fill={`url(#pinHeadGrad-${isPinned ? 'pinned' : 'unpinned'})`}
    />
    {/* Pin Body Grip Waist */}
    <path
      d="M11.8 6 L8.6 9.2 C8.2 9.6 8.1 10.2 8.2 10.7 L8.9 13.1 L6.2 15.8 L8.2 17.8 L10.9 15.1 L13.3 15.8 C13.8 15.9 14.4 15.8 14.8 15.4 L18 12.2 Z"
      fill={`url(#pinHeadGrad-${isPinned ? 'pinned' : 'unpinned'})`}
      opacity={isPinned ? 0.96 : 0.88}
    />
    {/* Specular Axis Highlight */}
    <circle
      cx="13.5"
      cy="10.5"
      r="1.2"
      fill="#ffffff"
      opacity={isPinned ? 0.9 : 0.6}
    />
  </svg>
);

export const SlipPushpin = SlipPinIcon;

interface BookmarkCardProps {
  bookmark: Bookmark;
  onOpenReader: (bookmark: Bookmark) => void;
  onShare: (bookmark: Bookmark) => void;
  onEdit: (bookmark: Bookmark) => void;
  onRescrape: (id: number) => Promise<void>;
  onAutoTag?: (id: number) => Promise<void>;
  onTogglePin?: (id: number) => Promise<void>;
  isAIConnected?: boolean;
  onDelete: (id: number) => void;
  onTagClick: (tagName: string) => void;
  onManageClips?: (bookmark: Bookmark) => void;
  onRemoveFromClip?: (bookmarkId: number) => void;
}

export const BookmarkCard: React.FC<BookmarkCardProps> = ({
  bookmark,
  onOpenReader,
  onShare,
  onEdit,
  onRescrape,
  onAutoTag,
  onTogglePin,
  isAIConnected = true,
  onDelete,
  onTagClick,
  onManageClips,
  onRemoveFromClip
}) => {
  const [rescaping, setRescraping] = useState(false);
  const [autoTagging, setAutoTagging] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMatchReasonExpanded, setIsMatchReasonExpanded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close card menu when clicking/tapping outside
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMenuOpen]);

  const isPinned = Boolean(bookmark.is_pinned);

  const handlePinClick = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (!onTogglePin || isPinning) return;
    setIsPinning(true);
    try {
      await onTogglePin(bookmark.id);
    } finally {
      setIsPinning(false);
    }
  };

  const isNote = bookmark.content_type === 'note' || bookmark.url.startsWith('slip://note/');
  const isDocument = bookmark.content_type === 'document' || bookmark.url.endsWith('.pdf') || (bookmark.image_path && bookmark.image_path.endsWith('.pdf'));
  const isLocalImage = bookmark.content_type === 'image' && (bookmark.url.startsWith('/api/cache') || bookmark.url.startsWith('local://'));

  let hostname = '';
  if (isNote) {
    hostname = 'Markdown Note';
  } else if (isDocument) {
    hostname = 'PDF Document';
  } else if (isLocalImage) {
    hostname = 'Local Image';
  } else {
    try {
      hostname = new URL(bookmark.url).hostname.replace(/^www\./, '');
    } catch {
      hostname = bookmark.url;
    }
  }

  const isArticle = !isNote && (bookmark.content_type === 'article' || (bookmark.reader_html && bookmark.reader_html.length > 0));

  const handleRescrapeClick = async () => {
    setRescraping(true);
    try {
      await onRescrape(bookmark.id);
    } finally {
      setRescraping(false);
    }
  };

  const handleAutoTagClick = async () => {
    if (!onAutoTag) return;
    setAutoTagging(true);
    try {
      await onAutoTag(bookmark.id);
    } finally {
      setAutoTagging(false);
    }
  };

  const handleShareClick = () => {
    onShare(bookmark);
  };

  const handleCardMediaClick = () => {
    if (isNote) {
      onOpenReader(bookmark);
    } else if (isArticle) {
      onOpenReader(bookmark);
    } else {
      window.open(bookmark.url, '_blank');
    }
  };

  return (
    <article className={`bookmark-card ${isPinned ? 'is-pinned-card' : ''} ${isNote ? 'note-bookmark-card' : ''} ${isDocument ? 'doc-bookmark-card' : ''} ${isMenuOpen ? 'menu-active' : ''} ${autoTagging ? 'is-auto-tagging' : ''}`}>
      {/* Refined Minimalist Pin Badge */}
      {onTogglePin && (
        <button
          type="button"
          className={`slip-pushpin-btn slip-pin-btn ${isPinned ? 'is-pinned' : 'is-unpinned'} ${isPinning ? 'is-pinning' : ''}`}
          onClick={handlePinClick}
          title={isPinned ? 'Pinned to top • Click to unpin' : 'Pin slip to top'}
          aria-label={isPinned ? 'Unpin slip from top' : 'Pin slip to top'}
        >
          <SlipPinIcon isPinned={isPinned} isPinning={isPinning} />
          {isPinned && <span className="slip-pinned-indicator slip-pin-label" title="Pinned to top">Pinned</span>}
        </button>
      )}

      {isAIConnected && autoTagging && (
        <div className="card-ai-progress-bar" title="AI Auto-tagging in progress...">
          <div className="card-ai-progress-pulse" />
        </div>
      )}

      {/* 1. Note Card Header Banner */}
      {isNote ? (
        <div
          className="note-card-banner"
          onClick={() => onOpenReader(bookmark)}
          style={{
            background: 'linear-gradient(135deg, rgba(228, 43, 12, 0.07) 0%, rgba(228, 43, 12, 0.02) 100%)',
            padding: '16px 18px 12px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)'
              }}
            >
              <FileText size={15} />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary)', letterSpacing: '0.02em' }}>
              Note
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
            {new Date(bookmark.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      ) : isDocument ? (
        /* 2. PDF Document Card Header Banner */
        <div
          className="doc-card-banner"
          onClick={handleCardMediaClick}
          style={{
            background: 'linear-gradient(135deg, rgba(228, 43, 12, 0.08) 0%, rgba(0, 0, 0, 0.02) 100%)',
            padding: '24px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            cursor: 'pointer'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)',
              flexShrink: 0
            }}
          >
            <FileCode2 size={22} />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-secondary)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {renderInlineMarkdown(bookmark.title)}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              PDF Document
            </span>
          </div>
        </div>
      ) : bookmark.image_path ? (
        /* 3. Image / Article Media Banner */
        <div
          className="card-media"
          onClick={handleCardMediaClick}
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
        /* 4. Standard Link Fallback Banner */
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
        {/* AI Semantic Match Indicator */}
        {isAIConnected && bookmark.matchReason && (
          <div
            className={`card-ai-match-badge ${isMatchReasonExpanded ? 'ai-match-expanded' : ''}`}
            title={`Semantic Relevance: ${bookmark.matchScore || 0}%\nClick to toggle full explanation`}
            onClick={(e) => {
              e.stopPropagation();
              setIsMatchReasonExpanded(prev => !prev);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                setIsMatchReasonExpanded(prev => !prev);
              }
            }}
          >
            <div className="ai-match-left">
              <Sparkles size={13} className="ai-match-icon" />
              <span className="ai-match-text">
                {bookmark.matchReason}
              </span>
            </div>
            <div className="ai-match-right">
              {typeof bookmark.matchScore === 'number' && (
                <span className="ai-match-score">{bookmark.matchScore}%</span>
              )}
            </div>
          </div>
        )}

        {!isNote && !isDocument && bookmark.image_path && (
          <div className="card-header-info">
            {bookmark.favicon_path ? (
              <img src={bookmark.favicon_path} alt="" className="favicon-icon" />
            ) : isLocalImage ? (
              <ImageIcon size={13} style={{ color: 'var(--color-muted)' }} />
            ) : (
              <Globe size={13} />
            )}
            <span className="card-domain">{hostname}</span>
            <span className="card-type-badge">{bookmark.content_type}</span>
          </div>
        )}

        {/* Title */}
        {isNote ? (
          <div
            className="card-title"
            style={{ cursor: 'pointer', marginBottom: '8px' }}
            onClick={() => onOpenReader(bookmark)}
          >
            {renderInlineMarkdown(bookmark.title)}
          </div>
        ) : isDocument ? (
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card-title"
          >
            {renderInlineMarkdown(bookmark.title)}
          </a>
        ) : (
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card-title"
          >
            {renderInlineMarkdown(bookmark.title)}
          </a>
        )}

        {/* Note Body or Description */}
        {isNote ? (
          <div
            className="note-card-snippet"
            onClick={() => onOpenReader(bookmark)}
            style={{
              fontSize: '13px',
              color: 'var(--color-secondary)',
              lineHeight: 1.5,
              cursor: 'pointer',
              maxHeight: '180px',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            {renderFormattedNote(bookmark.personal_note || bookmark.description || '')}
          </div>
        ) : (
          bookmark.description && (
            <p className="card-description">{bookmark.description}</p>
          )
        )}

        {/* Personal Sticky Note Drawer (renders only when toggled on) */}
        {!isNote && showNote && (
          <div className="card-note-drawer" style={{ margin: '8px 0' }}>
            <div className="card-note-header">
              <span className="card-note-label">📝 Personal Note</span>
              <button
                type="button"
                className="card-note-close"
                onClick={() => setShowNote(false)}
                title="Close note"
                aria-label="Close note"
              >
                ×
              </button>
            </div>
            {bookmark.personal_note ? (
              <div className="card-note-text" style={{ marginTop: '2px' }}>
                {renderFormattedNote(bookmark.personal_note)}
              </div>
            ) : (
              <p className="card-note-text" style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>
                No note written yet.{' '}
                <button
                  type="button"
                  onClick={() => onEdit(bookmark)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                    font: 'inherit'
                  }}
                >
                  Click to add
                </button>
              </p>
            )}
          </div>
        )}

        {((bookmark.tags && bookmark.tags.length > 0) || autoTagging) && (
          <div className="card-tags">
            {bookmark.tags && bookmark.tags.slice(0, 3).map((t) => (
              <span
                key={t.id || t.name}
                className="tag-pill"
                onClick={() => onTagClick(t.name)}
              >
                #{t.name}
              </span>
            ))}
            {bookmark.tags && bookmark.tags.length > 3 && (
              <span
                className="tag-pill-more"
                title={bookmark.tags.slice(3).map((t) => `#${t.name}`).join(', ')}
              >
                +{bookmark.tags.length - 3}
              </span>
            )}
            {isAIConnected && autoTagging && (
              <span className="tag-pill tag-pill-ai-loading">
                <Sparkles size={11} className="spin-animation" />
                <span>Auto-tagging...</span>
              </span>
            )}
          </div>
        )}

        <div className="card-actions">
          <div className="card-actions-left">
            {(isArticle || isNote) && (
              <button
                className="icon-btn"
                title={isNote ? 'Open Full Note' : 'Reader Mode'}
                aria-label={isNote ? 'Open Full Note' : 'Reader Mode'}
                onClick={() => onOpenReader(bookmark)}
              >
                <Eye size={16} />
              </button>
            )}

            {!isNote && (
              <button
                className={`icon-btn ${bookmark.personal_note ? 'has-note-btn' : ''} ${showNote ? 'active-note-btn' : ''}`}
                title={showNote ? 'Hide Personal Note' : 'View Personal Note'}
                aria-label={showNote ? 'Hide Personal Note' : 'View Personal Note'}
                onClick={() => setShowNote(!showNote)}
              >
                <FileText size={15} />
              </button>
            )}
          </div>

          <div className="card-actions-right">
            <button
              className="icon-btn"
              title="Share Bookmark"
              aria-label="Share Bookmark"
              onClick={handleShareClick}
            >
              <Share2 size={16} />
            </button>

            <div className="card-menu-container" ref={menuRef}>
              <button
                className={`icon-btn card-more-btn ${isMenuOpen ? 'active' : ''}`}
                title="More actions"
                aria-label="More actions"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                <MoreHorizontal size={17} />
              </button>

              {isMenuOpen && (
                <div className="card-dropdown-menu">
                  <button
                    className="card-dropdown-item"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onEdit(bookmark);
                    }}
                  >
                    <Edit3 size={15} />
                    <span>Edit Bookmark</span>
                  </button>

                  {onTogglePin && (
                    <button
                      className="card-dropdown-item"
                      onClick={() => {
                        setIsMenuOpen(false);
                        handlePinClick();
                      }}
                      disabled={isPinning}
                    >
                      {isPinned ? (
                        <>
                          <PinOff size={15} style={{ color: 'var(--color-primary)' }} />
                          <span>Unpin from top</span>
                        </>
                      ) : (
                        <>
                          <Pin size={15} />
                          <span>Pin to top</span>
                        </>
                      )}
                    </button>
                  )}

                  {onManageClips && (
                    <button
                      className="card-dropdown-item"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onManageClips(bookmark);
                      }}
                    >
                      <Paperclip size={15} />
                      <span>Organize in Clip</span>
                    </button>
                  )}

                  {onRemoveFromClip && (
                    <button
                      className="card-dropdown-item"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onRemoveFromClip(bookmark.id);
                      }}
                    >
                      <Paperclip size={15} style={{ opacity: 0.6 }} />
                      <span>Unclip from this Stack</span>
                    </button>
                  )}

                  {!isNote && (
                    <a
                      href={bookmark.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="card-dropdown-item"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <ExternalLink size={15} />
                      <span>{isDocument ? 'Open PDF in new tab' : 'Open in new tab'}</span>
                    </a>
                  )}

                  {!isNote && !isDocument && !isLocalImage && (
                    <button
                      className="card-dropdown-item"
                      onClick={() => {
                        setIsMenuOpen(false);
                        handleRescrapeClick();
                      }}
                      disabled={rescaping}
                    >
                      <RefreshCw size={15} className={rescaping ? 'spin-animation' : ''} />
                      <span>{rescaping ? 'Re-scraping...' : 'Re-scrape Metadata'}</span>
                    </button>
                  )}

                  {isAIConnected && onAutoTag && !isDocument && !isLocalImage && (
                    <button
                      className="card-dropdown-item"
                      onClick={() => {
                        setIsMenuOpen(false);
                        handleAutoTagClick();
                      }}
                      disabled={autoTagging}
                    >
                      <Sparkles size={15} className={autoTagging ? 'spin-animation' : ''} />
                      <span>{autoTagging ? 'Auto-tagging...' : 'Auto-tag with AI'}</span>
                    </button>
                  )}

                  <div className="card-dropdown-divider" />

                  <button
                    className="card-dropdown-item card-dropdown-danger"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onDelete(bookmark.id);
                    }}
                  >
                    <Trash2 size={15} />
                    <span>Delete Bookmark</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Share2, Trash2, Smartphone } from 'lucide-react';
import { Bookmark } from '../types';
import { shareBookmark, revokeShareBookmark } from '../api';

interface ShareModalProps {
  bookmark: Bookmark | null;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ bookmark, onClose }) => {
  const [shareUrl, setShareUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bookmark) return;

    let mounted = true;
    setLoading(true);
    setError('');

    shareBookmark(bookmark.id)
      .then((data) => {
        if (mounted) {
          const fullUrl = window.location.origin + data.shareUrl;
          setShareUrl(fullUrl);
        }
      })
      .catch((err) => {
        if (mounted) setError(err.message || 'Failed to generate share link');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [bookmark]);

  if (!bookmark) return null;

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: bookmark.title,
          text: bookmark.description || bookmark.title,
          url: shareUrl || bookmark.url
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError('Native sharing failed');
        }
      }
    }
  };

  const handleRevoke = async () => {
    setLoading(true);
    try {
      await revokeShareBookmark(bookmark.id);
      setShareUrl('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to revoke link');
    } finally {
      setLoading(false);
    }
  };

  const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Share2 size={18} style={{ color: 'var(--color-primary)' }} />
            <h2 className="modal-title">Share Bookmark</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '14px', color: 'var(--color-muted)', marginBottom: '20px' }}>
          Anyone with this secret public link can view this bookmark and its reader article.
        </p>

        {error && (
          <div style={{ color: 'var(--color-error)', fontSize: '13px', marginBottom: '16px', background: 'rgba(228, 43, 12, 0.08)', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ color: 'var(--color-muted)', fontSize: '14px' }}>Generating secure link...</p>
        ) : shareUrl ? (
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                readOnly
                className="form-input"
                style={{ flex: 1, fontSize: '13px' }}
                value={shareUrl}
              />
              <button className="btn btn-primary" onClick={handleCopy}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {hasNativeShare && (
              <button
                className="btn btn-secondary"
                onClick={handleNativeShare}
                style={{ width: '100%', marginBottom: '20px' }}
              >
                <Smartphone size={15} />
                <span>Share via Android / iOS Apps</span>
              </button>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button className="btn btn-danger" onClick={handleRevoke}>
                <Trash2 size={14} />
                <span>Revoke Share Link</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Share2,
  Download,
  Image as ImageIcon,
  ExternalLink,
  Smartphone,
  FileCode2,
  StickyNote
} from 'lucide-react';
import { Bookmark } from '../types';
import { renderInlineMarkdown, renderFormattedNote } from '../utils/markdown';
import { copyToClipboard } from '../utils/clipboard';

interface ShareModalProps {
  bookmark: Bookmark | null;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ bookmark, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [imageCopied, setImageCopied] = useState(false);
  const [noteCopied, setNoteCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!bookmark) return null;

  const isNote = bookmark.content_type === 'note' || bookmark.url.startsWith('slip://note/');
  const isPdf = bookmark.content_type === 'document' || bookmark.url.endsWith('.pdf') || (bookmark.image_path && bookmark.image_path.endsWith('.pdf'));
  const isLocalImage =
    !isPdf &&
    bookmark.content_type === 'image' &&
    (bookmark.url.startsWith('/api/cache') || bookmark.url.startsWith('local://') || !bookmark.url.startsWith('http'));

  const handleCopyLink = async () => {
    const success = await copyToClipboard(bookmark.url);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadImage = async () => {
    const imageUrl = bookmark.image_path || bookmark.url;
    setDownloading(true);
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const sanitizedName = (bookmark.title || 'image').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `${sanitizedName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(imageUrl, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPdf = async () => {
    const pdfUrl = bookmark.url.startsWith('/api/cache') ? bookmark.url : (bookmark.image_path || bookmark.url);
    setDownloading(true);
    try {
      const res = await fetch(pdfUrl);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const sanitizedName = (bookmark.title || 'document').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `${sanitizedName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(pdfUrl, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyImage = async () => {
    const imageUrl = bookmark.image_path || bookmark.url;
    let copied = false;

    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      try {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const item = new ClipboardItem({ [blob.type || 'image/png']: blob });
        await navigator.clipboard.write([item]);
        copied = true;
      } catch (err) {
        console.warn('Direct image blob copy failed, falling back to image URL copy:', err);
      }
    }

    if (!copied) {
      // Fallback: copy link
      const fullUrl = imageUrl.startsWith('http://') || imageUrl.startsWith('https://')
        ? imageUrl
        : window.location.origin + imageUrl;
      copied = await copyToClipboard(fullUrl);
    }

    if (copied) {
      setImageCopied(true);
      setTimeout(() => setImageCopied(false), 2000);
    }
  };

  const handleCopyNoteText = async () => {
    const noteText = bookmark.personal_note || bookmark.description || '';
    const fullText = bookmark.title ? `# ${bookmark.title}\n\n${noteText}` : noteText;
    const success = await copyToClipboard(fullText);
    if (success) {
      setNoteCopied(true);
      setTimeout(() => setNoteCopied(false), 2000);
    }
  };

  const handleDownloadNoteMd = () => {
    const noteText = bookmark.personal_note || bookmark.description || '';
    const fullText = bookmark.title ? `# ${bookmark.title}\n\n${noteText}` : noteText;
    const blob = new Blob([fullText], { type: 'text/markdown;charset=utf-8;' });
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    const sanitizedName = (bookmark.title || 'note').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${sanitizedName}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  };

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isAndroid = /android/i.test(userAgent);
  const hasNativeShare = (typeof navigator !== 'undefined' && typeof navigator.share === 'function') || isAndroid;

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: bookmark.title,
          text: bookmark.description || bookmark.title,
          url: isNote ? undefined : bookmark.url
        });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    if (isAndroid && !isNote) {
      const shareText = `${bookmark.title}\n${bookmark.url}`;
      const intentUri = `intent:#Intent;action=android.intent.action.SEND;type=text/plain;S.android.intent.extra.TEXT=${encodeURIComponent(shareText)};S.android.intent.extra.SUBJECT=${encodeURIComponent(bookmark.title)};end`;
      window.location.href = intentUri;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isNote ? (
              <StickyNote size={18} style={{ color: 'var(--color-primary)' }} />
            ) : isPdf ? (
              <FileCode2 size={18} style={{ color: 'var(--color-primary)' }} />
            ) : isLocalImage ? (
              <ImageIcon size={18} style={{ color: 'var(--color-primary)' }} />
            ) : (
              <Share2 size={18} style={{ color: 'var(--color-primary)' }} />
            )}
            <h2 className="modal-title">
              {isNote
                ? 'Share Note'
                : isPdf
                ? 'Share PDF Document'
                : isLocalImage
                ? 'Share Image'
                : 'Share Link'}
            </h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Card Title Snippet */}
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-secondary)', marginBottom: '16px', lineHeight: 1.4 }}>
          {renderInlineMarkdown(bookmark.title)}
        </p>

        {isNote ? (
          /* --- 1. NOTE CARD SHARE --- */
          <div>
            <div
              style={{
                maxHeight: '180px',
                overflowY: 'auto',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-tertiary)',
                marginBottom: '16px',
                border: '1px solid var(--color-border)',
                fontSize: '13px',
                lineHeight: 1.6
              }}
            >
              {renderFormattedNote(bookmark.personal_note || bookmark.description || '')}
            </div>

            <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '16px' }}>
              Copy the full markdown note text to your clipboard or download as a standalone <code>.md</code> document.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                className="btn btn-primary"
                onClick={handleCopyNoteText}
                style={{ width: '100%', height: '42px', justifyContent: 'center' }}
              >
                {noteCopied ? <Check size={16} /> : <Copy size={16} />}
                <span>{noteCopied ? 'Note Copied to Clipboard!' : 'Copy Text to Clipboard'}</span>
              </button>

              <button
                className="btn btn-secondary"
                onClick={handleDownloadNoteMd}
                style={{ width: '100%', height: '38px', justifyContent: 'center' }}
              >
                <Download size={15} />
                <span>Download as .md file</span>
              </button>
            </div>
          </div>
        ) : isPdf ? (
          /* --- 2. PDF CARD SHARE --- */
          <div>
            <div
              style={{
                padding: '16px 18px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(228, 43, 12, 0.06)',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                border: '1px solid var(--color-border)'
              }}
            >
              <FileCode2 size={28} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
              <div style={{ overflow: 'hidden' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-secondary)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {bookmark.title}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>PDF Document</span>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '16px' }}>
              Download the original PDF file to your device to attach and send via WhatsApp, Slack, or Email.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                className="btn btn-primary"
                onClick={handleDownloadPdf}
                disabled={downloading}
                style={{ width: '100%', height: '42px', justifyContent: 'center' }}
              >
                <Download size={16} />
                <span>{downloading ? 'Downloading PDF...' : 'Download PDF to Device'}</span>
              </button>

              <a
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ width: '100%', height: '38px', justifyContent: 'center', textDecoration: 'none' }}
              >
                <ExternalLink size={15} />
                <span>Open PDF in New Tab</span>
              </a>
            </div>
          </div>
        ) : isLocalImage ? (
          /* --- 3. IMAGE CARD SHARE --- */
          <div>
            {bookmark.image_path && (
              <div
                style={{
                  maxHeight: '220px',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  background: 'var(--color-tertiary)',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--color-border)'
                }}
              >
                <img
                  src={bookmark.image_path}
                  alt={bookmark.title}
                  style={{ maxHeight: '220px', maxWidth: '100%', objectFit: 'contain' }}
                />
              </div>
            )}

            <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '16px' }}>
              Download the original full-resolution image to your device to attach and send via WhatsApp, Messages, or Email.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                className="btn btn-primary"
                onClick={handleDownloadImage}
                disabled={downloading}
                style={{ width: '100%', height: '42px', justifyContent: 'center' }}
              >
                <Download size={16} />
                <span>{downloading ? 'Downloading...' : 'Download Image to Device'}</span>
              </button>

              <button
                className="btn btn-secondary"
                onClick={handleCopyImage}
                style={{ width: '100%', height: '38px', justifyContent: 'center' }}
              >
                {imageCopied ? <Check size={16} style={{ color: '#16a34a' }} /> : <Copy size={16} />}
                <span>{imageCopied ? 'Image Copied to Clipboard!' : 'Copy Image to Clipboard'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* --- 4. URL CARD SHARE --- */
          <div>
            <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '12px' }}>
              Copy the original website link to send directly via WhatsApp, Telegram, or message:
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                readOnly
                className="form-input"
                style={{ flex: 1, fontSize: '13px' }}
                value={bookmark.url}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button className="btn btn-primary" onClick={handleCopyLink}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {hasNativeShare && (
              <button
                className="btn btn-secondary"
                onClick={handleNativeShare}
                style={{ width: '100%', marginBottom: '12px', justifyContent: 'center' }}
              >
                <Smartphone size={15} />
                <span>Share via Mobile Apps</span>
              </button>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <a
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ fontSize: '12px', height: '32px', textDecoration: 'none' }}
              >
                <ExternalLink size={13} />
                <span>Open in New Tab</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

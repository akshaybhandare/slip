import React, { useState, useEffect, useRef } from 'react';
import { X, Link2, Image as ImageIcon, UploadCloud, CheckCircle2, FileImage } from 'lucide-react';
import { Tag } from '../types';
import { TagInput } from './TagInput';

interface AddBookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { url: string; tags: string[] }) => Promise<void>;
  onSaveImage?: (data: {
    file?: File;
    imageData?: string;
    filename?: string;
    title?: string;
    description?: string;
    personalNote?: string;
    tags?: string[];
  }) => Promise<void>;
  initialFile?: File | null;
  availableTags?: Tag[];
}

export const AddBookmarkModal: React.FC<AddBookmarkModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onSaveImage,
  initialFile = null,
  availableTags = []
}) => {
  const [mode, setMode] = useState<'url' | 'image'>('url');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Image Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageTitle, setImageTitle] = useState('');
  const [imageDescription, setImageDescription] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // If initialFile passed from drag-and-drop
  useEffect(() => {
    if (initialFile && isOpen) {
      setMode('image');
      handleFileSelected(initialFile);
    }
  }, [initialFile, isOpen]);

  const handleFileSelected = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, WEBP, GIF, SVG).');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError('Image file exceeds the 25MB limit.');
      return;
    }

    setError('');
    setSelectedFile(file);

    // Auto clean title from filename
    const cleanTitle = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .trim();
    setImageTitle(cleanTitle);

    // Create thumbnail preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleDropzoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setImageTitle('');
    setImageDescription('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetForm = () => {
    setUrl('');
    setTags([]);
    setError('');
    handleClearImage();
    setMode('url');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'url') {
      if (!url.trim()) return;
      setLoading(true);
      try {
        await onSave({ url: url.trim(), tags });
        handleClose();
      } catch (err: any) {
        setError(err.message || 'Failed to save bookmark');
      } finally {
        setLoading(false);
      }
    } else {
      if (!selectedFile) {
        setError('Please choose or drop an image file first.');
        return;
      }
      if (!onSaveImage) {
        setError('Image upload handler is not configured.');
        return;
      }

      setLoading(true);
      try {
        await onSaveImage({
          file: selectedFile,
          imageData: imagePreview || undefined,
          filename: selectedFile.name,
          title: imageTitle.trim() || undefined,
          description: imageDescription.trim() || undefined,
          tags
        });
        handleClose();
      } catch (err: any) {
        setError(err.message || 'Failed to upload image bookmark');
      } finally {
        setLoading(false);
      }
    }
  };

  if (!isOpen) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Save to Slip</h2>
          <button className="modal-close" onClick={handleClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Tab switch */}
        <div className="modal-tab-bar">
          <button
            type="button"
            className={`modal-tab-btn ${mode === 'url' ? 'active' : ''}`}
            onClick={() => {
              setMode('url');
              setError('');
            }}
          >
            <Link2 size={15} />
            <span>Web Link</span>
          </button>
          <button
            type="button"
            className={`modal-tab-btn ${mode === 'image' ? 'active' : ''}`}
            onClick={() => {
              setMode('image');
              setError('');
            }}
          >
            <ImageIcon size={15} />
            <span>Upload Image</span>
          </button>
        </div>

        {error && (
          <div style={{ color: 'var(--color-error)', fontSize: '13px', marginBottom: '16px', background: 'rgba(228, 43, 12, 0.08)', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'url' ? (
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
          ) : (
            <div className="image-upload-section">
              {!selectedFile ? (
                <div
                  className={`image-dropzone ${isDragOver ? 'drag-over' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDropzoneDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <div className="dropzone-icon">
                    <UploadCloud size={28} />
                  </div>
                  <p className="dropzone-title">Click to upload or drag & drop</p>
                  <p className="dropzone-subtitle">JPG, PNG, WEBP, GIF, SVG up to 25MB</p>
                </div>
              ) : (
                <div className="image-selected-preview">
                  <div className="image-preview-thumbnail-wrapper">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Upload preview" className="image-preview-thumbnail" />
                    ) : (
                      <FileImage size={32} />
                    )}
                  </div>
                  <div className="image-preview-info">
                    <div className="image-preview-filename" title={selectedFile.name}>
                      {selectedFile.name}
                    </div>
                    <div className="image-preview-meta">
                      <span className="file-size-badge">{formatFileSize(selectedFile.size)}</span>
                      <span className="file-type-badge">{selectedFile.type.split('/')[1]?.toUpperCase()}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleClearImage}
                    title="Change image"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {selectedFile && (
                <>
                  <div className="form-group" style={{ marginTop: '14px' }}>
                    <label className="form-label">Title</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ width: '100%' }}
                      placeholder="Image title"
                      value={imageTitle}
                      onChange={(e) => setImageTitle(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Note / Description (Optional)</label>
                    <textarea
                      className="form-input"
                      style={{ width: '100%', minHeight: '60px', resize: 'vertical' }}
                      placeholder="Add an optional note or context..."
                      value={imageDescription}
                      onChange={(e) => setImageDescription(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label">Tags & Collection</label>
            <TagInput tags={tags} onChange={setTags} availableTags={availableTags} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || (mode === 'image' && !selectedFile)}
            >
              {loading ? (mode === 'image' ? 'Uploading...' : 'Archiving...') : (mode === 'image' ? 'Save Image' : 'Save Bookmark')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

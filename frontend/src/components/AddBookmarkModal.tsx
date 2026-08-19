import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Link2,
  UploadCloud,
  FileText
} from 'lucide-react';
import { Tag } from '../types';
import { TagInput } from './TagInput';
import { NoteEditor } from './NoteEditor';
import { renderFormattedNote, renderInlineMarkdown } from '../utils/markdown';

// Re-export for backward compatibility with other components importing from here
export { renderFormattedNote, renderInlineMarkdown };

interface AddBookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { url: string; tags: string[] }) => Promise<void>;
  onSaveFile?: (data: {
    file?: File;
    fileData?: string;
    imageData?: string;
    filename?: string;
    title?: string;
    description?: string;
    personalNote?: string;
    tags?: string[];
  }) => Promise<void>;
  onSaveImage?: (data: {
    file?: File;
    imageData?: string;
    filename?: string;
    title?: string;
    description?: string;
    personalNote?: string;
    tags?: string[];
  }) => Promise<void>;
  onSaveNote?: (data: {
    title?: string;
    content: string;
    tags?: string[];
  }) => Promise<void>;
  initialFile?: File | null;
  availableTags?: Tag[];
  isAIConnected?: boolean;
  onOpenAISettings?: () => void;
}

export const AddBookmarkModal: React.FC<AddBookmarkModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onSaveFile,
  onSaveImage,
  onSaveNote,
  initialFile,
  availableTags = [],
  isAIConnected = true,
  onOpenAISettings
}) => {
  const [mode, setMode] = useState<'url' | 'file' | 'note'>('url');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // File upload state (Image or PDF)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileTitle, setFileTitle] = useState('');
  const [fileDescription, setFileDescription] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Standalone Note state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  useEffect(() => {
    if (isOpen && initialFile) {
      setMode('file');
      handleFileSelected(initialFile);
    }
  }, [initialFile, isOpen]);

  const handleFileSelected = (file: File) => {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

    if (!isImage && !isPdf) {
      setError('Please select a valid image (JPG, PNG, WEBP, GIF, SVG) or PDF document.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('File exceeds the 50MB size limit.');
      return;
    }

    setError('');
    setSelectedFile(file);

    // Auto clean title from filename
    const cleanTitle = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .trim();
    setFileTitle(cleanTitle);

    if (isImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
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

  const handleClearFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setFileTitle('');
    setFileDescription('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetForm = () => {
    setUrl('');
    setTags([]);
    setError('');
    handleClearFile();
    setNoteTitle('');
    setNoteContent('');
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
    } else if (mode === 'file') {
      if (!selectedFile) {
        setError('Please choose or drop an image or PDF file first.');
        return;
      }
      const saveHandler = onSaveFile || onSaveImage;
      if (!saveHandler) {
        setError('File upload handler is not configured.');
        return;
      }

      setLoading(true);
      try {
        await saveHandler({
          file: selectedFile,
          imageData: filePreview || undefined,
          fileData: filePreview || undefined,
          filename: selectedFile.name,
          title: fileTitle.trim() || undefined,
          description: fileDescription.trim() || undefined,
          tags
        });
        handleClose();
      } catch (err: any) {
        setError(err.message || 'Failed to upload file');
      } finally {
        setLoading(false);
      }
    } else if (mode === 'note') {
      if (!noteContent.trim() && !noteTitle.trim()) {
        setError('Please enter note content or a title.');
        return;
      }
      if (!onSaveNote) {
        setError('Note creation handler is not configured.');
        return;
      }

      setLoading(true);
      try {
        await onSaveNote({
          title: noteTitle.trim() || undefined,
          content: noteContent.trim(),
          tags
        });
        handleClose();
      } catch (err: any) {
        setError(err.message || 'Failed to save note');
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

  const isPdfFile = selectedFile && (selectedFile.type === 'application/pdf' || /\.pdf$/i.test(selectedFile.name));

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: mode === 'note' ? '560px' : '480px' }}>
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
            className={`modal-tab-btn ${mode === 'file' ? 'active' : ''}`}
            onClick={() => {
              setMode('file');
              setError('');
            }}
          >
            <UploadCloud size={15} />
            <span>Upload File</span>
          </button>
          <button
            type="button"
            className={`modal-tab-btn ${mode === 'note' ? 'active' : ''}`}
            onClick={() => {
              setMode('note');
              setError('');
            }}
          >
            <FileText size={15} />
            <span>New Note</span>
          </button>
        </div>

        {error && (
          <div
            style={{
              color: 'var(--color-error)',
              fontSize: '13px',
              marginBottom: '16px',
              background: 'rgba(228, 43, 12, 0.08)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)'
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'url' && (
            <div className="form-group">
              <label className="form-label">URL</label>
              <div style={{ position: 'relative' }}>
                <Link2
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-muted)'
                  }}
                />
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
          )}

          {mode === 'file' && (
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
                    accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,application/pdf"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <div className="dropzone-icon">
                    <UploadCloud size={28} />
                  </div>
                  <p className="dropzone-title">Click to upload or drag & drop</p>
                  <p className="dropzone-subtitle">JPG, PNG, WEBP, GIF, SVG, PDF up to 50MB</p>
                </div>
              ) : (
                <div className="image-selected-preview">
                  <div className="image-preview-thumbnail-wrapper" style={{ background: isPdfFile ? 'rgba(228, 43, 12, 0.08)' : undefined }}>
                    {filePreview ? (
                      <img src={filePreview} alt="Upload preview" className="image-preview-thumbnail" />
                    ) : (
                      <FileText size={32} style={{ color: isPdfFile ? 'var(--color-primary)' : 'var(--color-muted)' }} />
                    )}
                  </div>
                  <div className="image-preview-info">
                    <div className="image-preview-filename" title={selectedFile.name}>
                      {selectedFile.name}
                    </div>
                    <div className="image-preview-meta">
                      <span className="file-size-badge">{formatFileSize(selectedFile.size)}</span>
                      <span className="file-type-badge">
                        {isPdfFile ? 'PDF' : selectedFile.type.split('/')[1]?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleClearFile}
                    title="Change file"
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
                      placeholder="File title"
                      value={fileTitle}
                      onChange={(e) => setFileTitle(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Note / Description (Optional)</label>
                    <textarea
                      className="form-input"
                      style={{ width: '100%', minHeight: '60px', resize: 'vertical' }}
                      placeholder="Add an optional note or context..."
                      value={fileDescription}
                      onChange={(e) => setFileDescription(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {mode === 'note' && (
            <NoteEditor
              title={noteTitle}
              onTitleChange={setNoteTitle}
              content={noteContent}
              onContentChange={setNoteContent}
              titlePlaceholder="Note title or leave blank for auto-title"
              contentPlaceholder="Start typing your note... Use bullet points, **bold**, *italic*, ~~strikethrough~~, or markdown shortcuts."
              minHeight="150px"
              autoFocus
              isAIConnected={isAIConnected}
              onOpenAISettings={onOpenAISettings}
            />
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
              disabled={
                loading ||
                (mode === 'file' && !selectedFile) ||
                (mode === 'note' && !noteContent.trim() && !noteTitle.trim())
              }
            >
              {loading
                ? mode === 'file'
                  ? 'Uploading...'
                  : mode === 'note'
                  ? 'Saving Note...'
                  : 'Archiving...'
                : mode === 'file'
                ? isPdfFile
                  ? 'Save PDF Document'
                  : 'Save Image'
                : mode === 'note'
                ? 'Save Note'
                : 'Save Bookmark'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import { Clip, ClipDetail, Bookmark } from '../types';
import { fetchClips, fetchClip, createClip, updateClip, deleteClip, removeBookmarkFromClip } from '../api';
import { MasonryGrid } from './MasonryGrid';
import {
  Paperclip,
  ArrowLeft,
  Edit3,
  Trash2,
  Plus,
  Loader2,
  X
} from 'lucide-react';

interface ClipsViewProps {
  onBackToFeed: () => void;
  onOpenReader: (bookmark: Bookmark) => void;
  onShare: (bookmark: Bookmark) => void;
  onEdit: (bookmark: Bookmark) => void;
  onRescrape: (id: number) => Promise<void>;
  onAutoTag?: (id: number) => Promise<void>;
  onTogglePin?: (id: number) => Promise<void>;
  isAIConnected?: boolean;
  onDeleteBookmark: (id: number) => void;
  onTagClick: (tagName: string) => void;
  onManageBookmarkClips: (bookmark: Bookmark) => void;
}

export const ClipsView: React.FC<ClipsViewProps> = ({
  onBackToFeed,
  onOpenReader,
  onShare,
  onEdit,
  onRescrape,
  onAutoTag,
  onTogglePin,
  isAIConnected,
  onDeleteBookmark,
  onTagClick,
  onManageBookmarkClips
}) => {
  const [currentClipId, setCurrentClipId] = useState<number | null>(null);
  const [rootClips, setRootClips] = useState<Clip[]>([]);
  const [currentClipDetail, setCurrentClipDetail] = useState<ClipDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals & Forms
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newClipName, setNewClipName] = useState('');
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameClipTarget, setRenameClipTarget] = useState<Clip | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [savingAction, setSavingAction] = useState(false);

  const loadClipsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (currentClipId === null) {
        const allClips = await fetchClips();
        setRootClips(allClips.filter((c) => !c.parent_id));
        setCurrentClipDetail(null);
      } else {
        const detail = await fetchClip(currentClipId);
        setCurrentClipDetail(detail);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load clip contents');
    } finally {
      setLoading(false);
    }
  }, [currentClipId]);

  useEffect(() => {
    loadClipsData();
  }, [loadClipsData]);

  const handleCreateClip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClipName.trim()) return;

    setSavingAction(true);
    setError(null);
    try {
      await createClip(newClipName.trim(), currentClipId);
      setNewClipName('');
      setIsCreateOpen(false);
      loadClipsData();
    } catch (err: any) {
      setError(err.message || 'Failed to create clip');
    } finally {
      setSavingAction(false);
    }
  };

  const handleOpenRename = (clip: Clip) => {
    setRenameClipTarget(clip);
    setRenameValue(clip.name);
    setIsRenameOpen(true);
  };

  const handleSaveRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameClipTarget || !renameValue.trim()) return;

    setSavingAction(true);
    setError(null);
    try {
      await updateClip(renameClipTarget.id, { name: renameValue.trim() });
      setIsRenameOpen(false);
      setRenameClipTarget(null);
      loadClipsData();
    } catch (err: any) {
      setError(err.message || 'Failed to rename clip');
    } finally {
      setSavingAction(false);
    }
  };

  const handleDeleteClip = async (clipId: number, clipName: string) => {
    if (!window.confirm(`Delete the clip "${clipName}"? Any sub-clips will be deleted. Your saved slips will remain safely in your library.`)) {
      return;
    }

    setSavingAction(true);
    setError(null);
    try {
      await deleteClip(clipId);
      if (currentClipId === clipId) {
        const parentId = currentClipDetail?.breadcrumbs && currentClipDetail.breadcrumbs.length > 1
          ? currentClipDetail.breadcrumbs[currentClipDetail.breadcrumbs.length - 2].id
          : null;
        setCurrentClipId(parentId);
      } else {
        loadClipsData();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete clip');
    } finally {
      setSavingAction(false);
    }
  };

  const handleRemoveBookmarkFromCurrentClip = async (bookmarkId: number) => {
    if (!currentClipId) return;
    try {
      await removeBookmarkFromClip(currentClipId, bookmarkId);
      loadClipsData();
    } catch (err: any) {
      alert(err.message || 'Failed to remove slip from clip');
    }
  };

  return (
    <div className="clips-view-container">
      {/* Top Banner Navigation */}
      <div className="clips-top-bar">
        <div className="clips-top-left">
          <button
            type="button"
            className="btn btn-secondary btn-back-stream"
            onClick={onBackToFeed}
            title="Return to Main Stream"
          >
            <ArrowLeft size={16} />
            <span>Main Stream</span>
          </button>
        </div>

        <div className="clips-top-right">
          {currentClipDetail && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleOpenRename(currentClipDetail.clip)}
                title="Rename this clip"
              >
                <Edit3 size={14} />
                <span className="btn-text-hide-mobile">Rename</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleDeleteClip(currentClipDetail.clip.id, currentClipDetail.clip.name)}
                title="Delete this clip"
                style={{ color: 'var(--color-error)' }}
              >
                <Trash2 size={14} />
                <span className="btn-text-hide-mobile">Delete</span>
              </button>
            </>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus size={16} />
            <span>{currentClipId ? 'New Sub-Clip' : 'New Clip'}</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout: Vertical Breadcrumb Spine & Content Deck */}
      <div className="clips-workspace-layout">
        {/* Left Column: Vertical Breadcrumbs Tree Spine */}
        <aside className="clips-vertical-spine-card">
          <div className="spine-header">
            <Paperclip size={16} className="spine-clip-icon" />
            <span className="spine-title">Clip Hierarchy</span>
          </div>

          <div className="vertical-breadcrumbs-tree">
            {/* Root Step */}
            <div
              className={`v-crumb-step ${currentClipId === null ? 'active' : 'clickable'}`}
              onClick={() => setCurrentClipId(null)}
            >
              <div className="v-crumb-dot-col">
                <div className={`v-crumb-dot ${currentClipId === null ? 'current' : ''}`} />
                {currentClipDetail && currentClipDetail.breadcrumbs.length > 0 && (
                  <div className="v-crumb-line" />
                )}
              </div>
              <div className="v-crumb-content">
                <span className="v-crumb-name">All Clips (Root)</span>
              </div>
            </div>

            {/* Ancestor and Current Steps */}
            {currentClipDetail?.breadcrumbs.map((crumb, idx) => {
              const isLast = idx === currentClipDetail.breadcrumbs.length - 1;
              const hasNext = idx < currentClipDetail.breadcrumbs.length - 1;

              return (
                <div
                  key={crumb.id}
                  className={`v-crumb-step ${isLast ? 'active' : 'clickable'}`}
                  onClick={() => !isLast && setCurrentClipId(crumb.id)}
                >
                  <div className="v-crumb-dot-col">
                    <div className={`v-crumb-dot ${isLast ? 'current' : ''}`} />
                    {hasNext && <div className="v-crumb-line" />}
                  </div>
                  <div className="v-crumb-content">
                    <span className="v-crumb-name">{crumb.name}</span>
                    {isLast && (
                      <span className="v-crumb-active-badge">Active Clip</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Right Column: Clipped Deck & Stacks */}
        <main className="clips-main-deck">
          {error && (
            <div className="alert-error" style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(228, 43, 12, 0.1)', color: 'var(--color-error)', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--color-muted)' }}>
              <Loader2 size={26} className="spin-animation" style={{ margin: '0 auto 10px', color: 'var(--color-primary)' }} />
              <p style={{ fontSize: '14px' }}>Loading clipped slips...</p>
            </div>
          ) : (
            <>
              {currentClipId === null ? (
                /* Root View: All Top-Level Clips */
                rootClips.length > 0 ? (
                  <div>
                    <div className="deck-section-header">
                      <span className="deck-section-title">Your Clips ({rootClips.length})</span>
                      <span className="deck-section-hint">Click a clip to open its stack of slips</span>
                    </div>

                    <div className="clip-deck-grid">
                      {rootClips.map((clip) => (
                        <div
                          key={clip.id}
                          className="clip-deck-card"
                          onClick={() => setCurrentClipId(clip.id)}
                        >
                          {/* Top Paperclip Metallic Accent */}
                          <div className="deck-paperclip-pin">
                            <Paperclip size={18} />
                          </div>

                          <div className="deck-card-top">
                            <div className="deck-badge">
                              <span>Clip Deck</span>
                            </div>
                            <div className="deck-card-actions" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="icon-btn"
                                title="Rename clip"
                                onClick={() => handleOpenRename(clip)}
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                title="Delete clip"
                                onClick={() => handleDeleteClip(clip.id, clip.name)}
                                style={{ color: 'var(--color-error)' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          <h3 className="deck-card-title">{clip.name}</h3>

                          <div className="deck-card-footer">
                            <span className="deck-count-pill">
                              📎 {clip.item_count || 0} {(clip.item_count === 1 ? 'slip' : 'slips')}
                            </span>
                            {(clip.subclip_count || 0) > 0 && (
                              <span className="deck-sub-pill">
                                {clip.subclip_count} sub-{(clip.subclip_count === 1 ? 'clip' : 'clips')}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="empty-state clip-empty-deck">
                    <div className="clip-empty-icon-wrap">
                      <Paperclip size={42} />
                    </div>
                    <h3 style={{ fontSize: '19px', fontWeight: 600, marginBottom: '8px', color: 'var(--color-secondary)' }}>
                      Group Your Slips into Clips
                    </h3>
                    <p style={{ maxWidth: '440px', margin: '0 auto 20px', fontSize: '14px', color: 'var(--color-muted)' }}>
                      Clips hold your cards together like paperclips in a physical notebook. Create collections for "3D Printing", "Work Projects", or nest them into "Hobbies".
                    </p>
                    <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
                      <Plus size={16} />
                      <span>Create First Clip</span>
                    </button>
                  </div>
                )
              ) : (
                /* Inside a Specific Clip */
                <div>
                  {/* Sub-Clips Deck Section (if any sub-clips exist) */}
                  {currentClipDetail?.subclips && currentClipDetail.subclips.length > 0 && (
                    <div style={{ marginBottom: '32px' }}>
                      <div className="deck-section-header">
                        <span className="deck-section-title">Sub-Clips ({currentClipDetail.subclips.length})</span>
                      </div>

                      <div className="clip-deck-grid">
                        {currentClipDetail.subclips.map((sub) => (
                          <div
                            key={sub.id}
                            className="clip-deck-card sub-deck-card"
                            onClick={() => setCurrentClipId(sub.id)}
                          >
                            <div className="deck-paperclip-pin">
                              <Paperclip size={16} />
                            </div>

                            <div className="deck-card-top">
                              <div className="deck-badge sub-badge">
                                <span>Sub-Clip</span>
                              </div>
                              <div className="deck-card-actions" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="icon-btn"
                                  title="Rename sub-clip"
                                  onClick={() => handleOpenRename(sub)}
                                >
                                  <Edit3 size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="icon-btn"
                                  title="Delete sub-clip"
                                  onClick={() => handleDeleteClip(sub.id, sub.name)}
                                  style={{ color: 'var(--color-error)' }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            <h3 className="deck-card-title">{sub.name}</h3>

                            <div className="deck-card-footer">
                              <span className="deck-count-pill">
                                📎 {sub.item_count || 0} {(sub.item_count === 1 ? 'slip' : 'slips')}
                              </span>
                              {(sub.subclip_count || 0) > 0 && (
                                <span className="deck-sub-pill">
                                  {sub.subclip_count} sub-clips
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Slips in Active Clip */}
                  <div>
                    <div className="deck-section-header">
                      <span className="deck-section-title">
                        Slips in "{currentClipDetail?.clip.name}" ({currentClipDetail?.bookmarks.length || 0})
                      </span>
                    </div>

                    {currentClipDetail?.bookmarks && currentClipDetail.bookmarks.length > 0 ? (
                      <MasonryGrid
                        bookmarks={currentClipDetail.bookmarks}
                        onOpenReader={onOpenReader}
                        onShare={onShare}
                        onEdit={onEdit}
                        onRescrape={onRescrape}
                        onAutoTag={onAutoTag}
                        onTogglePin={onTogglePin}
                        isAIConnected={isAIConnected}
                        onDelete={onDeleteBookmark}
                        onTagClick={onTagClick}
                        onManageClips={onManageBookmarkClips}
                        onRemoveFromClip={handleRemoveBookmarkFromCurrentClip}
                      />
                    ) : (
                      <div className="empty-state clip-empty-deck" style={{ padding: '40px 20px' }}>
                        <Paperclip size={36} style={{ color: 'var(--color-muted)', margin: '0 auto 12px', opacity: 0.6 }} />
                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-secondary)' }}>
                          No slips clipped here yet
                        </h3>
                        <p style={{ maxWidth: '360px', margin: '0 auto 16px', fontSize: '13px', color: 'var(--color-muted)' }}>
                          Clip cards into "{currentClipDetail?.clip.name}" from your Main Stream by selecting "Organize in Clips" on any card's menu.
                        </p>
                        <button className="btn btn-secondary" onClick={onBackToFeed}>
                          Browse Main Stream
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modal: Create Clip */}
      {isCreateOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Paperclip size={18} style={{ color: 'var(--color-primary)' }} />
                <h2 className="modal-title">{currentClipId ? 'New Sub-Clip' : 'New Clip'}</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setIsCreateOpen(false)} title="Close">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateClip}>
              <div className="modal-body" style={{ padding: '20px 24px' }}>
                {currentClipDetail && (
                  <div style={{ marginBottom: '12px', fontSize: '12.5px', color: 'var(--color-muted)' }}>
                    Parent clip: <strong style={{ color: 'var(--color-secondary)' }}>{currentClipDetail.clip.name}</strong>
                  </div>
                )}

                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--color-secondary)' }}>
                  Clip Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 3d-printing-clip, movies must watch"
                  value={newClipName}
                  onChange={(e) => setNewClipName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 24px', borderTop: '1px solid var(--color-border)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingAction || !newClipName.trim()}>
                  {savingAction ? 'Creating...' : 'Create Clip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Rename Clip */}
      {isRenameOpen && renameClipTarget && (
        <div className="modal-overlay" onClick={() => setIsRenameOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={18} style={{ color: 'var(--color-primary)' }} />
                <h2 className="modal-title">Rename Clip</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setIsRenameOpen(false)} title="Close">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRename}>
              <div className="modal-body" style={{ padding: '20px 24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--color-secondary)' }}>
                  Clip Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 24px', borderTop: '1px solid var(--color-border)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsRenameOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingAction || !renameValue.trim()}>
                  {savingAction ? 'Saving...' : 'Rename'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

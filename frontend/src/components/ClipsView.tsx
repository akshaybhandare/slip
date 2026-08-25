import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Clip, ClipDetail, Bookmark } from '../types';
import {
  fetchClips,
  fetchClip,
  createClip,
  updateClip,
  deleteClip,
  removeBookmarkFromClip,
  fetchRecycleClip,
  fetchRecycleClips,
  restoreBookmark,
  permanentlyDeleteBookmark,
  restoreClip,
  permanentlyDeleteClip,
  emptyRecycleClip,
  bulkDeleteBookmarks,
  bulkRestoreBookmarks,
  bulkPermanentlyDeleteBookmarks,
  bulkDeleteClips,
  bulkRestoreClips,
  bulkPermanentlyDeleteClips,
  bulkAction
} from '../api';
import { MasonryGrid } from './MasonryGrid';
import { BulkActionBar } from './BulkActionBar';
import { isActionSupported, ActionId, ActionContext } from '../config/actionRegistry';
import {
  Paperclip,
  ArrowLeft,
  Edit3,
  Trash2,
  Plus,
  Loader2,
  X,
  RotateCcw
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
  initialViewRecycleClip?: boolean;
  onRecycleCountChange?: (count: number) => void;
  onRecycleClipViewChange?: (isViewing: boolean) => void;
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
  onManageBookmarkClips,
  initialViewRecycleClip = false,
  onRecycleCountChange,
  onRecycleClipViewChange
}) => {
  const [currentClipId, setCurrentClipId] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('slip_current_clip_id');
      return saved ? Number(saved) : null;
    } catch {
      return null;
    }
  });
  const [rootClips, setRootClips] = useState<Clip[]>([]);
  const [currentClipDetail, setCurrentClipDetail] = useState<ClipDetail | null>(null);
  const [isViewingRecycleClip, setIsViewingRecycleClip] = useState<boolean>(initialViewRecycleClip);
  const [recycleSlips, setRecycleSlips] = useState<Bookmark[]>([]);
  const [recycleClips, setRecycleClips] = useState<Clip[]>([]);
  const [deleteClipTarget, setDeleteClipTarget] = useState<Clip | null>(null);
  const [deleteIncludeChildren, setDeleteIncludeChildren] = useState<boolean>(true);
  const [isEmptyConfirmOpen, setIsEmptyConfirmOpen] = useState<boolean>(false);
  const [emptyInProgress, setEmptyInProgress] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Multi-Selection State
  const [selectedSlipIds, setSelectedSlipIds] = useState<Set<number>>(new Set());
  const [selectedClipIds, setSelectedClipIds] = useState<Set<number>>(new Set());
  const [isBulkPermDeleteOpen, setIsBulkPermDeleteOpen] = useState(false);
  const [isBulkDeleteClipsOpen, setIsBulkDeleteClipsOpen] = useState(false);
  const [bulkIncludeChildren, setBulkIncludeChildren] = useState(true);
  const [bulkInProgress, setBulkInProgress] = useState(false);

  const onRecycleCountChangeRef = useRef(onRecycleCountChange);
  useEffect(() => {
    onRecycleCountChangeRef.current = onRecycleCountChange;
  }, [onRecycleCountChange]);

  const onRecycleClipViewChangeRef = useRef(onRecycleClipViewChange);
  useEffect(() => {
    onRecycleClipViewChangeRef.current = onRecycleClipViewChange;
  }, [onRecycleClipViewChange]);

  useEffect(() => {
    if (initialViewRecycleClip) {
      setCurrentClipId(null);
      setIsViewingRecycleClip(true);
    }
  }, [initialViewRecycleClip]);

  useEffect(() => {
    onRecycleClipViewChangeRef.current?.(isViewingRecycleClip);
  }, [isViewingRecycleClip]);

  const navigateToClip = (id: number | null) => {
    setSelectedSlipIds(new Set());
    setSelectedClipIds(new Set());
    setIsViewingRecycleClip(false);
    setCurrentClipId(id);
    try {
      if (id !== null) {
        localStorage.setItem('slip_current_clip_id', String(id));
      } else {
        localStorage.removeItem('slip_current_clip_id');
      }
    } catch {}
  };

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
      // Always fetch recycle bin slips & clips for counts & view
      const [trashedSlips, trashedClips] = await Promise.all([
        fetchRecycleClip().catch(() => []),
        fetchRecycleClips().catch(() => [])
      ]);
      setRecycleSlips(trashedSlips);
      setRecycleClips(trashedClips);
      onRecycleCountChangeRef.current?.(trashedSlips.length + trashedClips.length);

      if (currentClipId === null) {
        const allClips = await fetchClips();
        setRootClips(allClips.filter((c) => !c.parent_id));
        setCurrentClipDetail(null);
      } else {
        try {
          const detail = await fetchClip(currentClipId);
          setCurrentClipDetail(detail);
        } catch {
          // If the clip was deleted or does not exist, safely fall back to root
          navigateToClip(null);
        }
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

  // Selection handlers
  const isSelectionMode = selectedSlipIds.size > 0 || selectedClipIds.size > 0;

  const toggleSelectSlip = (id: number) => {
    setSelectedSlipIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectClip = (id: number) => {
    setSelectedClipIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedSlipIds(new Set());
    setSelectedClipIds(new Set());
  };

  // Compute active context and selectable counts
  const currentContext: ActionContext = isViewingRecycleClip
    ? 'recycle_clip'
    : currentClipDetail
    ? 'clip_detail'
    : 'feed';

  let totalSelectableCount = 0;
  if (isViewingRecycleClip) {
    totalSelectableCount = recycleSlips.length + recycleClips.length;
  } else if (currentClipDetail) {
    totalSelectableCount = (currentClipDetail.subclips?.length || 0) + (currentClipDetail.bookmarks?.length || 0);
  } else {
    totalSelectableCount = rootClips.length;
  }

  const isAllSelected =
    totalSelectableCount > 0 &&
    (isViewingRecycleClip
      ? selectedSlipIds.size === recycleSlips.length && selectedClipIds.size === recycleClips.length
      : currentClipDetail
      ? selectedClipIds.size === (currentClipDetail.subclips?.length || 0) &&
        selectedSlipIds.size === (currentClipDetail.bookmarks?.length || 0)
      : selectedClipIds.size === rootClips.length);

  const handleSelectAll = () => {
    if (isAllSelected) {
      clearSelection();
    } else {
      if (isViewingRecycleClip) {
        setSelectedSlipIds(new Set(recycleSlips.map((s) => s.id)));
        setSelectedClipIds(new Set(recycleClips.map((c) => c.id)));
      } else if (currentClipDetail) {
        setSelectedClipIds(new Set(currentClipDetail.subclips.map((c) => c.id)));
        setSelectedSlipIds(new Set(currentClipDetail.bookmarks.map((b) => b.id)));
      } else {
        setSelectedClipIds(new Set(rootClips.map((c) => c.id)));
      }
    }
  };

  // Bulk Action Execution Router
  const handleExecuteBulkAction = async (actionId: ActionId) => {
    if (actionId === 'restore') {
      await handleConfirmBulkRestore();
    } else if (actionId === 'permanent_delete') {
      setIsBulkPermDeleteOpen(true);
    } else if (actionId === 'delete') {
      if (selectedClipIds.size > 0) {
        setIsBulkDeleteClipsOpen(true);
      } else {
        await handleConfirmBulkDeleteSlipsOnly();
      }
    } else if (actionId === 'remove_from_clip') {
      await handleBulkRemoveFromCurrentClip();
    }
  };

  const handleConfirmBulkRestore = async () => {
    const slipIdsArr = Array.from(selectedSlipIds);
    const clipIdsArr = Array.from(selectedClipIds);
    if (slipIdsArr.length === 0 && clipIdsArr.length === 0) return;

    // Optimistic instantaneous UI update
    setRecycleSlips((prev) => prev.filter((s) => !selectedSlipIds.has(s.id)));
    setRecycleClips((prev) => prev.filter((c) => !selectedClipIds.has(c.id)));
    if (onRecycleCountChangeRef.current) {
      onRecycleCountChangeRef.current(
        Math.max(0, recycleSlips.length + recycleClips.length - slipIdsArr.length - clipIdsArr.length)
      );
    }
    clearSelection();

    setBulkInProgress(true);
    try {
      await bulkAction({
        action: 'restore',
        slipIds: slipIdsArr,
        clipIds: clipIdsArr
      });
      loadClipsData();
    } catch (err: any) {
      setError(err.message || 'Failed to restore selected items');
      loadClipsData();
    } finally {
      setBulkInProgress(false);
    }
  };

  const handleConfirmBulkPermanentDelete = async () => {
    const slipIdsArr = Array.from(selectedSlipIds);
    const clipIdsArr = Array.from(selectedClipIds);
    if (slipIdsArr.length === 0 && clipIdsArr.length === 0) return;

    setIsBulkPermDeleteOpen(false);

    // Optimistic instantaneous UI update
    setRecycleSlips((prev) => prev.filter((s) => !selectedSlipIds.has(s.id)));
    setRecycleClips((prev) => prev.filter((c) => !selectedClipIds.has(c.id)));
    if (onRecycleCountChangeRef.current) {
      onRecycleCountChangeRef.current(
        Math.max(0, recycleSlips.length + recycleClips.length - slipIdsArr.length - clipIdsArr.length)
      );
    }
    clearSelection();

    setBulkInProgress(true);
    try {
      await bulkAction({
        action: 'permanent_delete',
        slipIds: slipIdsArr,
        clipIds: clipIdsArr
      });
      loadClipsData();
    } catch (err: any) {
      setError(err.message || 'Failed to permanently delete items');
      loadClipsData();
    } finally {
      setBulkInProgress(false);
    }
  };

  const handleConfirmBulkDeleteClips = async () => {
    const slipIdsArr = Array.from(selectedSlipIds);
    const clipIdsArr = Array.from(selectedClipIds);
    const includeChildren = bulkIncludeChildren;
    setIsBulkDeleteClipsOpen(false);

    // Optimistic UI updates
    if (clipIdsArr.length > 0) {
      setRootClips((prev) => prev.filter((c) => !selectedClipIds.has(c.id)));
      if (currentClipDetail) {
        setCurrentClipDetail((prev) =>
          prev
            ? {
                ...prev,
                subclips: prev.subclips.filter((s) => !selectedClipIds.has(s.id))
              }
            : null
        );
      }
    }
    if (slipIdsArr.length > 0 && currentClipDetail) {
      setCurrentClipDetail((prev) =>
        prev
          ? {
              ...prev,
              bookmarks: prev.bookmarks.filter((b) => !selectedSlipIds.has(b.id)),
              clip: {
                ...prev.clip,
                item_count: Math.max(0, (prev.clip.item_count || 1) - slipIdsArr.length)
              }
            }
          : null
      );
    }
    clearSelection();

    setBulkInProgress(true);
    try {
      await bulkAction({
        action: 'delete',
        slipIds: slipIdsArr,
        clipIds: clipIdsArr,
        includeChildren
      });
      loadClipsData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete selected items');
      loadClipsData();
    } finally {
      setBulkInProgress(false);
    }
  };

  const handleConfirmBulkDeleteSlipsOnly = async () => {
    const slipIdsArr = Array.from(selectedSlipIds);
    if (slipIdsArr.length === 0) return;

    if (currentClipDetail) {
      setCurrentClipDetail((prev) =>
        prev
          ? {
              ...prev,
              bookmarks: prev.bookmarks.filter((b) => !selectedSlipIds.has(b.id)),
              clip: {
                ...prev.clip,
                item_count: Math.max(0, (prev.clip.item_count || 1) - slipIdsArr.length)
              }
            }
          : null
      );
    }
    clearSelection();

    setBulkInProgress(true);
    try {
      await bulkDeleteBookmarks(slipIdsArr);
      loadClipsData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete selected slips');
      loadClipsData();
    } finally {
      setBulkInProgress(false);
    }
  };

  const handleBulkRemoveFromCurrentClip = async () => {
    if (!currentClipId) return;
    const slipIdsArr = Array.from(selectedSlipIds);
    if (slipIdsArr.length === 0) return;

    // Optimistic instantaneous UI update
    if (currentClipDetail) {
      setCurrentClipDetail((prev) =>
        prev
          ? {
              ...prev,
              bookmarks: prev.bookmarks.filter((b) => !selectedSlipIds.has(b.id)),
              clip: {
                ...prev.clip,
                item_count: Math.max(0, (prev.clip.item_count || 1) - slipIdsArr.length)
              }
            }
          : null
      );
    }
    clearSelection();

    setBulkInProgress(true);
    try {
      for (const bId of slipIdsArr) {
        await removeBookmarkFromClip(currentClipId, bId);
      }
      loadClipsData();
    } catch (err: any) {
      setError(err.message || 'Failed to unclip slips');
      loadClipsData();
    } finally {
      setBulkInProgress(false);
    }
  };

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

  const handleOpenDeleteClip = (clip: Clip) => {
    setDeleteClipTarget(clip);
    setDeleteIncludeChildren(true);
  };

  const handleConfirmDeleteClip = async () => {
    if (!deleteClipTarget) return;

    const targetId = deleteClipTarget.id;
    const targetClip = deleteClipTarget;
    const includeChildren = deleteIncludeChildren;

    // Optimistic instantaneous UI update
    setDeleteClipTarget(null);
    setRootClips((prev) => prev.filter((c) => c.id !== targetId));
    if (currentClipDetail) {
      setCurrentClipDetail((prev) =>
        prev
          ? {
              ...prev,
              subclips: prev.subclips.filter((s) => s.id !== targetId)
            }
          : null
      );
    }
    setRecycleClips((prev) => [{ ...targetClip, deleted_at: new Date().toISOString() }, ...prev]);
    if (onRecycleCountChangeRef.current) {
      onRecycleCountChangeRef.current(recycleSlips.length + recycleClips.length + 1);
    }

    setSavingAction(true);
    setError(null);
    try {
      await deleteClip(targetId, includeChildren);
      if (currentClipId === targetId) {
        const parentId =
          currentClipDetail?.breadcrumbs && currentClipDetail.breadcrumbs.length > 1
            ? currentClipDetail.breadcrumbs[currentClipDetail.breadcrumbs.length - 2].id
            : null;
        navigateToClip(parentId);
      } else {
        loadClipsData();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete clip');
      loadClipsData();
    } finally {
      setSavingAction(false);
    }
  };

  const handleDeleteBookmarkInClip = async (id: number) => {
    // Optimistic instantaneous UI update
    if (currentClipDetail) {
      setCurrentClipDetail((prev) =>
        prev
          ? {
              ...prev,
              bookmarks: prev.bookmarks.filter((b) => b.id !== id),
              clip: {
                ...prev.clip,
                item_count: Math.max(0, (prev.clip.item_count || 1) - 1)
              }
            }
          : null
      );
    }
    try {
      await onDeleteBookmark(id);
    } catch (err: any) {
      setError(err.message || 'Failed to delete slip');
      loadClipsData();
    }
  };

  const handleRemoveBookmarkFromCurrentClip = async (bookmarkId: number) => {
    if (!currentClipId) return;
    // Optimistic instantaneous UI update
    if (currentClipDetail) {
      setCurrentClipDetail((prev) =>
        prev
          ? {
              ...prev,
              bookmarks: prev.bookmarks.filter((b) => b.id !== bookmarkId),
              clip: {
                ...prev.clip,
                item_count: Math.max(0, (prev.clip.item_count || 1) - 1)
              }
            }
          : null
      );
    }
    try {
      await removeBookmarkFromClip(currentClipId, bookmarkId);
      loadClipsData();
    } catch (err: any) {
      setError(err.message || 'Failed to remove slip from clip');
      loadClipsData();
    }
  };

  const handleRestoreSlip = async (id: number) => {
    const target = recycleSlips.find((b) => b.id === id);
    // Optimistic instantaneous UI update
    setRecycleSlips((prev) => prev.filter((b) => b.id !== id));
    if (onRecycleCountChangeRef.current) {
      onRecycleCountChangeRef.current(Math.max(0, recycleSlips.length + recycleClips.length - 1));
    }
    try {
      await restoreBookmark(id);
      loadClipsData();
    } catch (err: any) {
      if (target) {
        setRecycleSlips((prev) => [target, ...prev]);
      }
      setError(err.message || 'Failed to restore slip');
    }
  };

  const handlePermanentDeleteSlip = async (id: number) => {
    if (!window.confirm('Permanently delete this slip? This cannot be undone.')) return;
    const target = recycleSlips.find((b) => b.id === id);
    // Optimistic instantaneous UI update
    setRecycleSlips((prev) => prev.filter((b) => b.id !== id));
    if (onRecycleCountChangeRef.current) {
      onRecycleCountChangeRef.current(Math.max(0, recycleSlips.length + recycleClips.length - 1));
    }
    try {
      await permanentlyDeleteBookmark(id);
      loadClipsData();
    } catch (err: any) {
      if (target) {
        setRecycleSlips((prev) => [target, ...prev]);
      }
      setError(err.message || 'Failed to permanently delete slip');
    }
  };

  const handleRestoreClip = async (id: number) => {
    const target = recycleClips.find((c) => c.id === id);
    // Optimistic instantaneous UI update
    setRecycleClips((prev) => prev.filter((c) => c.id !== id));
    if (target && !target.parent_id) {
      setRootClips((prev) => [{ ...target, deleted_at: null }, ...prev.filter((c) => c.id !== id)]);
    }
    if (onRecycleCountChangeRef.current) {
      onRecycleCountChangeRef.current(Math.max(0, recycleSlips.length + recycleClips.length - 1));
    }
    try {
      await restoreClip(id);
      loadClipsData();
    } catch (err: any) {
      if (target) {
        setRecycleClips((prev) => [target, ...prev]);
      }
      setError(err.message || 'Failed to restore clip');
    }
  };

  const handlePermanentDeleteClip = async (id: number) => {
    if (!window.confirm('Permanently delete this clip? Any sub-clips will also be permanently deleted. This cannot be undone.')) return;
    const target = recycleClips.find((c) => c.id === id);
    // Optimistic instantaneous UI update
    setRecycleClips((prev) => prev.filter((c) => c.id !== id));
    if (onRecycleCountChangeRef.current) {
      onRecycleCountChangeRef.current(Math.max(0, recycleSlips.length + recycleClips.length - 1));
    }
    try {
      await permanentlyDeleteClip(id);
      loadClipsData();
    } catch (err: any) {
      if (target) {
        setRecycleClips((prev) => [target, ...prev]);
      }
      setError(err.message || 'Failed to permanently delete clip');
    }
  };

  const handleConfirmEmptyRecycleClip = async () => {
    const prevSlips = recycleSlips;
    const prevClips = recycleClips;

    // Optimistic instantaneous UI update
    setRecycleSlips([]);
    setRecycleClips([]);
    setIsEmptyConfirmOpen(false);
    if (onRecycleCountChangeRef.current) {
      onRecycleCountChangeRef.current(0);
    }

    setEmptyInProgress(true);
    try {
      await emptyRecycleClip();
      loadClipsData();
    } catch (err: any) {
      setRecycleSlips(prevSlips);
      setRecycleClips(prevClips);
      setError(err.message || 'Failed to empty Recycle Clip');
    } finally {
      setEmptyInProgress(false);
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
          {isViewingRecycleClip ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsViewingRecycleClip(false)}
              title="Back to Clips Deck"
            >
              <ArrowLeft size={14} />
              <span>All Clips</span>
            </button>
          ) : currentClipDetail ? (
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
                onClick={() => handleOpenDeleteClip(currentClipDetail.clip)}
                title="Delete this clip"
                style={{ color: 'var(--color-error)' }}
              >
                <Trash2 size={14} />
                <span className="btn-text-hide-mobile">Delete</span>
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus size={16} />
                <span>New Sub-Clip</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus size={16} />
              <span>New Clip</span>
            </button>
          )}
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
              className={`v-crumb-step ${currentClipId === null && !isViewingRecycleClip ? 'active' : 'clickable'}`}
              onClick={() => navigateToClip(null)}
            >
              <div className="v-crumb-dot-col">
                <div className={`v-crumb-dot ${currentClipId === null && !isViewingRecycleClip ? 'current' : ''}`} />
                {!isViewingRecycleClip && currentClipDetail && currentClipDetail.breadcrumbs.length > 0 && (
                  <div className="v-crumb-line" />
                )}
              </div>
              <div className="v-crumb-content">
                <span className="v-crumb-name">All Clips (Root)</span>
              </div>
            </div>

            {/* Ancestor and Current Steps */}
            {!isViewingRecycleClip &&
              currentClipDetail?.breadcrumbs.map((crumb, idx) => {
                const isLast = idx === currentClipDetail.breadcrumbs.length - 1;
                const hasNext = idx < currentClipDetail.breadcrumbs.length - 1;

                return (
                  <div
                    key={crumb.id}
                    className={`v-crumb-step ${isLast ? 'active' : 'clickable'}`}
                    onClick={() => !isLast && navigateToClip(crumb.id)}
                  >
                    <div className="v-crumb-dot-col">
                      <div className={`v-crumb-dot ${isLast ? 'current' : ''}`} />
                      {hasNext && <div className="v-crumb-line" />}
                    </div>
                    <div className="v-crumb-content">
                      <span className="v-crumb-name">{crumb.name}</span>
                      {isLast && <span className="v-crumb-active-badge">Active Clip</span>}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Dedicated System Utility Section at bottom of Spine */}
          <div className="spine-utility-section">
            <button
              type="button"
              className={`spine-utility-btn ${isViewingRecycleClip ? 'active' : ''}`}
              onClick={() => {
                setSelectedSlipIds(new Set());
                setSelectedClipIds(new Set());
                setCurrentClipId(null);
                setIsViewingRecycleClip(true);
              }}
              title="Recycle Clip"
            >
              <div className="spine-utility-icon-label">
                <Trash2 size={15} className="spine-utility-icon" />
                <span>Recycle Clip</span>
              </div>
              {recycleSlips.length + recycleClips.length > 0 && (
                <span className="spine-utility-badge">
                  {recycleSlips.length + recycleClips.length}
                </span>
              )}
            </button>
          </div>
        </aside>

        {/* Right Column: Clipped Deck & Stacks */}
        <main className="clips-main-deck">
          {error && (
            <div
              className="alert-error"
              style={{
                marginBottom: '16px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(228, 43, 12, 0.1)',
                color: 'var(--color-error)',
                fontSize: '13px'
              }}
            >
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
              {isViewingRecycleClip ? (
                /* Recycle Clip Dedicated Management View */
                <div>
                  <div
                    className="deck-section-header"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '20px',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <Trash2 size={20} style={{ color: '#ef4444' }} />
                        <span className="deck-section-title" style={{ fontSize: '18px' }}>
                          Recycle Clip
                        </span>
                        <span className="deck-count-pill" style={{ marginLeft: '6px' }}>
                          {recycleSlips.length + recycleClips.length}{' '}
                          {recycleSlips.length + recycleClips.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                      <span className="deck-section-hint">
                        Deleted clips and slips go here before vanishing from reality. Select items for bulk restore or permanent delete, or empty the bin.
                      </span>
                    </div>

                    {recycleSlips.length + recycleClips.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setIsEmptyConfirmOpen(true)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Trash2 size={14} style={{ color: '#ef4444' }} />
                        <span>Empty Recycle Clip</span>
                      </button>
                    )}
                  </div>

                  {/* Deleted Clips Section */}
                  {recycleClips.length > 0 && (
                    <div style={{ marginBottom: '28px' }}>
                      <div className="deck-section-header" style={{ marginBottom: '12px' }}>
                        <span className="deck-section-title" style={{ fontSize: '15px' }}>
                          Deleted Clips ({recycleClips.length})
                        </span>
                      </div>

                      <div className="deleted-clips-grid">
                        {recycleClips.map((clip) => {
                          const isSelected = selectedClipIds.has(clip.id);

                          return (
                            <div
                              key={clip.id}
                              className={`deleted-clip-card ${isSelected ? 'is-selected-clip' : ''}`}
                              onClick={() => toggleSelectClip(clip.id)}
                            >
                              <div className="deleted-clip-left">
                                <button
                                  type="button"
                                  className={`card-select-checkbox-btn deleted-clip-select-btn ${isSelected ? 'is-selected' : ''} ${isSelectionMode ? 'selection-mode' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSelectClip(clip.id);
                                  }}
                                  title={isSelected ? 'Deselect clip' : 'Select clip'}
                                  aria-label={isSelected ? 'Deselect clip' : 'Select clip'}
                                >
                                  <div className={`card-select-checkbox-indicator ${isSelected ? 'checked' : ''}`}>
                                    {isSelected ? (
                                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                    ) : null}
                                  </div>
                                </button>

                                <div className="deleted-clip-icon-wrap">
                                  <Paperclip size={16} style={{ color: 'var(--color-muted)' }} />
                                </div>
                                <div className="deleted-clip-info">
                                  <span className="deleted-clip-name">{clip.name}</span>
                                  <span className="deleted-clip-sub">
                                    {clip.item_count || 0} {clip.item_count === 1 ? 'slip' : 'slips'}
                                  </span>
                                </div>
                              </div>
                              <div className="deleted-clip-actions" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleRestoreClip(clip.id)}
                                  title="Restore Clip"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '12px' }}
                                >
                                  <RotateCcw size={12} />
                                  <span>Restore</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handlePermanentDeleteClip(clip.id)}
                                  title="Delete Permanently"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '12px' }}
                                >
                                  <Trash2 size={12} style={{ color: '#ef4444' }} />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Deleted Slips Section */}
                  {recycleSlips.length > 0 ? (
                    <div>
                      {recycleClips.length > 0 && (
                        <div className="deck-section-header" style={{ marginBottom: '12px' }}>
                          <span className="deck-section-title" style={{ fontSize: '15px' }}>
                            Deleted Slips ({recycleSlips.length})
                          </span>
                        </div>
                      )}
                      <MasonryGrid
                        bookmarks={recycleSlips}
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
                        isRecycleBin={true}
                        onRestore={handleRestoreSlip}
                        onPermanentDelete={handlePermanentDeleteSlip}
                        selectedSlipIds={selectedSlipIds}
                        isSelectionMode={isSelectionMode}
                        onToggleSelectSlip={toggleSelectSlip}
                      />
                    </div>
                  ) : recycleClips.length === 0 ? (
                    <div className="empty-state clip-empty-deck" style={{ padding: '60px 20px' }}>
                      <div className="clip-empty-icon-wrap" style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444' }}>
                        <Trash2 size={40} />
                      </div>
                      <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--color-secondary)' }}>
                        Recycle Clip is Empty
                      </h3>
                      <p style={{ maxWidth: '420px', margin: '0 auto 20px', fontSize: '14px', color: 'var(--color-muted)' }}>
                        No deleted slips or clips in the recycling bin. When you delete a slip or clip, it will wait here safely before vanishing.
                      </p>
                      <button className="btn btn-secondary" onClick={() => setIsViewingRecycleClip(false)}>
                        Return to Clips
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : currentClipId === null ? (
                /* Root View: All Top-Level Clips */
                <div>
                  {rootClips.length > 0 ? (
                    <div>
                      <div className="deck-section-header">
                        <span className="deck-section-title">Your Clips ({rootClips.length})</span>
                        <span className="deck-section-hint">Click a clip to open its stack of slips, or select multiple to delete in bulk</span>
                      </div>

                      <div className="clip-deck-grid">
                        {rootClips.map((clip) => {
                          const isSelected = selectedClipIds.has(clip.id);

                          return (
                            <div
                              key={clip.id}
                              className={`clip-deck-card ${isSelected ? 'is-selected-clip' : ''}`}
                              onClick={() => {
                                if (isSelectionMode) {
                                  toggleSelectClip(clip.id);
                                } else {
                                  navigateToClip(clip.id);
                                }
                              }}
                            >
                              <button
                                type="button"
                                className={`card-select-checkbox-btn ${isSelected ? 'is-selected' : ''} ${isSelectionMode ? 'selection-mode' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelectClip(clip.id);
                                }}
                                title={isSelected ? 'Deselect clip' : 'Select clip'}
                                aria-label={isSelected ? 'Deselect clip' : 'Select clip'}
                              >
                                <div className={`card-select-checkbox-indicator ${isSelected ? 'checked' : ''}`}>
                                  {isSelected ? (
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  ) : null}
                                </div>
                              </button>

                              {/* Top Paperclip Metallic Accent */}
                              <div className="deck-paperclip-pin">
                                <Paperclip size={18} />
                              </div>

                              <div className="deck-card-top" style={{ paddingLeft: '24px' }}>
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
                                    onClick={() => handleOpenDeleteClip(clip)}
                                    style={{ color: 'var(--color-error)' }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>

                              <h3 className="deck-card-title">{clip.name}</h3>

                              <div className="deck-card-footer">
                                <span className="deck-count-pill">
                                  📎 {clip.item_count || 0} {clip.item_count === 1 ? 'slip' : 'slips'}
                                </span>
                                {(clip.subclip_count || 0) > 0 && (
                                  <span className="deck-sub-pill">
                                    {clip.subclip_count} sub-{clip.subclip_count === 1 ? 'clip' : 'clips'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
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
                  )}

                  {/* Subtle, non-intrusive Recycle Clip footer link */}
                  {recycleSlips.length + recycleClips.length > 0 && (
                    <div className="clips-subtle-recycle-footer">
                      <button
                        type="button"
                        className="subtle-recycle-link"
                        onClick={() => {
                          setSelectedSlipIds(new Set());
                          setSelectedClipIds(new Set());
                          setCurrentClipId(null);
                          setIsViewingRecycleClip(true);
                        }}
                      >
                        <Trash2 size={13} />
                        <span>
                          Recycle Clip ({recycleSlips.length + recycleClips.length}{' '}
                          {recycleSlips.length + recycleClips.length === 1 ? 'item' : 'items'})
                        </span>
                      </button>
                    </div>
                  )}
                </div>
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
                        {currentClipDetail.subclips.map((sub) => {
                          const isSelected = selectedClipIds.has(sub.id);

                          return (
                            <div
                              key={sub.id}
                              className={`clip-deck-card sub-deck-card ${isSelected ? 'is-selected-clip' : ''}`}
                              onClick={() => {
                                if (isSelectionMode) {
                                  toggleSelectClip(sub.id);
                                } else {
                                  navigateToClip(sub.id);
                                }
                              }}
                            >
                              <button
                                type="button"
                                className={`card-select-checkbox-btn ${isSelected ? 'is-selected' : ''} ${isSelectionMode ? 'selection-mode' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelectClip(sub.id);
                                }}
                                title={isSelected ? 'Deselect clip' : 'Select clip'}
                                aria-label={isSelected ? 'Deselect clip' : 'Select clip'}
                              >
                                <div className={`card-select-checkbox-indicator ${isSelected ? 'checked' : ''}`}>
                                  {isSelected ? (
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  ) : null}
                                </div>
                              </button>

                              <div className="deck-paperclip-pin">
                                <Paperclip size={16} />
                              </div>

                              <div className="deck-card-top" style={{ paddingLeft: '24px' }}>
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
                                    onClick={() => handleOpenDeleteClip(sub)}
                                    style={{ color: 'var(--color-error)' }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>

                              <h3 className="deck-card-title">{sub.name}</h3>

                              <div className="deck-card-footer">
                                <span className="deck-count-pill">
                                  📎 {sub.item_count || 0} {sub.item_count === 1 ? 'slip' : 'slips'}
                                </span>
                                {(sub.subclip_count || 0) > 0 && (
                                  <span className="deck-sub-pill">
                                    {sub.subclip_count} sub-clips
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
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
                        onDelete={handleDeleteBookmarkInClip}
                        onTagClick={onTagClick}
                        onManageClips={onManageBookmarkClips}
                        onRemoveFromClip={handleRemoveBookmarkFromCurrentClip}
                        selectedSlipIds={selectedSlipIds}
                        isSelectionMode={isSelectionMode}
                        onToggleSelectSlip={toggleSelectSlip}
                      />
                    ) : (
                      <div className="empty-state clip-empty-deck" style={{ padding: '60px 20px' }}>
                        <div className="clip-empty-icon-wrap">
                          <Paperclip size={40} />
                        </div>
                        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--color-secondary)' }}>
                          No Slips in This Clip Yet
                        </h3>
                        <p style={{ maxWidth: '420px', margin: '0 auto 20px', fontSize: '14px', color: 'var(--color-muted)' }}>
                          Add slips into this clip from the main feed using the paperclip button on any card, or create sub-clips above.
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

      {/* Floating Bulk Action Bar */}
      {isSelectionMode && (
        <BulkActionBar
          selectedSlipCount={selectedSlipIds.size}
          selectedClipCount={selectedClipIds.size}
          totalSelectableCount={totalSelectableCount}
          context={currentContext}
          onSelectAll={handleSelectAll}
          onClearSelection={clearSelection}
          isAllSelected={isAllSelected}
          onExecuteBulkAction={handleExecuteBulkAction}
          isProcessing={bulkInProgress}
        />
      )}

      {/* Modal: Bulk Permanent Delete Confirmation */}
      {isBulkPermDeleteOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => !bulkInProgress && setIsBulkPermDeleteOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 size={18} style={{ color: '#ef4444' }} />
                <h2 className="modal-title">Delete Forever?</h2>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setIsBulkPermDeleteOpen(false)}
                disabled={bulkInProgress}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: '14px', color: 'var(--color-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
                Are you sure you want to permanently delete{' '}
                <strong>
                  {selectedSlipIds.size + selectedClipIds.size} selected item
                  {selectedSlipIds.size + selectedClipIds.size === 1 ? '' : 's'}
                </strong>
                ?
              </p>
              <p style={{ fontSize: '13px', color: 'var(--color-muted)', lineHeight: 1.4 }}>
                This action cannot be undone. These items will be permanently eradicated from the database.
              </p>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 24px', borderTop: '1px solid var(--color-border)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsBulkPermDeleteOpen(false)}
                disabled={bulkInProgress}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmBulkPermanentDelete}
                disabled={bulkInProgress}
                style={{ background: '#ef4444', borderColor: '#ef4444' }}
              >
                {bulkInProgress ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bulk Delete Clips Confirmation */}
      {isBulkDeleteClipsOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => !bulkInProgress && setIsBulkDeleteClipsOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 size={18} style={{ color: '#ef4444' }} />
                <h2 className="modal-title">Delete Selected Clips</h2>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setIsBulkDeleteClipsOpen(false)}
                disabled={bulkInProgress}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '14px', color: 'var(--color-on-surface)', margin: 0, lineHeight: 1.5 }}>
                Move{' '}
                <strong>
                  {selectedClipIds.size} clip{selectedClipIds.size === 1 ? '' : 's'}
                </strong>{' '}
                {selectedSlipIds.size > 0 && ` and ${selectedSlipIds.size} slip${selectedSlipIds.size === 1 ? '' : 's'}`} to Recycle Clip?
              </p>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13.5px', color: 'var(--color-secondary)', padding: '4px 0', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={bulkIncludeChildren}
                  onChange={(e) => setBulkIncludeChildren(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                />
                <span>Include all nested sub-clips and member slips</span>
              </label>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 24px', borderTop: '1px solid var(--color-border)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsBulkDeleteClipsOpen(false)}
                disabled={bulkInProgress}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmBulkDeleteClips}
                disabled={bulkInProgress}
                style={{ background: '#ef4444', borderColor: '#ef4444' }}
              >
                {bulkInProgress ? 'Deleting...' : 'Move to Recycle Clip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Single Clip Confirmation */}
      {deleteClipTarget && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => !savingAction && setDeleteClipTarget(null)}>
          <div className="modal-content" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 size={18} style={{ color: '#ef4444' }} />
                <h2 className="modal-title">Delete Clip</h2>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setDeleteClipTarget(null)}
                disabled={savingAction}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '14px', color: 'var(--color-on-surface)', margin: 0, lineHeight: 1.5 }}>
                Are you sure you want to delete <strong>"{deleteClipTarget.name}"</strong>?
              </p>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13.5px', color: 'var(--color-secondary)', padding: '4px 0', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={deleteIncludeChildren}
                  onChange={(e) => setDeleteIncludeChildren(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                />
                <span>Include all sub-clips and slips within</span>
              </label>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 24px', borderTop: '1px solid var(--color-border)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteClipTarget(null)}
                disabled={savingAction}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmDeleteClip}
                disabled={savingAction}
                style={{ background: '#ef4444', borderColor: '#ef4444' }}
              >
                {savingAction ? 'Deleting...' : 'Delete Clip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Safe Empty Recycle Clip Confirmation */}
      {isEmptyConfirmOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setIsEmptyConfirmOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 size={18} style={{ color: '#ef4444' }} />
                <h2 className="modal-title">Empty Recycle Clip?</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setIsEmptyConfirmOpen(false)} title="Close">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: '14px', color: 'var(--color-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
                Are you sure you want to permanently delete all <strong>{recycleSlips.length + recycleClips.length}</strong> item{(recycleSlips.length + recycleClips.length) === 1 ? '' : 's'} in the Recycle Clip?
              </p>
              <p style={{ fontSize: '13px', color: 'var(--color-muted)', lineHeight: 1.4 }}>
                This action cannot be undone. These slips and clips will vanish from reality forever.
              </p>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 24px', borderTop: '1px solid var(--color-border)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsEmptyConfirmOpen(false)} disabled={emptyInProgress}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmEmptyRecycleClip}
                disabled={emptyInProgress}
                style={{ background: '#ef4444', borderColor: '#ef4444' }}
              >
                {emptyInProgress ? 'Emptying...' : 'Empty Recycle Clip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Clip */}
      {isCreateOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setIsCreateOpen(false)}>
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
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setIsRenameOpen(false)}>
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

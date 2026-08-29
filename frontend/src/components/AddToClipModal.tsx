import React, { useState, useEffect, useMemo } from 'react';
import { Bookmark, Clip } from '../types';
import { fetchClips, fetchBookmarkClips, setBookmarkClip, bulkSetClip, createClip } from '../api';
import {
  X,
  Paperclip,
  ChevronRight,
  ChevronDown,
  Plus,
  Loader2,
  Search,
  Check,
  FolderMinus
} from 'lucide-react';

interface AddToClipModalProps {
  bookmark?: Bookmark | null;
  slips?: Bookmark[] | null;
  slipIds?: number[] | null;
  onClose: () => void;
  onSuccess?: () => void;
}

interface TreeNode {
  clip: Clip;
  children: TreeNode[];
}

export const AddToClipModal: React.FC<AddToClipModalProps> = ({
  bookmark,
  slips,
  slipIds,
  onClose,
  onSuccess
}) => {
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<number | null>(null);
  const [initialClipId, setInitialClipId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tree UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Inline creation states
  const [creatingForParentId, setCreatingForParentId] = useState<number | null | 'root'>(null);
  const [inlineClipName, setInlineClipName] = useState('');
  const [creatingClip, setCreatingClip] = useState(false);

  const targetSlips = useMemo<Bookmark[]>(() => {
    if (slips && slips.length > 0) return slips;
    if (bookmark) return [bookmark];
    return [];
  }, [bookmark, slips]);

  const targetIds = useMemo<number[]>(() => {
    if (slipIds && slipIds.length > 0) return slipIds;
    return targetSlips.map((s) => s.id);
  }, [slipIds, targetSlips]);

  const isBulk = targetIds.length > 1;
  const isSingle = targetIds.length === 1;

  useEffect(() => {
    if (targetIds.length === 0) return;

    setLoading(true);
    setError(null);
    setCreatingForParentId(null);
    setInlineClipName('');

    const fetchPromises: [Promise<Clip[]>, Promise<Clip[]>] = [
      fetchClips(),
      isSingle ? fetchBookmarkClips(targetIds[0]) : Promise.resolve([])
    ];

    Promise.all(fetchPromises)
      .then(([allClips, assignedClips]) => {
        setClips(allClips);
        const currentId = isSingle && assignedClips.length > 0 ? assignedClips[0].id : null;
        setSelectedClipId(currentId);
        setInitialClipId(isSingle ? currentId : null);

        // Expand path to currently selected clip & all top-level clips by default
        const toExpand = new Set<number>();
        allClips.forEach((c) => {
          if (!c.parent_id) toExpand.add(c.id);
        });

        if (currentId) {
          let curr = allClips.find((c) => c.id === currentId);
          while (curr && curr.parent_id) {
            toExpand.add(curr.parent_id);
            curr = allClips.find((c) => c.id === curr!.parent_id);
          }
        }
        setExpandedIds(toExpand);
      })
      .catch((err: any) => {
        setError(err.message || 'Failed to load clips');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [targetIds.join(',')]);

  // Build tree from flat list
  const tree = useMemo(() => {
    const map = new Map<number, TreeNode>();
    const roots: TreeNode[] = [];

    clips.forEach((c) => {
      map.set(c.id, { clip: c, children: [] });
    });

    clips.forEach((c) => {
      const node = map.get(c.id)!;
      if (c.parent_id && map.has(c.parent_id)) {
        map.get(c.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [clips]);

  // Filter tree based on search query
  const matchesSearch = (node: TreeNode, query: string): boolean => {
    if (!query) return true;
    const cleanQ = query.toLowerCase();
    if (node.clip.name.toLowerCase().includes(cleanQ)) return true;
    return node.children.some((child) => matchesSearch(child, query));
  };

  const toggleExpand = (clipId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (targetIds.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      if (isSingle) {
        await setBookmarkClip(targetIds[0], selectedClipId);
      } else {
        await bulkSetClip(targetIds, selectedClipId);
      }
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update clip assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateInline = async (parentId: number | null) => {
    if (!inlineClipName.trim()) return;

    setCreatingClip(true);
    setError(null);
    try {
      const created = await createClip(inlineClipName.trim(), parentId);
      setClips((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedClipId(created.id);
      if (parentId) {
        setExpandedIds((prev) => new Set([...prev, parentId]));
      }
      setInlineClipName('');
      setCreatingForParentId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to create clip');
    } finally {
      setCreatingClip(false);
    }
  };

  // Get full trail of selected clip: e.g. "Hobbies ➔ 3d-printing-clip"
  const getSelectedPathLabel = (): string => {
    if (!selectedClipId) return 'Unclipped (No Clip)';
    const parts: string[] = [];
    let currId: number | null = selectedClipId;
    const visited = new Set<number>();

    while (currId && !visited.has(currId)) {
      visited.add(currId);
      const curr = clips.find((c) => c.id === currId);
      if (curr) {
        parts.unshift(curr.name);
        currId = curr.parent_id;
      } else {
        break;
      }
    }

    return parts.join(' ➔ ');
  };

  if (targetIds.length === 0) return null;

  // Recursive tree node renderer with in-place nested sub-clip creation
  const renderTreeNode = (node: TreeNode, depth = 0) => {
    if (searchQuery && !matchesSearch(node, searchQuery)) {
      return null;
    }

    const isSelected = selectedClipId === node.clip.id;
    const isExpanded = expandedIds.has(node.clip.id) || Boolean(searchQuery);
    const hasChildren = node.children.length > 0;
    const isAddingChild = creatingForParentId === node.clip.id;

    return (
      <div key={node.clip.id} className="tree-node-wrapper">
        <div
          className={`tree-node-row ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${depth * 22 + 12}px` }}
          onClick={() => setSelectedClipId(node.clip.id)}
        >
          {/* Expand/Collapse Chevron */}
          <div
            className="tree-chevron-btn"
            onClick={(e) => hasChildren && toggleExpand(node.clip.id, e)}
            style={{ opacity: hasChildren ? 1 : 0, cursor: hasChildren ? 'pointer' : 'default' }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>

          {/* Paperclip Icon */}
          <div className="tree-clip-icon-wrapper">
            <Paperclip size={14} className="tree-clip-icon" />
          </div>

          {/* Clip Name */}
          <span className="tree-clip-name">
            {node.clip.name}
          </span>

          {/* Slips badge */}
          <span className="tree-clip-count">
            {node.clip.item_count || 0}
          </span>

          {/* Action buttons (hover) */}
          <div className="tree-node-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="tree-add-child-btn"
              title={`Create sub-clip under "${node.clip.name}"`}
              onClick={() => {
                setCreatingForParentId(node.clip.id);
                setInlineClipName('');
                setExpandedIds((prev) => new Set([...prev, node.clip.id]));
              }}
            >
              <Plus size={13} />
              <span>Sub-clip</span>
            </button>
          </div>

          {/* Radio checkmark */}
          <div className={`tree-radio ${isSelected ? 'checked' : ''}`}>
            {isSelected && <Check size={12} />}
          </div>
        </div>

        {/* Inline child creator nested right under this node */}
        {isAddingChild && (
          <div
            className="tree-inline-create-box"
            style={{ paddingLeft: `${(depth + 1) * 22 + 12}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tree-inline-input-row">
              <input
                type="text"
                className="form-input tree-inline-input"
                placeholder={`New sub-clip inside "${node.clip.name}"...`}
                value={inlineClipName}
                onChange={(e) => setInlineClipName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateInline(node.clip.id);
                  } else if (e.key === 'Escape') {
                    setCreatingForParentId(null);
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleCreateInline(node.clip.id)}
                disabled={creatingClip || !inlineClipName.trim()}
              >
                {creatingClip ? '...' : 'Add'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCreatingForParentId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Render child nodes */}
        {isExpanded && node.children.map((child) => renderTreeNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content clip-modal-content-tree" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="clip-modal-title-row">
            <div className="clip-title-badge">
              <Paperclip size={18} />
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: '17px', fontWeight: 600 }}>
                Organize in Clip
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '2px' }}>
                Each card belongs to exactly one clip at a time.
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Target Slip Card Banner */}
        <div className="clip-target-card-banner">
          <span className="clip-target-label">{isBulk ? 'Target Slips:' : 'Target Slip:'}</span>
          <span className="clip-target-title" title={isBulk ? `${targetIds.length} slips selected` : (targetSlips[0]?.title || targetSlips[0]?.url || `Slip #${targetIds[0]}`)}>
            {isBulk ? `${targetIds.length} slips selected` : (targetSlips[0]?.title || targetSlips[0]?.url || `Slip #${targetIds[0]}`)}
          </span>
        </div>

        {/* Search & Filter Bar */}
        <div className="clip-tree-search-bar">
          <Search size={14} className="clip-tree-search-icon" />
          <input
            type="text"
            className="clip-tree-search-input"
            placeholder="Search or filter clips..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              style={{ position: 'static' }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {error && (
          <div className="alert-error" style={{ margin: '0 20px 12px', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', background: 'rgba(228, 43, 12, 0.1)', color: 'var(--color-error)' }}>
            {error}
          </div>
        )}

        {/* Tree Container Body */}
        <div className="clip-tree-scroll-area">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-muted)' }}>
              <Loader2 size={24} className="spin-animation" style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: '13px' }}>Loading clip hierarchy...</p>
            </div>
          ) : (
            <>
              {/* Option: Unclipped (Remove from clips) */}
              <div
                className={`tree-node-row tree-unclip-row ${selectedClipId === null ? 'selected' : ''}`}
                onClick={() => setSelectedClipId(null)}
              >
                <div style={{ width: '16px' }} />
                <div className="tree-clip-icon-wrapper unclip-icon">
                  <FolderMinus size={14} />
                </div>
                <span className="tree-clip-name" style={{ fontStyle: 'italic', color: selectedClipId === null ? 'var(--color-primary)' : 'var(--color-muted)' }}>
                  None (Unclipped / Main Stream only)
                </span>
                <div className={`tree-radio ${selectedClipId === null ? 'checked' : ''}`}>
                  {selectedClipId === null && <Check size={12} />}
                </div>
              </div>

              <div className="tree-divider" />

              {/* Tree Nodes */}
              {tree.length > 0 ? (
                <div className="tree-root-nodes">
                  {tree.map((rootNode) => renderTreeNode(rootNode, 0))}
                </div>
              ) : (
                <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--color-muted)' }}>
                  <Paperclip size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <p style={{ fontSize: '13px' }}>No clips created yet.</p>
                </div>
              )}

              {/* Inline Root Clip Creator */}
              {creatingForParentId === 'root' ? (
                <div className="tree-inline-create-box" style={{ margin: '12px 14px 6px' }}>
                  <div className="tree-inline-input-row">
                    <input
                      type="text"
                      className="form-input tree-inline-input"
                      placeholder="New top-level clip name..."
                      value={inlineClipName}
                      onChange={(e) => setInlineClipName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateInline(null);
                        } else if (e.key === 'Escape') {
                          setCreatingForParentId(null);
                        }
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleCreateInline(null)}
                      disabled={creatingClip || !inlineClipName.trim()}
                    >
                      {creatingClip ? '...' : 'Add'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setCreatingForParentId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '10px 14px' }}>
                  <button
                    type="button"
                    className="btn-create-root-clip"
                    onClick={() => {
                      setCreatingForParentId('root');
                      setInlineClipName('');
                    }}
                  >
                    <Plus size={14} />
                    <span>Create New Top-Level Clip</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer with Live Destination Trail */}
        <div className="clip-modal-footer-tree">
          <div className="clip-destination-preview">
            <span className="clip-dest-label">Target Clip:</span>
            <span className="clip-dest-path">
              {getSelectedPathLabel()}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || loading || (isSingle && selectedClipId === initialClipId)}
            >
              {saving ? 'Applying...' : selectedClipId === null ? (isBulk ? 'Unclip All' : 'Unclip') : (isBulk ? `Save to Clip (${targetIds.length})` : 'Save to Clip')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Bookmark, ContentType, GroupBy, SortBy, SortOrder } from '../types';
import { BookmarkCard } from './BookmarkCard';
import { groupBookmarksByType } from '../utils/feedUtils';
import {
  FileText,
  Image as ImageIcon,
  ShoppingBag,
  Video,
  Globe,
  StickyNote,
  FileCode2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  article: <FileText size={15} />,
  note: <StickyNote size={15} />,
  document: <FileCode2 size={15} />,
  image: <ImageIcon size={15} />,
  product: <ShoppingBag size={15} />,
  video: <Video size={15} />,
  website: <Globe size={15} />
};

interface MasonryGridProps {
  bookmarks: Bookmark[];
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
  isRecycleBin?: boolean;
  onRestore?: (id: number) => void;
  onPermanentDelete?: (id: number) => void;
  selectedSlipIds?: Set<number>;
  isSelectionMode?: boolean;
  onToggleSelectSlip?: (id: number) => void;
  groupBy?: GroupBy;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
}

export const MasonryGrid: React.FC<MasonryGridProps> = ({
  bookmarks,
  onOpenReader,
  onShare,
  onEdit,
  onRescrape,
  onAutoTag,
  onTogglePin,
  isAIConnected,
  onDelete,
  onTagClick,
  onManageClips,
  onRemoveFromClip,
  isRecycleBin = false,
  onRestore,
  onPermanentDelete,
  selectedSlipIds,
  isSelectionMode = false,
  onToggleSelectSlip,
  groupBy = 'none',
  sortBy = 'created_at',
  sortOrder = 'desc'
}) => {
  const [columnCount, setColumnCount] = useState(2);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width < 960) {
        setColumnCount(2); // Mobile & Tablet: 2 cards in a row
      } else if (width < 1360) {
        setColumnCount(3); // Desktop: 3 cards
      } else {
        setColumnCount(4); // Wide Desktop: 4 cards
      }
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  const toggleGroupCollapse = (typeKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(typeKey)) {
        next.delete(typeKey);
      } else {
        next.add(typeKey);
      }
      return next;
    });
  };

  const renderMasonryStream = (items: Bookmark[]) => {
    const columns: Bookmark[][] = Array.from({ length: columnCount }, () => []);
    items.forEach((b, index) => {
      columns[index % columnCount].push(b);
    });

    return (
      <div className="stable-masonry-container">
        {columns.map((colBookmarks, colIdx) => (
          <div key={colIdx} className="masonry-stream-col">
            {colBookmarks.map((bookmark) => (
              <BookmarkCard
                key={bookmark.id}
                bookmark={bookmark}
                onOpenReader={onOpenReader}
                onShare={onShare}
                onEdit={onEdit}
                onRescrape={onRescrape}
                onAutoTag={onAutoTag}
                onTogglePin={onTogglePin}
                isAIConnected={isAIConnected}
                onDelete={onDelete}
                onTagClick={onTagClick}
                onManageClips={onManageClips}
                onRemoveFromClip={onRemoveFromClip}
                isRecycleBin={isRecycleBin}
                onRestore={onRestore}
                onPermanentDelete={onPermanentDelete}
                isSelected={selectedSlipIds?.has(bookmark.id)}
                isSelectionMode={isSelectionMode}
                onToggleSelect={onToggleSelectSlip}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  if (groupBy === 'type') {
    const groups = groupBookmarksByType(bookmarks, sortBy, sortOrder);

    return (
      <div className="feed-groups-container">
        {groups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.type);
          return (
            <section key={group.type} className="feed-group-section" aria-labelledby={`group-header-${group.type}`}>
              <button
                type="button"
                id={`group-header-${group.type}`}
                className={`feed-group-header ${isCollapsed ? 'is-collapsed' : ''}`}
                onClick={() => toggleGroupCollapse(group.type)}
                aria-expanded={!isCollapsed}
                data-testid={`group-header-${group.type}`}
              >
                <div className="feed-group-header-left">
                  <span className="feed-group-chevron">
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </span>
                  <span className="feed-group-icon">
                    {TYPE_ICONS[group.type] || <Globe size={15} />}
                  </span>
                  <span className="feed-group-title">{group.label}</span>
                  <span className="feed-group-count">{group.bookmarks.length}</span>
                </div>
                <div className="feed-group-header-right">
                  <span className="feed-group-toggle-hint">
                    {isCollapsed ? 'Expand' : 'Collapse'}
                  </span>
                </div>
              </button>

              {!isCollapsed && (
                <div className="feed-group-content">
                  {renderMasonryStream(group.bookmarks)}
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  // Flat Masonry Grid
  return renderMasonryStream(bookmarks);
};

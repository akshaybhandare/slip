import React, { useState, useEffect } from 'react';
import { Bookmark } from '../types';
import { BookmarkCard } from './BookmarkCard';

interface MasonryGridProps {
  bookmarks: Bookmark[];
  onOpenReader: (bookmark: Bookmark) => void;
  onShare: (bookmark: Bookmark) => void;
  onEdit: (bookmark: Bookmark) => void;
  onRescrape: (id: number) => Promise<void>;
  onAutoTag?: (id: number) => Promise<void>;
  isAIConnected?: boolean;
  onDelete: (id: number) => void;
  onTagClick: (tagName: string) => void;
}

export const MasonryGrid: React.FC<MasonryGridProps> = ({
  bookmarks,
  onOpenReader,
  onShare,
  onEdit,
  onRescrape,
  onAutoTag,
  isAIConnected,
  onDelete,
  onTagClick
}) => {
  const [columnCount, setColumnCount] = useState(2);

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

  // Partition bookmarks into independent column streams
  const columns: Bookmark[][] = Array.from({ length: columnCount }, () => []);
  bookmarks.forEach((b, index) => {
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
              isAIConnected={isAIConnected}
              onDelete={onDelete}
              onTagClick={onTagClick}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

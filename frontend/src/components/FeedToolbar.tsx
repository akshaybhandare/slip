import React from 'react';
import { ArrowUpDown, Layers } from 'lucide-react';
import { SortBy, SortOrder, GroupBy } from '../types';

export interface FeedToolbarProps {
  sortBy: SortBy;
  sortOrder: SortOrder;
  groupBy: GroupBy;
  onSortChange: (sortBy: SortBy, sortOrder: SortOrder) => void;
  onGroupByChange: (groupBy: GroupBy) => void;
  totalCount: number;
}

export const FeedToolbar: React.FC<FeedToolbarProps> = ({
  sortBy,
  sortOrder,
  groupBy,
  onSortChange,
  onGroupByChange,
  totalCount
}) => {
  const currentSortValue = `${sortBy}:${sortOrder}`;

  const handleSortSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [newSortBy, newOrder] = e.target.value.split(':') as [SortBy, SortOrder];
    onSortChange(newSortBy, newOrder);
  };

  const handleGroupSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onGroupByChange(e.target.value as GroupBy);
  };

  return (
    <div className="feed-toolbar" data-testid="feed-toolbar">
      <div className="feed-toolbar-count">
        <span>{totalCount} {totalCount === 1 ? 'slip' : 'slips'}</span>
      </div>

      <div className="feed-toolbar-controls">
        {/* Group By Selector */}
        <div className="feed-control-group" title="Group slips by type">
          <Layers size={13} className="feed-control-icon" />
          <select
            className="feed-control-select"
            value={groupBy}
            onChange={handleGroupSelect}
            aria-label="Group slips"
            data-testid="feed-group-select"
          >
            <option value="none">No Grouping</option>
            <option value="type">Group by Type</option>
          </select>
        </div>

        {/* Sort By Selector */}
        <div className="feed-control-group" title="Sort slips">
          <ArrowUpDown size={13} className="feed-control-icon" />
          <select
            className="feed-control-select"
            value={currentSortValue}
            onChange={handleSortSelect}
            aria-label="Sort slips"
            data-testid="feed-sort-select"
          >
            <option value="created_at:desc">Newest First</option>
            <option value="created_at:asc">Oldest First</option>
            <option value="title:asc">Title (A to Z)</option>
            <option value="title:desc">Title (Z to A)</option>
            <option value="updated_at:desc">Recently Updated</option>
          </select>
        </div>
      </div>
    </div>
  );
};

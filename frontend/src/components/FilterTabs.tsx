import React from 'react';
import { Layers, FileText, Image as ImageIcon, ShoppingBag, Video, Globe, Tag as TagIcon, X } from 'lucide-react';
import { ContentType, Tag } from '../types';

interface FilterTabsProps {
  activeType: ContentType;
  onTypeChange: (type: ContentType) => void;
  tags: Tag[];
  selectedTag: string | null;
  onTagSelect: (tagName: string | null) => void;
}

const CATEGORIES: { type: ContentType; label: string; icon: React.ReactNode }[] = [
  { type: 'all', label: 'All', icon: <Layers size={14} /> },
  { type: 'article', label: 'Articles', icon: <FileText size={14} /> },
  { type: 'image', label: 'Images', icon: <ImageIcon size={14} /> },
  { type: 'product', label: 'Products', icon: <ShoppingBag size={14} /> },
  { type: 'video', label: 'Videos', icon: <Video size={14} /> },
  { type: 'website', label: 'Websites', icon: <Globe size={14} /> }
];

export const FilterTabs: React.FC<FilterTabsProps> = ({
  activeType,
  onTypeChange,
  tags,
  selectedTag,
  onTagSelect
}) => {
  return (
    <div className="filter-tabs-container">
      <div className="filter-tabs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.type}
            className={`filter-tab ${activeType === cat.type && !selectedTag ? 'active' : ''}`}
            onClick={() => {
              onTagSelect(null);
              onTypeChange(cat.type);
            }}
          >
            {cat.icon}
            <span>{cat.label}</span>
          </button>
        ))}

        {selectedTag && (
          <button className="filter-tab active" onClick={() => onTagSelect(null)} style={{ background: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}>
            <TagIcon size={14} />
            <span>#{selectedTag}</span>
            <X size={12} style={{ marginLeft: '4px' }} />
          </button>
        )}
      </div>

      {tags.length > 0 && (
        <div className="tags-pills-row">
          {tags.slice(0, 30).map((t) => (
            <span
              key={t.id || t.name}
              className="tag-pill"
              style={{
                background: selectedTag === t.name ? 'var(--color-primary)' : undefined,
                color: selectedTag === t.name ? 'var(--color-primary-contrast)' : undefined,
                borderColor: selectedTag === t.name ? 'var(--color-primary)' : undefined
              }}
              onClick={() => onTagSelect(selectedTag === t.name ? null : t.name)}
            >
              #{t.name} {t.count ? `(${t.count})` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

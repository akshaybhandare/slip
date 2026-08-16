import React, { useState } from 'react';
import { X, Plus, Tag as TagIcon } from 'lucide-react';
import { Tag } from '../types';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  availableTags: Tag[];
}

export const TagInput: React.FC<TagInputProps> = ({ tags, onChange, availableTags }) => {
  const [inputValue, setInputValue] = useState('');

  const addTag = (tagName: string) => {
    const clean = tagName.trim().replace(/^#/, '').toLowerCase();
    if (clean && !tags.includes(clean)) {
      onChange([...tags, clean]);
    }
    setInputValue('');
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  // Filter unused available tags that match current input (or top available tags)
  const unselectedAvailable = availableTags.filter((t) => !tags.includes(t.name.toLowerCase()));
  const filteredSuggestions = inputValue.trim()
    ? unselectedAvailable.filter((t) => t.name.toLowerCase().includes(inputValue.toLowerCase().trim()))
    : unselectedAvailable.slice(0, 12);

  return (
    <div className="tag-input-container">
      <div className="tag-input-box">
        <TagIcon size={15} style={{ color: 'var(--color-muted)', flexShrink: 0, marginLeft: '4px' }} />
        <div className="tag-pills-wrap">
          {tags.map((t) => (
            <span key={t} className="active-tag-chip">
              #{t}
              <button
                type="button"
                className="chip-remove-btn"
                onClick={() => removeTag(t)}
                aria-label={`Remove tag ${t}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            type="text"
            className="tag-inline-input"
            placeholder={tags.length === 0 ? 'Type tag & press Enter...' : 'Add more...'}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (inputValue.trim()) addTag(inputValue);
            }}
          />
        </div>
      </div>

      {filteredSuggestions.length > 0 && (
        <div className="suggested-tags-section">
          <span className="suggested-label">Saved Tags:</span>
          <div className="suggested-pills-list">
            {filteredSuggestions.map((st) => (
              <button
                key={st.id || st.name}
                type="button"
                className="suggested-tag-btn"
                onClick={() => addTag(st.name)}
              >
                <Plus size={11} />
                <span>#{st.name}</span>
                {st.count !== undefined && <span className="tag-count-badge">{st.count}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { Bookmark as BookmarkIcon, Search, Plus, X, Settings as SettingsIcon, MoreVertical, Sparkles, CornerDownLeft, Paperclip, Trash2, RefreshCw } from 'lucide-react';
import { User } from '../types';
import { ThemeMode } from '../hooks/useTheme';

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit?: () => void;
  isSearching?: boolean;
  isSmartSearch?: boolean;
  onToggleSmartSearch?: () => void;
  onAddClick: () => void;
  onOpenSettings?: () => void;
  onOpenThemeModal?: () => void; // Keep for backward compatibility
  isClipsView?: boolean;
  onToggleClipsView?: () => void;
  onOpenRecycleClip?: () => void;
  recycleCount?: number;
  isRecycleClipActive?: boolean;
  // Retained optional props for compatibility
  onImportClick?: () => void;
  onRescrapeAllClick?: () => void;
  isRescrapingAll?: boolean;
  onLogoutClick?: () => void;
  onAIClick?: () => void;
  isAIConnected?: boolean;
  aiProviderName?: string;
  user?: User | null;
  themeMode?: ThemeMode;
  onManageAccountClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  isSearching = false,
  isSmartSearch = false,
  onToggleSmartSearch,
  onAddClick,
  onOpenSettings,
  onOpenThemeModal,
  isClipsView = false,
  onToggleClipsView,
  onOpenRecycleClip,
  recycleCount = 0,
  isRecycleClipActive = false,
  isAIConnected = false
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSettingsClick = () => {
    if (onOpenSettings) {
      onOpenSettings();
    } else if (onOpenThemeModal) {
      onOpenThemeModal();
    }
  };

  return (
    <header className="top-nav">
      {/* 1. Left: Brand */}
      <div className="brand-section">
        <div className="brand-logo">
          <BookmarkIcon size={20} />
        </div>
        <span className="brand-name">Slip</span>
      </div>

      {/* 2. Center: Search Bar */}
      <div className={`search-wrapper ${isAIConnected && isSmartSearch ? 'smart-search-mode' : ''}`}>
        <Search
          className={`search-icon ${isAIConnected && isSmartSearch && searchQuery ? 'search-icon-clickable' : ''}`}
          size={17}
          onClick={() => {
            if (isAIConnected && isSmartSearch && onSearchSubmit) {
              onSearchSubmit();
            }
          }}
        />
        <input
          type="text"
          className="search-input"
          placeholder={
            isAIConnected && isSmartSearch
              ? "Describe what you're looking for (press Enter to search)..."
              : "Search your archive & tags..."
          }
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSearchSubmit?.();
            }
          }}
        />
        {searchQuery && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => onSearchChange('')}
            title="Clear search"
          >
            <X size={14} />
          </button>
        )}
        {isAIConnected && isSmartSearch && searchQuery.trim() && onSearchSubmit && (
          <button
            type="button"
            className={`search-enter-btn ${isSearching ? 'loading' : ''}`}
            onClick={() => !isSearching && onSearchSubmit()}
            disabled={isSearching}
            title={isSearching ? 'Searching...' : 'Search with AI (Press Enter)'}
            aria-label="Search with AI"
          >
            {isSearching ? (
              <RefreshCw size={12} className="spin-slow" />
            ) : (
              <CornerDownLeft size={12} />
            )}
            <span className="search-enter-text">{isSearching ? 'Thinking...' : 'Search'}</span>
          </button>
        )}
        {isAIConnected && onToggleSmartSearch && (
          <button
            type="button"
            className={`search-smart-btn ${isSmartSearch ? 'active' : ''}`}
            onClick={onToggleSmartSearch}
            title={
              isSmartSearch
                ? "Smart Search (AI Semantic Matching) is ON — Click for standard search"
                : "Smart Search (AI Semantic Matching) is OFF — Click to enable"
            }
            aria-label="Toggle Smart Search"
          >
            <Sparkles size={14} className={isSmartSearch ? 'sparkle-spin' : ''} />
            <span className="smart-btn-text">Smart</span>
          </button>
        )}
      </div>

      {/* 3. Right: Primary Actions & Settings */}
      <div className="nav-actions">
        {/* Save Link Button */}
        <button className="btn btn-primary nav-btn-save" onClick={onAddClick} title="Save Link">
          <Plus size={16} />
          <span className="btn-text-hide-mobile">Save</span>
        </button>

        {/* Desktop-Only Action Group */}
        <div className="nav-desktop-actions">
          {/* Clips View Toggle */}
          {onToggleClipsView && (
            <button
              className={`btn btn-secondary nav-clips-toggle-btn ${isClipsView && !isRecycleClipActive ? 'active-clips-btn' : ''}`}
              onClick={onToggleClipsView}
              title={isClipsView ? 'Return to Main Stream' : 'Browse Clips (Folders)'}
              aria-label="Clips & Folders"
            >
              <Paperclip size={15} className="nav-paperclip-icon" />
              <span className="btn-text-hide-mobile">{isClipsView ? 'Main Stream' : 'Clips'}</span>
            </button>
          )}

          {/* Recycle Clip Quick Access */}
          {onOpenRecycleClip && (
            <button
              className={`btn btn-secondary nav-recycle-btn ${isRecycleClipActive ? 'active-recycle-btn' : ''}`}
              onClick={onOpenRecycleClip}
              title={recycleCount > 0 ? `Recycle Clip (${recycleCount} deleted ${recycleCount === 1 ? 'slip' : 'slips'})` : 'Recycle Clip'}
              aria-label="Recycle Clip"
            >
              <Trash2 size={15} className="nav-recycle-icon" />
              {recycleCount > 0 && (
                <span className="nav-badge-dot" />
              )}
            </button>
          )}

          {/* Settings Trigger */}
          <button
            className="btn btn-secondary nav-settings-btn"
            onClick={handleSettingsClick}
            title="Settings (Appearance, AI, Keys & Data)"
            aria-label="Settings"
          >
            <SettingsIcon size={16} />
          </button>
        </div>

        {/* Mobile Overflow Menu Button */}
        <div className="nav-mobile-menu-container" ref={menuRef}>
          <button
            className="btn btn-secondary nav-more-btn"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            title="More actions"
            aria-label="Open menu"
          >
            <MoreVertical size={16} />
          </button>

          {isMenuOpen && (
            <div className="nav-dropdown-menu">
              {onToggleClipsView && (
                <button
                  className="nav-dropdown-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onToggleClipsView();
                  }}
                >
                  <Paperclip size={15} style={isClipsView && !isRecycleClipActive ? { color: 'var(--color-primary)' } : undefined} />
                  <span>{isClipsView ? 'Main Stream' : 'Clips (Folders)'}</span>
                </button>
              )}
              {onOpenRecycleClip && (
                <button
                  className="nav-dropdown-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenRecycleClip();
                  }}
                >
                  <Trash2 size={15} style={isRecycleClipActive ? { color: '#ef4444' } : undefined} />
                  <span>Recycle Clip {recycleCount > 0 ? `(${recycleCount})` : ''}</span>
                </button>
              )}
              <button
                className="nav-dropdown-item"
                onClick={() => {
                  setIsMenuOpen(false);
                  handleSettingsClick();
                }}
              >
                <SettingsIcon size={15} />
                <span>Settings</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

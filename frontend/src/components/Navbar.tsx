import React, { useState, useEffect, useRef } from 'react';
import { Bookmark as BookmarkIcon, Search, Plus, Upload, Download, LogOut, RefreshCw, X, Sun, Moon, Monitor, MoreVertical, UserPlus, Sparkles, CornerDownLeft, Paperclip, Trash2, Key, Palette, ArrowDownUp } from 'lucide-react';
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
  onImportClick: () => void;
  onRescrapeAllClick: () => void;
  isRescrapingAll: boolean;
  onLogoutClick: () => void;
  onAIClick?: () => void;
  isAIConnected?: boolean;
  aiProviderName?: string;
  user: User | null;
  themeMode?: ThemeMode;
  onOpenThemeModal?: () => void;
  isClipsView?: boolean;
  onToggleClipsView?: () => void;
  onOpenRecycleClip?: () => void;
  recycleCount?: number;
  isRecycleClipActive?: boolean;
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
  onImportClick,
  onRescrapeAllClick,
  isRescrapingAll,
  onLogoutClick,
  onAIClick,
  isAIConnected = false,
  aiProviderName,
  user,
  themeMode = 'system',
  onOpenThemeModal,
  isClipsView = false,
  onToggleClipsView,
  onOpenRecycleClip,
  recycleCount = 0,
  isRecycleClipActive = false,
  onManageAccountClick
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isDataMenuOpen, setIsDataMenuOpen] = useState(false);
  const dataMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (dataMenuRef.current && !dataMenuRef.current.contains(event.target as Node)) {
        setIsDataMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getThemeIcon = () => {
    if (themeMode === 'light') return <Sun size={15} />;
    if (themeMode === 'dark') return <Moon size={15} />;
    return <Monitor size={15} />;
  };

  return (
    <header className="top-nav">
      <div className="nav-header-row">
        <div className="brand-section">
          <div className="brand-logo">
            <BookmarkIcon size={20} />
          </div>
          <span className="brand-name">Slip</span>
        </div>

        <div className="nav-actions">
          {/* Primary Save Button */}
          <button className="btn btn-primary nav-btn-save" onClick={onAddClick} title="Save Link">
            <Plus size={16} />
            <span className="btn-text-hide-mobile">Save</span>
          </button>

          {/* Single Unified Theme & Appearance Button */}
          {onOpenThemeModal && (
            <button
              className="btn btn-secondary theme-toggle-btn"
              onClick={onOpenThemeModal}
              title={`Appearance: ${themeMode === 'light' ? 'Light' : themeMode === 'dark' ? 'Dark' : 'System'} mode (Click to customize)`}
              aria-label="Theme & Appearance settings"
            >
              {getThemeIcon()}
            </button>
          )}

          {/* Desktop-Only Action Buttons */}
          <div className="nav-desktop-actions">
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

            <button
              className="btn btn-secondary"
              onClick={onRescrapeAllClick}
              disabled={isRescrapingAll}
              title="Global Re-scrape: Refresh all previews & metadata"
            >
              <RefreshCw size={15} className={isRescrapingAll ? 'spin-animation' : ''} />
              <span className="btn-text-hide-mobile">{isRescrapingAll ? 'Syncing...' : 'Sync All'}</span>
            </button>

            {(isAIConnected || user?.isAdmin) && onAIClick && (
              <button
                className="btn btn-secondary"
                onClick={onAIClick}
                title={isAIConnected ? `AI Connected (${aiProviderName || 'Active'})` : 'Connect your AI'}
                aria-label="Connect AI"
              >
                <Sparkles size={15} style={{ color: isAIConnected ? 'var(--color-primary)' : undefined }} />
              </button>
            )}

            {/* Combined Import / Export Data Menu */}
            <div className="nav-menu-wrapper" ref={dataMenuRef} style={{ position: 'relative' }}>
              <button
                className={`btn btn-secondary ${isDataMenuOpen ? 'active' : ''}`}
                onClick={() => setIsDataMenuOpen(!isDataMenuOpen)}
                title="Data: Import & Export Bookmarks"
                aria-label="Import and Export Bookmarks"
              >
                <ArrowDownUp size={15} />
              </button>

              {isDataMenuOpen && (
                <div className="nav-dropdown-menu" style={{ minWidth: '175px', top: 'calc(100% + 6px)', bottom: 'auto' }}>
                  <button
                    className="nav-dropdown-item"
                    onClick={() => {
                      setIsDataMenuOpen(false);
                      onImportClick();
                    }}
                  >
                    <Upload size={14} />
                    <span>Import Bookmarks</span>
                  </button>

                  <a
                    href="/api/io/export"
                    className="nav-dropdown-item"
                    download
                    onClick={() => setIsDataMenuOpen(false)}
                  >
                    <Download size={14} />
                    <span>Export Bookmarks</span>
                  </a>
                </div>
              )}
            </div>

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

            {user && onManageAccountClick && (
              <button
                className="btn btn-secondary"
                onClick={onManageAccountClick}
                title={user.isAdmin ? "Manage Users & API Keys" : "API Keys"}
                aria-label={user.isAdmin ? "Manage Users & API Keys" : "API Keys"}
              >
                {user.isAdmin ? <UserPlus size={15} /> : <Key size={15} />}
              </button>
            )}

            {user && (
              <button className="btn btn-secondary" onClick={onLogoutClick} title={`Log out (${user.username})`}>
                <LogOut size={15} />
              </button>
            )}
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
                {onOpenThemeModal && (
                  <button
                    className="nav-dropdown-item"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenThemeModal();
                    }}
                  >
                    <Palette size={15} />
                    <span>Theme & Appearance</span>
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
                {(isAIConnected || user?.isAdmin) && onAIClick && (
                  <button
                    className="nav-dropdown-item"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onAIClick();
                    }}
                  >
                    <Sparkles size={15} style={{ color: isAIConnected ? 'var(--color-primary)' : undefined }} />
                    <span>{isAIConnected ? `AI (${aiProviderName || 'Active'}) · Connected ✓` : 'Connect AI'}</span>
                  </button>
                )}

                <button
                  className="nav-dropdown-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onRescrapeAllClick();
                  }}
                  disabled={isRescrapingAll}
                >
                  <RefreshCw size={15} className={isRescrapingAll ? 'spin-animation' : ''} />
                  <span>{isRescrapingAll ? 'Syncing all...' : 'Sync & Re-scrape All'}</span>
                </button>

                <button
                  className="nav-dropdown-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onImportClick();
                  }}
                >
                  <Upload size={15} />
                  <span>Import Bookmarks</span>
                </button>

                <a
                  href="/api/io/export"
                  className="nav-dropdown-item"
                  download
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Download size={15} />
                  <span>Export Bookmarks</span>
                </a>

                {user && onManageAccountClick && (
                  <button
                    className="nav-dropdown-item"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onManageAccountClick();
                    }}
                  >
                    {user.isAdmin ? <UserPlus size={15} /> : <Key size={15} />}
                    <span>{user.isAdmin ? "Users & API Keys" : "API Keys"}</span>
                  </button>
                )}

                {user && (
                  <>
                    <div className="nav-dropdown-divider" />
                    <button
                      className="nav-dropdown-item nav-dropdown-danger"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onLogoutClick();
                      }}
                    >
                      <LogOut size={15} />
                      <span>Log out (@{user.username})</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

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
    </header>
  );
};

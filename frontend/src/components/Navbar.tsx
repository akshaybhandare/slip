import React, { useState, useEffect, useRef } from 'react';
import { Bookmark as BookmarkIcon, Search, Plus, Upload, Download, LogOut, RefreshCw, X, Sun, Moon, Monitor, MoreVertical, UserPlus, Sparkles, CornerDownLeft } from 'lucide-react';
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
  onAddUserClick?: () => void;
  onImportClick: () => void;
  onRescrapeAllClick: () => void;
  isRescrapingAll: boolean;
  onLogoutClick: () => void;
  onAIClick?: () => void;
  isAIConnected?: boolean;
  aiProviderName?: string;
  user: User | null;
  themeMode?: ThemeMode;
  onToggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  isSearching = false,
  isSmartSearch = false,
  onToggleSmartSearch,
  onAddClick,
  onAddUserClick,
  onImportClick,
  onRescrapeAllClick,
  isRescrapingAll,
  onLogoutClick,
  onAIClick,
  isAIConnected = false,
  aiProviderName,
  user,
  themeMode = 'system',
  onToggleTheme
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

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMenuOpen]);

  const getThemeIcon = () => {
    if (themeMode === 'light') return <Sun size={15} />;
    if (themeMode === 'dark') return <Moon size={15} />;
    return <Monitor size={15} />;
  };

  const getThemeTitle = () => {
    if (themeMode === 'light') return 'Theme: Light (Click for Dark)';
    if (themeMode === 'dark') return 'Theme: Dark (Click for System)';
    return 'Theme: System Auto (Click for Light)';
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

          {/* Theme Switcher */}
          {onToggleTheme && (
            <button
              className="btn btn-secondary theme-toggle-btn"
              onClick={onToggleTheme}
              title={getThemeTitle()}
              aria-label="Toggle light, dark, and system theme"
            >
              {getThemeIcon()}
            </button>
          )}

          {/* Desktop-Only Action Buttons */}
          <div className="nav-desktop-actions">
            <button
              className="btn btn-secondary"
              onClick={onRescrapeAllClick}
              disabled={isRescrapingAll}
              title="Global Re-scrape: Refresh all previews & metadata"
            >
              <RefreshCw size={15} className={isRescrapingAll ? 'spin-animation' : ''} />
              <span className="btn-text-hide-mobile">{isRescrapingAll ? 'Syncing...' : 'Sync All'}</span>
            </button>

            {onAIClick && (
              <button
                className="btn btn-secondary"
                onClick={onAIClick}
                title={isAIConnected ? `AI Connected (${aiProviderName || 'Active'})` : 'Connect your AI'}
                aria-label="Connect AI"
              >
                <Sparkles size={15} style={{ color: isAIConnected ? 'var(--color-primary)' : undefined }} />
              </button>
            )}

            <button className="btn btn-secondary" onClick={onImportClick} title="Import HTML Bookmarks">
              <Upload size={15} />
            </button>

            <a href="/api/io/export" className="btn btn-secondary" title="Export HTML Bookmarks" download>
              <Download size={15} />
            </a>

            {(user?.isAdmin || user?.id === 1) && onAddUserClick && (
              <button className="btn btn-secondary" onClick={onAddUserClick} title="Add User">
                <UserPlus size={15} />
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
                {onAIClick && (
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
                  <span>Import HTML Bookmarks</span>
                </button>

                <a
                  href="/api/io/export"
                  className="nav-dropdown-item"
                  download
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Download size={15} />
                  <span>Export HTML Bookmarks</span>
                </a>

                {(user?.isAdmin || user?.id === 1) && onAddUserClick && (
                  <button
                    className="nav-dropdown-item"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onAddUserClick();
                    }}
                  >
                    <UserPlus size={15} />
                    <span>Add User</span>
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

      <div className={`search-wrapper ${isSmartSearch ? 'smart-search-mode' : ''}`}>
        <Search
          className={`search-icon ${isSmartSearch && searchQuery ? 'search-icon-clickable' : ''}`}
          size={17}
          onClick={() => {
            if (isSmartSearch && onSearchSubmit) {
              onSearchSubmit();
            }
          }}
        />
        <input
          type="text"
          className="search-input"
          placeholder={
            isSmartSearch
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
        {isSmartSearch && searchQuery.trim() && onSearchSubmit && (
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
        {onToggleSmartSearch && (
          <button
            type="button"
            className={`search-smart-btn ${isSmartSearch ? 'active' : ''}`}
            onClick={onToggleSmartSearch}
            title={
              isAIConnected
                ? isSmartSearch
                  ? "Smart Search (AI Semantic Matching) is ON — Click for standard search"
                  : "Smart Search (AI Semantic Matching) is OFF — Click to enable"
                : "Connect AI in settings to enable Smart Search"
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

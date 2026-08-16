import React from 'react';
import { Bookmark as BookmarkIcon, Search, Plus, Upload, Download, LogOut, RefreshCw, X, Sun, Moon, Monitor } from 'lucide-react';
import { User } from '../types';
import { ThemeMode } from '../hooks/useTheme';

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAddClick: () => void;
  onImportClick: () => void;
  onRescrapeAllClick: () => void;
  isRescrapingAll: boolean;
  onLogoutClick: () => void;
  user: User | null;
  themeMode?: ThemeMode;
  onToggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  onAddClick,
  onImportClick,
  onRescrapeAllClick,
  isRescrapingAll,
  onLogoutClick,
  user,
  themeMode = 'system',
  onToggleTheme
}) => {
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
          <button className="btn btn-primary" onClick={onAddClick} title="Save Link">
            <Plus size={16} />
            <span className="btn-text-hide-mobile">Save</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={onRescrapeAllClick}
            disabled={isRescrapingAll}
            title="Global Re-scrape: Refresh all previews & metadata"
          >
            <RefreshCw size={15} className={isRescrapingAll ? 'spin-animation' : ''} />
            <span className="btn-text-hide-mobile">{isRescrapingAll ? 'Syncing...' : 'Sync All'}</span>
          </button>

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

          <button className="btn btn-secondary" onClick={onImportClick} title="Import HTML Bookmarks">
            <Upload size={15} />
          </button>

          <a href="/api/io/export" className="btn btn-secondary" title="Export HTML Bookmarks" download>
            <Download size={15} />
          </a>

          {user && (
            <button className="btn btn-secondary" onClick={onLogoutClick} title={`Log out (${user.username})`}>
              <LogOut size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="search-wrapper">
        <Search className="search-icon" size={17} />
        <input
          type="text"
          className="search-input"
          placeholder="Search your archive & tags..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
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
      </div>
    </header>
  );
};

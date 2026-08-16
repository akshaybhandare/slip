import React, { useState, useEffect, useCallback } from 'react';
import { Bookmark, ContentType, Tag, User } from './types';
import {
  fetchBookmarks,
  searchBookmarks,
  fetchTags,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  rescrapeBookmark,
  rescrapeAllBookmarks,
  logoutUser,
  getMe
} from './api';
import { Navbar } from './components/Navbar';
import { FilterTabs } from './components/FilterTabs';
import { MasonryGrid } from './components/MasonryGrid';
import { AddBookmarkModal } from './components/AddBookmarkModal';
import { EditBookmarkModal } from './components/EditBookmarkModal';
import { ReaderModal } from './components/ReaderModal';
import { ShareModal } from './components/ShareModal';
import { ImportModal } from './components/ImportModal';
import { AuthModal } from './components/AuthModal';
import { BookmarkPlus, Plus } from 'lucide-react';
import { useTheme } from './hooks/useTheme';

export const App: React.FC = () => {
  const { themeMode, toggleTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeType, setActiveType] = useState<ContentType>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRescrapingAll, setIsRescrapingAll] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [readerBookmark, setReaderBookmark] = useState<Bookmark | null>(null);
  const [shareTargetBookmark, setShareTargetBookmark] = useState<Bookmark | null>(null);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);

  // Verify session on mount
  useEffect(() => {
    getMe()
      .then((data) => {
        setUser(data.user);
        setNeedsAuth(false);
      })
      .catch(() => {
        setUser(null);
        setNeedsAuth(true);
      });
  }, []);

  const loadData = useCallback(async () => {
    if (needsAuth) return;

    setLoading(true);
    try {
      if (searchQuery.trim().length > 0) {
        const searchResults = await searchBookmarks(searchQuery.trim());
        setBookmarks(searchResults);
      } else {
        const [bList, tList] = await Promise.all([
          fetchBookmarks(activeType, selectedTag || undefined),
          fetchTags()
        ]);
        setBookmarks(bList);
        setTags(tList);
      }
      setNeedsAuth(false);
    } catch (err: any) {
      if (err.message?.includes('Unauthorized') || err.message?.includes('401') || err.message?.includes('token')) {
        setUser(null);
        setNeedsAuth(true);
      }
    } finally {
      setLoading(false);
    }
  }, [activeType, selectedTag, searchQuery, needsAuth]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      loadData();
    }, 250);

    return () => clearTimeout(debounceTimer);
  }, [loadData]);

  const handleAuthSuccess = (loggedUser: User) => {
    setUser(loggedUser);
    setNeedsAuth(false);
    loadData();
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch {
      // Ignore
    }
    setUser(null);
    setBookmarks([]);
    setNeedsAuth(true);
  };

  const handleSaveBookmark = async (data: { url: string; tags: string[] }) => {
    await createBookmark(data);
    loadData();
  };

  const handleUpdateBookmark = async (
    id: number,
    data: { title: string; description: string; personalNote?: string; contentType: string; tags: string[] }
  ) => {
    const updated = await updateBookmark(id, data);
    setBookmarks((prev) => prev.map((b) => (b.id === id ? updated : b)));
    fetchTags().then(setTags).catch(() => {});
  };

  const handleRescrapeBookmark = async (id: number) => {
    try {
      const refreshed = await rescrapeBookmark(id);
      setBookmarks((prev) => prev.map((b) => (b.id === id ? refreshed : b)));
    } catch (err: any) {
      alert(err.message || 'Failed to rescrape bookmark');
    }
  };

  const handleRescrapeAll = async () => {
    setIsRescrapingAll(true);
    try {
      const res = await rescrapeAllBookmarks();
      // Poll a few times to show fresh data
      let checks = 0;
      const interval = setInterval(() => {
        loadData();
        checks++;
        if (checks > 4) clearInterval(interval);
      }, 2500);
    } catch (err: any) {
      alert(err.message || 'Failed to start global re-scrape');
    } finally {
      setTimeout(() => setIsRescrapingAll(false), 2000);
    }
  };

  const handleDeleteBookmark = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this bookmark?')) return;
    try {
      await deleteBookmark(id);
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
      fetchTags().then(setTags).catch(() => {});
    } catch (err: any) {
      alert(err.message || 'Failed to delete bookmark');
    }
  };

  return (
    <div className="app-container">
      {needsAuth && <AuthModal onSuccess={handleAuthSuccess} />}

      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddClick={() => setIsAddOpen(true)}
        onImportClick={() => setIsImportOpen(true)}
        onRescrapeAllClick={handleRescrapeAll}
        isRescrapingAll={isRescrapingAll}
        onLogoutClick={handleLogout}
        user={user}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
      />

      <FilterTabs
        activeType={activeType}
        onTypeChange={setActiveType}
        tags={tags}
        selectedTag={selectedTag}
        onTagSelect={setSelectedTag}
      />

      {loading && bookmarks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--color-muted)' }}>
          Loading your visual archive...
        </div>
      ) : bookmarks.length > 0 ? (
        <MasonryGrid
          bookmarks={bookmarks}
          onOpenReader={setReaderBookmark}
          onShare={setShareTargetBookmark}
          onEdit={setEditingBookmark}
          onRescrape={handleRescrapeBookmark}
          onDelete={handleDeleteBookmark}
          onTagClick={(tagName) => setSelectedTag(tagName)}
        />
      ) : (
        <div className="empty-state">
          <BookmarkPlus className="empty-icon" />
          <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: 'var(--color-secondary)', letterSpacing: '-0.4px' }}>
            {searchQuery ? 'No matching bookmarks found' : 'Your visual mind is empty'}
          </h3>
          <p style={{ maxWidth: '420px', margin: '0 auto 24px', fontSize: '14px', color: 'var(--color-muted)' }}>
            {searchQuery
              ? `We couldn't find any bookmarks matching "${searchQuery}". Try a different keyword.`
              : 'Save your first article, video, design inspiration, or product link with a single click.'}
          </p>
          {!searchQuery && (
            <button className="btn btn-primary" onClick={() => setIsAddOpen(true)}>
              Save Your First Bookmark
            </button>
          )}
        </div>
      )}

      {/* Mobile Floating Action Button (FAB) */}
      <button
        className="mobile-fab"
        onClick={() => setIsAddOpen(true)}
        aria-label="Save bookmark"
      >
        <Plus size={24} />
      </button>

      <AddBookmarkModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSave={handleSaveBookmark}
        availableTags={tags}
      />

      <EditBookmarkModal
        bookmark={editingBookmark}
        onClose={() => setEditingBookmark(null)}
        onUpdate={handleUpdateBookmark}
        availableTags={tags}
      />

      <ReaderModal
        bookmark={readerBookmark}
        onClose={() => setReaderBookmark(null)}
      />

      <ShareModal
        bookmark={shareTargetBookmark}
        onClose={() => setShareTargetBookmark(null)}
      />

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportSuccess={loadData}
      />
    </div>
  );
};

export default App;

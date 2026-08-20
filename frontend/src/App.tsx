import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bookmark, ContentType, Tag, User } from './types';
import {
  fetchBookmarks,
  searchBookmarks,
  smartSearchBookmarks,
  fetchTags,
  createBookmark,
  uploadImageBookmark,
  uploadFileBookmark,
  createNoteBookmark,
  updateBookmark,
  deleteBookmark,
  rescrapeBookmark,
  autoTagBookmark,
  rescrapeAllBookmarks,
  fetchPinConfig,
  togglePinBookmark,
  logoutUser,
  getMe
} from './api';
import { Navbar } from './components/Navbar';
import { FilterTabs } from './components/FilterTabs';
import { MasonryGrid } from './components/MasonryGrid';
import { SlipPinIcon } from './components/BookmarkCard';
import { AddBookmarkModal } from './components/AddBookmarkModal';
import { EditBookmarkModal } from './components/EditBookmarkModal';
import { ReaderModal } from './components/ReaderModal';
import { ShareModal } from './components/ShareModal';
import { ImportModal } from './components/ImportModal';
import { AuthModal } from './components/AuthModal';
import { AddUserModal } from './components/AddUserModal';
import { AIConnectModal } from './components/AIConnectModal';
import { ClipsView } from './components/ClipsView';
import { AddToClipModal } from './components/AddToClipModal';
import { BookmarkPlus, Plus, Sparkles } from 'lucide-react';
import { useTheme } from './hooks/useTheme';
import { useAIConfig } from './hooks/useAIConfig';
import { AI_PROVIDERS } from './config/aiConfig';

export const App: React.FC = () => {
  const { themeMode, toggleTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const {
    aiConfig,
    connect: connectAI,
    disconnect: disconnectAI,
    testConnection: testAIConnection
  } = useAIConfig(user);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeType, setActiveType] = useState<ContentType>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSmartSearch, setIsSmartSearch] = useState<boolean>(() => {
    try {
      return localStorage.getItem('slip_smart_search') === 'true';
    } catch {
      return false;
    }
  });

  const effectiveSmartSearch = Boolean(aiConfig.isConnected && isSmartSearch);

  useEffect(() => {
    if (!aiConfig.isConnected) {
      setIsSmartSearch(false);
      try {
        localStorage.setItem('slip_smart_search', 'false');
      } catch {}
    }
  }, [aiConfig.isConnected]);

  const rescrapeIntervalRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (rescrapeIntervalRef.current) {
        clearInterval(rescrapeIntervalRef.current);
      }
    };
  }, []);

  const [maxPinnedSlips, setMaxPinnedSlips] = useState<number>(5);

  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRescrapingAll, setIsRescrapingAll] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  // Load pin config on mount
  useEffect(() => {
    fetchPinConfig()
      .then((cfg) => {
        if (cfg && typeof cfg.maxPinnedSlips === 'number') {
          setMaxPinnedSlips(cfg.maxPinnedSlips);
        }
      })
      .catch(() => {});
  }, []);

  // Modals & Views
  const [isClipsView, setIsClipsView] = useState<boolean>(() => {
    try {
      return localStorage.getItem('slip_clips_view') === 'true';
    } catch {
      return false;
    }
  });

  const handleSetClipsView = useCallback((val: boolean) => {
    setIsClipsView(val);
    try {
      localStorage.setItem('slip_clips_view', String(val));
    } catch {}
  }, []);

  const handleToggleClipsView = useCallback(() => {
    setIsClipsView((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('slip_clips_view', String(next));
      } catch {}
      return next;
    });
  }, []);

  const [managingClipsBookmark, setManagingClipsBookmark] = useState<Bookmark | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [readerBookmark, setReaderBookmark] = useState<Bookmark | null>(null);
  const [shareTargetBookmark, setShareTargetBookmark] = useState<Bookmark | null>(null);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);

  const handleToggleSmartSearch = useCallback(() => {
    if (!aiConfig.isConnected) {
      return;
    }
    setIsSmartSearch((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('slip_smart_search', String(next));
      } catch {}
      return next;
    });
  }, [aiConfig.isConnected]);

  // Drag and drop setup
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        if (isImage || isPdf) {
          setDroppedFile(file);
          setIsAddOpen(true);
        }
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

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

  const loadData = useCallback(async (queryOverride?: string, smartOverride?: boolean) => {
    if (needsAuth) return;

    const targetQuery = typeof queryOverride === 'string' ? queryOverride : searchQuery;
    const targetSmart = aiConfig.isConnected && (typeof smartOverride === 'boolean' ? smartOverride : isSmartSearch);
    const cleanQ = targetQuery.trim();

    setLoading(true);
    try {
      if (cleanQ.length > 0) {
        if (targetSmart) {
          try {
            setSearchNotice(null);
            const searchResults = await smartSearchBookmarks(cleanQ);
            setBookmarks(searchResults);
          } catch (aiErr: any) {
            console.warn('Smart search provider error, smoothly falling back to keyword search:', aiErr);
            const fallbackResults = await searchBookmarks(cleanQ);
            setBookmarks(fallbackResults);
            setSearchNotice(`AI Smart Search encountered a provider issue (${aiErr.message || 'Provider busy'}). Showing keyword search matches below.`);
          }
        } else {
          setSearchNotice(null);
          const searchResults = await searchBookmarks(cleanQ);
          setBookmarks(searchResults);
        }
      } else {
        setSearchNotice(null);
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
  }, [activeType, selectedTag, searchQuery, isSmartSearch, aiConfig.isConnected, needsAuth]);

  // Handle live search vs enter-to-search
  useEffect(() => {
    if (effectiveSmartSearch) {
      // In Smart Search mode: If user clears the input, reset list immediately
      if (searchQuery.trim() === '') {
        loadData('', false);
      }
      // Otherwise do NOT search automatically while typing in smart mode; wait for Enter
      return;
    }

    // In Standard Search mode: Live debounced search (250ms)
    const debounceTimer = setTimeout(() => {
      loadData(searchQuery, false);
    }, 250);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, effectiveSmartSearch, loadData]);

  const handleSearchSubmit = useCallback(() => {
    loadData(searchQuery, effectiveSmartSearch);
  }, [searchQuery, effectiveSmartSearch, loadData]);

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

  const handleSaveFileBookmark = async (data: {
    file?: File;
    imageData?: string;
    fileData?: string;
    filename?: string;
    title?: string;
    description?: string;
    personalNote?: string;
    tags?: string[];
  }) => {
    await uploadFileBookmark(data);
    loadData();
  };

  const handleSaveImageBookmark = handleSaveFileBookmark;

  const handleSaveNote = async (data: {
    title?: string;
    content: string;
    tags?: string[];
  }) => {
    await createNoteBookmark(data);
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

  const handleAutoTagBookmark = async (id: number) => {
    try {
      const refreshed = await autoTagBookmark(id);
      setBookmarks((prev) => prev.map((b) => (b.id === id ? refreshed : b)));
      fetchTags().then(setTags).catch(() => {});
    } catch (err: any) {
      alert(err.message || 'Failed to auto-tag with AI');
    }
  };

  const handleRescrapeAll = async () => {
    setIsRescrapingAll(true);
    try {
      await rescrapeAllBookmarks();
      // Poll a few times to show fresh data
      if (rescrapeIntervalRef.current) {
        clearInterval(rescrapeIntervalRef.current);
      }
      let checks = 0;
      rescrapeIntervalRef.current = setInterval(() => {
        loadData();
        checks++;
        if (checks > 4) {
          clearInterval(rescrapeIntervalRef.current);
          rescrapeIntervalRef.current = null;
        }
      }, 2500);
    } catch (err: any) {
      alert(err.message || 'Failed to start global re-scrape');
    } finally {
      setTimeout(() => setIsRescrapingAll(false), 2000);
    }
  };

  const pinnedCount = bookmarks.filter((b) => Boolean(b.is_pinned)).length;

  const handleTogglePin = async (id: number) => {
    const targetBookmark = bookmarks.find((b) => b.id === id);
    const isCurrentlyPinned = Boolean(targetBookmark?.is_pinned);

    if (!isCurrentlyPinned && pinnedCount >= maxPinnedSlips) {
      setSearchNotice(`📌 Pinboard full! You can pin up to ${maxPinnedSlips} slips at once. Unpin a slip to make room for this one.`);
      return;
    }

    try {
      const updated = await togglePinBookmark(id);
      setBookmarks((prev) => {
        const nextList = prev.map((b) => (b.id === id ? updated : b));
        return nextList.sort((a, b) => {
          const aPin = Boolean(a.is_pinned) ? 1 : 0;
          const bPin = Boolean(b.is_pinned) ? 1 : 0;
          if (aPin !== bPin) return bPin - aPin;
          if (aPin && bPin) {
            const aPinnedTime = a.pinned_at ? new Date(a.pinned_at).getTime() : 0;
            const bPinnedTime = b.pinned_at ? new Date(b.pinned_at).getTime() : 0;
            if (aPinnedTime !== bPinnedTime) return bPinnedTime - aPinnedTime;
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      });
      if (searchNotice && searchNotice.includes('Pinboard full')) {
        setSearchNotice(null);
      }
    } catch (err: any) {
      setSearchNotice(err.message || 'Failed to pin slip');
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
        onSearchSubmit={handleSearchSubmit}
        isSearching={loading}
        isSmartSearch={effectiveSmartSearch}
        onToggleSmartSearch={handleToggleSmartSearch}
        onAddClick={() => setIsAddOpen(true)}
        onAddUserClick={() => setIsAddUserOpen(true)}
        onImportClick={() => setIsImportOpen(true)}
        onRescrapeAllClick={handleRescrapeAll}
        isRescrapingAll={isRescrapingAll}
        onLogoutClick={handleLogout}
        onAIClick={() => setIsAIOpen(true)}
        isAIConnected={aiConfig.isConnected}
        aiProviderName={AI_PROVIDERS[aiConfig.provider]?.name}
        user={user}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
        isClipsView={isClipsView}
        onToggleClipsView={handleToggleClipsView}
      />

      {isClipsView ? (
        <ClipsView
          onBackToFeed={() => handleSetClipsView(false)}
          onOpenReader={setReaderBookmark}
          onShare={setShareTargetBookmark}
          onEdit={setEditingBookmark}
          onRescrape={handleRescrapeBookmark}
          onAutoTag={aiConfig.isConnected ? handleAutoTagBookmark : undefined}
          onTogglePin={handleTogglePin}
          isAIConnected={aiConfig.isConnected}
          onDeleteBookmark={handleDeleteBookmark}
          onTagClick={(tagName) => {
            setSelectedTag(tagName);
            handleSetClipsView(false);
          }}
          onManageBookmarkClips={setManagingClipsBookmark}
        />
      ) : (
        <>
          <FilterTabs
            activeType={activeType}
            onTypeChange={setActiveType}
            tags={tags}
            selectedTag={selectedTag}
            onTagSelect={setSelectedTag}
          />

          {pinnedCount > 0 && !searchQuery && (
            <div className="pinned-slips-bar">
              <span className="pinned-slips-chip">
                <SlipPinIcon isPinned={true} size={13} />
                <span className="pinned-chip-text">{`${pinnedCount} of ${maxPinnedSlips} slips pinned to top`}</span>
              </span>
            </div>
          )}

          {searchNotice && (
            <div style={{
              maxWidth: '800px',
              margin: '0 auto 16px',
              padding: '10px 16px',
              borderRadius: '8px',
              background: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              color: 'var(--color-on-surface)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <span>{searchNotice}</span>
              <button
                onClick={() => setSearchNotice(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: '2px 6px', fontSize: '14px' }}
                title="Dismiss notice"
              >
                ✕
              </button>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--color-muted)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                {effectiveSmartSearch && searchQuery.trim() ? (
                  <>
                    <Sparkles size={18} className="sparkle-spin" style={{ color: 'var(--color-primary)' }} />
                    <span>{`Searching your archive with AI for "${searchQuery}"...`}</span>
                  </>
                ) : (
                  <span>Loading your visual archive...</span>
                )}
              </div>
            </div>
          ) : bookmarks.length > 0 ? (
            <MasonryGrid
              bookmarks={bookmarks}
              onOpenReader={setReaderBookmark}
              onShare={setShareTargetBookmark}
              onEdit={setEditingBookmark}
              onRescrape={handleRescrapeBookmark}
              onAutoTag={aiConfig.isConnected ? handleAutoTagBookmark : undefined}
              onTogglePin={handleTogglePin}
              isAIConnected={aiConfig.isConnected}
              onDelete={handleDeleteBookmark}
              onTagClick={(tagName) => setSelectedTag(tagName)}
              onManageClips={setManagingClipsBookmark}
            />
          ) : (
            <div className="empty-state">
              <BookmarkPlus className="empty-icon" />
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: 'var(--color-secondary)', letterSpacing: '-0.4px' }}>
                {searchQuery ? 'No matching bookmarks found' : 'Your visual mind is empty'}
              </h3>
              <p style={{ maxWidth: '440px', margin: '0 auto 24px', fontSize: '14px', color: 'var(--color-muted)' }}>
                {searchQuery
                  ? effectiveSmartSearch
                    ? `No semantic matches found for "${searchQuery}". Try rephrasing your description or switch to standard keyword search.`
                    : `We couldn't find any bookmarks matching "${searchQuery}". Try a different keyword.`
                  : 'Save your first article, video, design inspiration, or product link with a single click.'}
              </p>
              {!searchQuery && (
                <button className="btn btn-primary" onClick={() => setIsAddOpen(true)}>
                  Save Your First Bookmark
                </button>
              )}
            </div>
          )}
        </>
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
        onClose={() => {
          setIsAddOpen(false);
          setDroppedFile(null);
        }}
        onSave={handleSaveBookmark}
        onSaveFile={handleSaveFileBookmark}
        onSaveImage={handleSaveImageBookmark}
        onSaveNote={handleSaveNote}
        initialFile={droppedFile}
        availableTags={tags}
        isAIConnected={aiConfig.isConnected}
        onOpenAISettings={() => setIsAIOpen(true)}
      />

      <AIConnectModal
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
        aiConfig={aiConfig}
        isAdmin={Boolean(user?.isAdmin)}
        onConnect={connectAI}
        onDisconnect={disconnectAI}
        onTestConnection={testAIConnection}
      />

      <EditBookmarkModal
        bookmark={editingBookmark}
        onClose={() => setEditingBookmark(null)}
        onUpdate={handleUpdateBookmark}
        availableTags={tags}
        isAIConnected={aiConfig.isConnected}
        onOpenAISettings={() => setIsAIOpen(true)}
      />

      <AddToClipModal
        bookmark={managingClipsBookmark}
        onClose={() => setManagingClipsBookmark(null)}
        onSuccess={() => loadData()}
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

      <AddUserModal
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
      />
    </div>
  );
};

export default App;

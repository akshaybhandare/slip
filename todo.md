# Slip — Product Enhancement Roadmap & Implementation Spec

This document details the architecture, technical implementation plan, and user experience (UX) flows for the three core high-impact features selected for **Slip**.

---

## 📑 Table of Contents
1. [Feature 1: Zero-Friction Ingestion (Browser Extension & iOS Share Sheet)](#1-zero-friction-ingestion-browser-extension--ios-share-sheet)
2. [Feature 2: Reader Highlights & Personal Sticky Notes](#2-reader-highlights--personal-sticky-notes)
3. [Feature 3: System-Aware Dark Mode & OLED True-Black Theme](#3-system-aware-dark-mode--oled-true-black-theme)
4. [Implementation Sequence & Timeline](#4-implementation-sequence--timeline)

---

## 1. Zero-Friction Ingestion (Browser Extension & iOS Share Sheet)

### 🎯 Motivation & Value
The #1 reason bookmarking tools fall into disuse is **capture friction**. Requiring users to copy a URL, navigate to Slip, paste the URL, and wait for confirmation breaks concentration. With native browser extension and iOS Share Sheet integration, saving content happens in **under 1 second** directly from the context where inspiration strikes.

---

### 📱 User Experience (UX) Walkthrough

#### A. Desktop Browser Experience (Chrome / Brave / Edge / Firefox / Safari)
1. **1-Click Capture**: While reading any webpage or watching a YouTube video, the user presses `Cmd+Shift+S` (or clicks the Slip icon in the toolbar).
2. **Instant Visual Feedback (HUD Popup)**:
   * A sleek 300px flyout appears with a live saving spinner that changes to a green checkmark (`✓ Saved to Slip`).
   * The popup auto-extracts page title, favicon, and cover image.
   * **Inline Tagging**: Allows adding tags directly from the popup using the same autocompleting tag pills as the main app.
   * Auto-closes after 2.5 seconds or on `Enter` key.
3. **Background Sync**: The extension communicates with the user's self-hosted Unraid instance using a stored API token.

```
┌─────────────────────────────────────────────────────────┐
│  🌐 https://nytimes.com/article...                      │
│                                           ┌───────────┐ │
│                                           │  🔖 Slip  │ │
│                                           ├───────────┤ │
│                                           │ ✓ Saved   │ │
│                                           │ Tags:     │ │
│                                           │ [#reading]│ │
│                                           └───────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### B. iOS Mobile Experience (Share Sheet & iOS Shortcut)
1. In Safari, Twitter/X, Reddit, or YouTube on iPhone, tap the native **Share** icon.
2. Tap **"Save to Slip"** in the share menu actions.
3. An iOS dynamic toast appears: `✓ Saved to Slip Archive`.
4. Zero need to switch apps or open Safari tabs.

---

### 🛠️ Technical Implementation Plan

#### 1. Manifest V3 Browser Extension (`extension/`)
* **`manifest.json`**:
  * MV3 architecture with permissions: `activeTab`, `storage`, `contextMenus`.
  * Keyboard shortcut command: `_execute_action` bound to `Ctrl+Shift+S` (Windows) / `MacCtrl+Shift+S` (macOS).
* **`popup.html` & `popup.ts`**:
  * Lightweight Vanilla JS + CSS micro-bundle (< 40KB).
  * Reads current tab URL & title via `chrome.tabs.query({ active: true, currentWindow: true })`.
  * Sends `POST /api/bookmarks` to configured host URL (`http://<unraid-ip>:3080`).
  * Header: `Authorization: Bearer <API_KEY>`.
* **Options Page (`options.html`)**:
  * Configuration form for **Slip Server URL** (e.g. `http://192.168.10.12:3080` or `https://slip.yourdomain.com`) and **API Key**.
  * Test connection button that pings `/api/auth/me`.

#### 2. Native iOS Shortcut Integration (`ios/`)
* Create a downloadable `.shortcut` file and iOS configuration guide:
  * **Input**: Safari web page or text URL from Share Sheet.
  * **Action**: "Get Contents of URL" `POST` to `https://<YOUR_SLIP_HOST>/api/bookmarks` with JSON payload `{"url": ShortcutInput}` and header `Authorization: Bearer <TOKEN>`.
  * **Output**: iOS system notification.

#### 3. Backend Support
* Endpoint `POST /api/bookmarks` already supports Bearer token authentication from API keys generated in `api_keys` table.

---

## 2. Reader Highlights & Personal Sticky Notes

### 🎯 Motivation & Value
Passive bookmarking leads to link hoarding without retention. Giving users the ability to highlight key insights in Reader Mode and attach Markdown thoughts turns Slip into a powerful **active reading space and knowledge base**.

---

### 📱 User Experience (UX) Walkthrough

#### A. Reader Highlights
1. Inside **Reader Mode**, the user selects any sentence or paragraph with the mouse/touch.
2. A contextual floating pill appears above the selection with 3 actions:
   * 🟡 **Highlight (Yellow)**
   * 🟢 **Highlight (Green)**
   * 📝 **Add Note**
3. The selected text is permanently highlighted in the article view.
4. All article highlights are aggregated in a **"Highlights"** sidebar inside Reader Mode for quick review and 1-click clipboard copy.

```
┌──────────────────────────────────────────────────────────────┐
│  Reader Mode — "Understanding SQLite WAL Mode"       [× Close]│
│                                                              │
│  ...In WAL mode, readers do not block writers and writers   │
│  do not block readers. [ 🟡 Highlight | 📝 Add Note ]       │
│  ═══════════════════════════════════════════════════════════  │
│                                                              │
│  ┌─ Highlights (2) ────────────────────────────────────────┐ │
│  │ "In WAL mode, readers do not block writers..."          │ │
│  │ "Checkpoints write changes back to the main DB..."      │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

#### B. Personal Sticky Notes on Cards
1. On each bookmark card, a new **Note icon** (`StickyNote` / `MessageSquare`) appears next to Edit and Share.
2. Clicking it opens an inline expandable Markdown note block.
3. The user can type personal thoughts (e.g., *"Bought this for the kitchen, delivery on Tuesday"* or *"Check section 4 before implementation"*).
4. Notes are indexed by SQLite **FTS5**, meaning searching for words in your private notes instantly returns the parent bookmark card!

---

### 🛠️ Technical Implementation Plan

#### 1. Database Schema Additions (`backend/src/db.ts`)
```sql
-- Bookmark personal notes
ALTER TABLE bookmarks ADD COLUMN personal_note TEXT;

-- Text highlights table
CREATE TABLE IF NOT EXISTS highlights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bookmark_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  color TEXT DEFAULT 'yellow',
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_highlights_bookmark ON highlights(bookmark_id);
```

#### 2. Synchronize FTS5 Index
Update `bookmarks_fts` virtual table triggers to include `personal_note` so search matches both web content and user notes.

#### 3. Backend Endpoints (`backend/src/routes/bookmarks.ts` & `backend/src/routes/highlights.ts`)
* `PUT /api/bookmarks/:id/note`: Updates user's personal sticky note.
* `GET /api/bookmarks/:id/highlights`: Retrieves highlights for an article.
* `POST /api/bookmarks/:id/highlights`: Saves a new text highlight `{ text, color, note }`.
* `DELETE /api/highlights/:id`: Deletes a highlight.

#### 4. Frontend Integration
* **`ReaderModal.tsx`**: Add `window.getSelection()` listener and floating highlight action bar.
* **`BookmarkCard.tsx`**: Add sticky note indicator badge and quick-view drawer.
* **`EditBookmarkModal.tsx`**: Add a dedicated Markdown editor textarea for `personal_note`.

---

## 3. System-Aware Dark Mode & OLED True-Black Theme

### 🎯 Motivation & Value
Reading articles at night in bright light strains the eyes. On mobile OLED screens (iPhones and modern Androids), pure true-black (`#000000`) pixels turn off completely, saving significant battery and offering a sleek aesthetic.

---

### 📱 User Experience (UX) Walkthrough
1. **Three-Way Mode Toggle**: In the navigation bar (and settings), a quick toggle offers:
   * ☀️ **Light Mode** (Orderful Modern cream `#f5f5f5` background, pure white cards)
   * 🌙 **Dark Mode** (Slate `#121212` background, `#1c1c1e` cards)
   * 📱 **Auto / System Default** (Automatically syncs with iOS / macOS system appearance)
2. **Smooth Theme Transition**: 0.2s CSS variable transition preventing harsh screen flashes.
3. **Contrast-Tuned Typography**: Text contrast ratios tuned to WCAG AA / AAA standards (off-white `#e5e5e5` on dark surfaces rather than harsh `#ffffff` to eliminate eye fatigue).

```
┌────────────────────────────────────────────────────────┐
│  🔖 Slip    [Search Archive...]    ☀️ 🌙 ⚙️  [+ Save]   │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌───────────────────────┐  ┌───────────────────────┐  │
│  │ 🖼️ Dark Slate Card    │  │ 🖼️ Dark Slate Card    │  │
│  │ #1c1c1e Surface       │  │ #1c1c1e Surface       │  │
│  │ Border: #2c2c2e       │  │ Border: #2c2c2e       │  │
│  └───────────────────────┘  └───────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

### 🛠️ Technical Implementation Plan

#### 1. CSS Custom Properties Design Tokens (`frontend/src/index.css`)
Refactor `:root` tokens to support `[data-theme="dark"]` and `@media (prefers-color-scheme: dark)`:

```css
:root {
  /* Default Light Tokens */
  --color-background: #f5f5f5;
  --color-surface: #ffffff;
  --color-tertiary: #f0f0f0;
  --color-border: #e9e9e9;
  --color-on-surface: #000000;
  --color-muted: #4f5b6b;
  --color-primary: #e42b0c;
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.04);
  --shadow-card-hover: 0 6px 16px rgba(0, 0, 0, 0.07);
}

[data-theme="dark"] {
  /* OLED True-Black & Midnight Slate Tokens */
  --color-background: #0d0e11;
  --color-surface: #17181c;
  --color-tertiary: #22242a;
  --color-border: #292b33;
  --color-on-surface: #f1f1f3;
  --color-muted: #8e94a0;
  --color-primary: #ff4726;
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.35);
  --shadow-card-hover: 0 6px 16px rgba(0, 0, 0, 0.55);
}
```

#### 2. Theme Provider & Hook (`frontend/src/hooks/useTheme.ts`)
* Stores preference in `localStorage.getItem('slip_theme')` (`'light' | 'dark' | 'system'`).
---

## 4. Recycle Clip (Recycle Bin, Safe Restore & Empty Bin)

### 🎯 Motivation & Value
Accidental deletion creates anxiety. In a knowledge archive, deleting a slip shouldn't immediately vanish content from reality without recourse. The **Recycle Clip** provides a non-destructive soft-delete safety net where deleted slips can be instantly undone via a quick toast notification, safely restored back to their original Clip & Tags, or permanently eradicated through a safe confirmation modal.

---

### 📱 User Experience (UX) Walkthrough
1. **Move to Recycle Clip**:
   * On any slip card, clicking the dropdown and selecting **"Move to Recycle Clip"** removes the card from active feeds, searches, and clip views.
2. **Instant Undo Toast**:
   * A 6-second floating toast notification appears at the bottom-right: *"Slip moved to Recycle Clip"* with a 1-click **"Undo"** button that immediately restores the slip without navigating away.
3. **Specialized Recycle Clip in Clips View**:
   * In the **Clips** view, a dedicated **"Recycle Clip"** tile shows the count of trashed slips.
   * Clicking it opens the **Recycle Clip** manager, with:
     * A header displaying trashed slip count and an **"Empty Recycle Clip"** button.
     * Trashed slip cards with direct **"Restore Slip"** and **"Delete Permanently"** actions.
4. **Safe Empty Confirmation Modal**:
   * Clicking "Empty Recycle Clip" triggers a modal confirming the exact number of slips that will be permanently eradicated, preventing accidental bulk data loss.

---

### 🛠️ Technical Implementation Plan

#### 1. Database Schema Additions (`backend/src/db.ts`)
```sql
ALTER TABLE bookmarks ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS idx_bookmarks_deleted ON bookmarks(user_id, deleted_at);
```

#### 2. Backend REST Endpoints (`backend/src/routes/bookmarks.ts` & `backend/src/routes/clips.ts`)
* `DELETE /api/bookmarks/:id`: Soft deletes slip (`deleted_at = datetime('now')`, `is_pinned = 0`).
* `GET /api/bookmarks/recycle-clip`: Retrieves all soft-deleted slips for current user.
* `POST /api/bookmarks/:id/restore`: Restores soft-deleted slip (`deleted_at = NULL`).
* `DELETE /api/bookmarks/:id/permanent`: Hard deletes bookmark and removes cached assets.
* `POST /api/bookmarks/recycle-clip/empty`: Hard deletes all soft-deleted bookmarks for the user.
* Active queries filter `WHERE b.deleted_at IS NULL`.

#### 3. Frontend Integration
* **`BookmarkCard.tsx`**: Updated dropdown with "Move to Recycle Clip" and Recycle mode actions ("Restore Slip", "Delete Permanently").
* **`ClipsView.tsx`**: Special "Recycle Clip" tile and management view.
* **`App.tsx`**: Instant Undo Toast and Safe Empty Confirmation Modal.

---

## 5. Implementation Sequence & Timeline

| Phase | Feature | Key Deliverables | Est. Effort |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Dark Mode & OLED Theme** | CSS design tokens, 3-state toggle component, iOS status bar meta updater. | 1 Sprint |
| **Phase 2** | **Browser Extension & iOS Shortcut** | Chrome/Firefox MV3 extension bundle, popup HUD, options config page, iOS shortcut template. | 1-2 Sprints |
| **Phase 3** | **Highlights & Sticky Notes** | Database migration, FTS5 triggers update, Reader Mode text selection toolbar, card note preview. | 2 Sprints |
| **Phase 4** | **Recycle Clip (Recycle Bin)** | Soft delete schema migration, restore/empty endpoints, Recycle Clip UI, Instant Undo Toast, Safe Empty modal. | 1 Sprint |


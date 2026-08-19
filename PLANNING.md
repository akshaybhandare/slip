# PAUL Implementation Plan: Clip Organization System for Slip

## 1. Overview & Objective
Implement a folder-like organization system called **"Clips"** for Slips (bookmarks, cards, notes, documents, images).
- **Core Concept**: A "Clip" is a collection/folder container.
- **Nesting**: Clips can be nested arbitrarily (e.g. `Hobbies` > `3D Printing` > Cards/Slips).
- **Membership**: Cards (slips) can be added to and removed from clips (a slip can belong to multiple clips).
- **UI Non-Invasive**: The default main visual stream view remains 100% unchanged. The Clips organization view is an additional view hidden by default and accessible via a clean toggle or drawer/navigator.
- **Card Actions**: Users can assign any card to one or more clips directly via card actions or a modal.

---

## 2. Architecture & Design Decisions

### 2.1 Database Schema (SQLite)
1. **`clips` Table**:
   - `id INTEGER PRIMARY KEY AUTOINCREMENT`
   - `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`
   - `name TEXT NOT NULL`
   - `parent_id INTEGER REFERENCES clips(id) ON DELETE CASCADE` (NULL for root clips)
   - `created_at TEXT DEFAULT (datetime('now'))`
   - `updated_at TEXT DEFAULT (datetime('now'))`
   - Indexes on `(user_id)` and `(parent_id)`.

2. **`clip_bookmarks` Table**:
   - `clip_id INTEGER NOT NULL REFERENCES clips(id) ON DELETE CASCADE`
   - `bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE`
   - `created_at TEXT DEFAULT (datetime('now'))`
   - PRIMARY KEY (`clip_id`, `bookmark_id`)
   - Index on `(bookmark_id)` for reverse lookups.

### 2.2 Backend Endpoints (`/api/clips`)
- `GET /api/clips`: Retrieve all clips for the authenticated user with item count & subclip count.
- `POST /api/clips`: Create a new clip (`{ name, parent_id? }`).
- `GET /api/clips/:id`: Retrieve single clip details, full breadcrumbs path, child subclips, and contained bookmarks.
- `PUT /api/clips/:id`: Rename or move a clip (`{ name?, parent_id? }`), with cycle-prevention validation.
- `DELETE /api/clips/:id`: Delete a clip (cascades to subclips and associations).
- `POST /api/clips/:id/bookmarks`: Add bookmark(s) to a clip (`{ bookmark_id }` or `{ bookmark_ids }`).
- `DELETE /api/clips/:id/bookmarks/:bookmarkId`: Remove a bookmark from a clip.
- `GET /api/bookmarks/:id/clips`: Fetch all clip IDs and names containing a specific bookmark.
- `PUT /api/bookmarks/:id/clips`: Set the assigned clips for a bookmark in one step (`{ clip_ids }`).

### 2.3 Frontend UI/UX Design
1. **Hidden by Default**:
   - The main feed remains identical: all cards, filter tabs, AI search, standard search.
   - An intuitive **"Clips"** action is added to the top navigation (with a clean folder/clip icon and counter).
2. **Clips View / Browser**:
   - Accessible by toggling the Clips view from the navbar or filter tabs.
   - Shows breadcrumbs for easy navigation: `Clips > Hobbies > 3d-printing-clip`.
   - Displays sub-clips as visual folder cards (showing sub-clip count, card count, quick rename/delete actions).
   - Displays all slips/cards belonging to the current clip in the familiar MasonryGrid layout.
   - Easy "+ New Clip" button to create root or nested clips instantly.
   - Back button / Close button to exit back to the main visual stream instantly.
3. **Card Assignment Modal ("Add to Clip")**:
   - Accessible from the `...` menu on any `BookmarkCard`.
   - Allows selecting existing clips (with nested path display) or creating a new clip on the fly.

---

## 3. Step-by-Step Execution Plan

### Step 1: Database Migration & Schema Setup [COMPLETED]
- Updated `backend/src/db.ts` to create `clips` and `clip_bookmarks` tables and indexes.
- Verified schema in `backend/src/__tests__/db.test.ts`.

### Step 2: Backend Routes & Logic (`backend/src/routes/clips.ts`) [COMPLETED]
- Implemented full CRUD operations, hierarchical breadcrumbs, cycle detection for moves, and bookmark assignment.
- Mounted `/api/clips` in `backend/src/server.ts`.
- Wrote comprehensive integration tests in `backend/src/__tests__/clips.test.ts` (13/13 passing).

### Step 3: Frontend API & Types [COMPLETED]
- Added `Clip`, `ClipDetail`, and breadcrumb types in `frontend/src/types.ts`.
- Added client helper functions in `frontend/src/api.ts`.

### Step 4: Frontend UI Components [COMPLETED]
- Created `frontend/src/components/ClipsView.tsx`: Full hierarchical folder & bookmark browser with breadcrumbs, sub-clip creation, and card display.
- Created `frontend/src/components/AddToClipModal.tsx`: Card assignment modal to add/remove slips from clips.
- Updated `frontend/src/components/BookmarkCard.tsx` to include "Organize in Clips" in the dropdown menu.
- Updated `frontend/src/components/Navbar.tsx` and `frontend/src/App.tsx` to add the Clips view toggle and state management.
- Updated `frontend/src/index.css` with clean, modern styling consistent with Slip's design language (dark mode + light mode).

### Step 5: Verification & Tests [COMPLETED]
- All 103 backend test suites and integration tests passed (`npm test` in backend).
- All 54 frontend unit and component tests passed (`npm test` in frontend).
- Production builds succeed with zero type errors (`tsc && vite build`).

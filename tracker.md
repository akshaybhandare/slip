# Project Tracker: Slip

This document tracks the workable stories and tasks for the development of **Slip**.

## Development Workflow
For each story:
1. Take up the uncompleted story.
2. Implement the story code.
3. Write comprehensive test cases (unit/integration).
4. Review the story implementation against the PRD and tasks.
5. Request an IRL review from the user.
6. Implement feedback/changes if requested by the user.
7. When the user says "all ok go ahead", mark the story as **Closed**.

---

## Story Board

### Story 1: Project Scaffolding & Initial Setup
*   **Status**: Closed
*   **Tasks**:
    *   [x] **Task 1.1**: Initialize Node.js TypeScript workspace (`package.json`, `tsconfig.json`, linters, build configuration).
    *   [x] **Task 1.2**: Set up SQLite schema migration logic and write DDL execution scripts.
    *   [x] **Task 1.3**: Configure basic server bootstrap (Express app, TypeScript runner, health check API, standard logging).
    *   [x] **Task 1.4**: Write unit tests verifying database connection and tables generation.

### Story 2: User Authentication & Session Management
*   **Status**: Closed
*   **Tasks**:
    *   [x] **Task 2.1**: Implement user registration and login endpoints (passwords hashed using `bcrypt`).
    *   [x] **Task 2.2**: Set up cookie-based session management using secure signed cookies (`HttpOnly`, `Secure`, `SameSite=Lax`).
    *   [x] **Task 2.3**: Implement API key schema, token generator, and Bearer token auth middleware.
    *   [x] **Task 2.4**: Write integration tests validating registration, login, logout, session expiration, and Bearer token auth.

### Story 3: Scraping Engine & Readability Service
*   **Status**: Closed
*   **Tasks**:
    *   [x] **Task 3.1**: Build Open Graph and HTML metadata scraper (using `axios` and `cheerio` with timeouts/limits).
    *   [x] **Task 3.2**: Integrate readability parsing and HTML sanitization (`sanitize-html`).
    *   [x] **Task 3.3**: Implement a rate-limited background job queue (SQLite/memory-based, max 2 concurrent scrapes).
    *   [x] **Task 3.4**: Write unit tests for metadata extraction, readability content parsing, and queue rate limits.

### Story 4: Bookmark CRUD & Local Thumbnail Cache
*   **Status**: Closed
*   **Tasks**:
    *   [x] **Task 4.1**: Implement REST API routes for bookmark CRUD operations with strict user data isolation.
    *   [x] **Task 4.2**: Implement local thumbnail caching (SHA-256 filenames, scaling utility, path traversal sanitization checks).
    *   [x] **Task 4.3**: Implement manual tag association logic in a single transaction.
    *   [x] **Task 4.4**: Write integration tests checking CRUD constraints, visual cache directories, and transaction rollbacks.

### Story 5: Search & Public Shareables
*   **Status**: Closed
*   **Tasks**:
    *   [x] **Task 5.1**: Initialize SQLite FTS5 index mapping and insert/update triggers to synchronize indices.
    *   [x] **Task 5.2**: Build full-text search endpoint using FTS5 MATCH syntax matching title, snippet, and raw text.
    *   [x] **Task 5.3**: Implement tokenized shareable links endpoints (`shared_links`, `shared_tags`) enabling read-only access.
    *   [x] **Task 5.4**: Write integration tests verifying search terms relevance and shared link access.

### Story 6: Netscape HTML Import & Export
*   **Status**: Closed
*   **Tasks**:
    *   [x] **Task 6.1**: Build parser for Netscape HTML bookmark format imports (extracting URLs, titles, folder tags).
    *   [x] **Task 6.2**: Implement batch bookmark importing (queueing imports safely into the scraping job queue).
    *   [x] **Task 6.3**: Implement bookmark export endpoint generating standard Netscape HTML document.
    *   [x] **Task 6.4**: Write unit tests for HTML file upload parsing and export generation.

### Story 7: Frontend SPA & Design System
*   **Status**: Closed
*   **Tasks**:
    *   [x] **Task 7.1**: Setup Vite + React (TypeScript) frontend application and set up HSL variable design system.
    *   [x] **Task 7.2**: Build responsive visual Masonry grid displaying cards dynamically.
    *   [x] **Task 7.3**: Build Auto-Categorization filter tabs (All, Articles, Images, Products, Videos, Websites) and top search bar.
    *   [x] **Task 7.4**: Build registration/login forms, quick bookmark adder, and Reader Mode preview modal overlay.
    *   [x] **Task 7.5**: Write frontend unit tests for card layout components, API fetchers, and auth forms.

### Story 8: Docker Packaging & Unraid Host Configuration
*   **Status**: Closed
*   **Tasks**:
    *   [x] **Task 8.1**: Create optimized multi-stage Dockerfile using Node.js Alpine base.
    *   [x] **Task 8.2**: Write permission wrapper entrypoint `docker-entrypoint.sh` to map `PUID`/`PGID` host-container files.
    *   [x] **Task 8.3**: Write `docker-compose.yml` defining port exposure, volume mounts, and log rotation sizes.
    *   [x] **Task 8.4**: Run automated validation check of Docker runtime permissions and compose container status.

### Story 9: Dark Mode & OLED True-Black Theme
*   **Status**: Completed
*   **Tasks**:
    *   [x] **Task 9.1**: Define CSS custom properties for `[data-theme="dark"]` in `frontend/src/index.css` (tokens, background, surface, borders, text contrast, shadows).
    *   [x] **Task 9.2**: Create `useTheme` hook with persistence (`localStorage`), 3-state toggle (Light ☀️, Dark 🌙, System 📱), and `matchMedia` system preference listener.
    *   [x] **Task 9.3**: Add theme toggle button to navigation bar and synchronize iOS `<meta name="theme-color">` dynamically.
    *   [x] **Task 9.4**: Write unit/UI tests verifying theme switching, persistence, and CSS class toggling.

### Story 10: Zero-Friction Ingestion (Browser Extension & iOS Shortcut)
*   **Status**: Completed
*   **Tasks**:
    *   [x] **Task 10.1**: Build Manifest V3 browser extension (`extension/manifest.json`, `popup.html`, `popup.js`, `options.html`, `options.js`) with keyboard shortcut `Cmd+Shift+S`.
    *   [x] **Task 10.2**: Implement extension HUD popup with instant save, tag suggestions, and direct API key authorization against the self-hosted server.
    *   [x] **Task 10.3**: Create iOS Apple Shortcut template & instructions for 1-tap background sharing from mobile share sheets (Twitter, YouTube, Reddit, Safari).
    *   [x] **Task 10.4**: Add backend automated tests & extension build scripts for packing extension `.zip` distribution.

### Story 11: Reader Highlights & Personal Sticky Notes
*   **Status**: Completed
*   **Tasks**:
    *   [x] **Task 11.1**: Add `personal_note` column to `bookmarks` table and create `highlights` table in SQLite schema with cascade deletion.
    *   [x] **Task 11.2**: Update SQLite `bookmarks_fts` FTS5 virtual table and triggers to index `personal_note` for full-text search.
    *   [x] **Task 11.3**: Implement backend REST endpoints (`PUT /api/bookmarks/:id/note`, `GET /api/bookmarks/:id/highlights`, `POST /api/bookmarks/:id/highlights`, `DELETE /api/highlights/:id`).
    *   [x] **Task 11.4**: Build text selection floating toolbar and highlights aggregator sidebar in `ReaderModal.tsx`.
    *   [x] **Task 11.5**: Build sticky note preview drawer and quick editor in `BookmarkCard.tsx` and `EditBookmarkModal.tsx`.
    *   [x] **Task 11.6**: Write comprehensive backend tests and frontend UI tests for notes and highlights.

### Story 12: Smart Search (Semantic Similarity Search Engine)
*   **Status**: Completed (Code Frozen)
*   **Tasks**:
    *   [x] **Task 12.1**: Implement strengthened `SMART_SEARCH_SYSTEM_PROMPT` and `performSmartSearch` in `backend/src/services/aiService.ts` supporting OpenAI, Claude, Gemini, and Custom/OpenRouter/Ollama LLMs.
    *   [x] **Task 12.2**: Add `GET /api/bookmarks/search?smart=true` and `GET /api/bookmarks/smart-search` REST endpoints with user data isolation, FTS5 candidate pre-filtering, and compound/hyphen query sanitization.
    *   [x] **Task 12.3**: Build Enter-to-search interaction, responsive loading indicators, and Smart Search toggle button (✨) with dynamic conversational search placeholder in `frontend/src/components/Navbar.tsx`.
    *   [x] **Task 12.4**: Render AI semantic relevance match badges with percentage score, hover tooltip, and interactive click-to-expand explanation toggle on `frontend/src/components/BookmarkCard.tsx`.
    *   [x] **Task 12.5**: Add graceful provider error catching with automatic fallback to keyword search and dismissible warning banners in `frontend/src/App.tsx`.
    *   [x] **Task 12.6**: Write comprehensive backend and frontend test suites (90 backend tests + 45 frontend tests) for natural language semantic queries, data isolation, and UI toggling.


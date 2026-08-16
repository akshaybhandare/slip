# Slip — Project Handover & Deployment Guide

> **Slip** is a high-performance, self-hosted visual bookmark archive and reading space inspired by *mymind*. Built with modern Node.js/TypeScript, SQLite (WAL mode with FTS5 full-text indexing), and React.

---

## 1. Architecture Overview

```
                          ┌────────────────────────┐
                          │   Client / Browser     │
                          │   (Desktop & Mobile)   │
                          └───────────┬────────────┘
                                      │ HTTP / Cookie / Bearer
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Docker Container (Port 3000)                    │
│                                                                        │
│  ┌────────────────────────┐         ┌───────────────────────────────┐  │
│  │   React 18 SPA (Vite)  │ ◄───────┤     Express Backend (TS)      │  │
│  │   Orderful Modern UI   │ Static  │  - Session & API Key Auth     │  │
│  │   Tag System & Masonry │         │  - Scraper & Queue (2 workers)│  │
│  └────────────────────────┘         │  - Full-Text Search (FTS5)    │  │
│                                     │  - Netscape HTML Import/Export│  │
│                                     └───────┬──────────────┬────────┘  │
│                                             │              │           │
│                                             ▼              ▼           │
│                                     ┌──────────────┐ ┌──────────────┐  │
│                                     │ bookmarks.db │ │ Cache Dir    │  │
│                                     │ (SQLite WAL) │ │ (Thumbnails) │  │
│                                     └───────┬──────┘ └──────┬───────┘  │
└─────────────────────────────────────────────┼───────────────┼──────────┘
                                              ▼               ▼
                              /mnt/user/appdata/slip:/config (Unraid Volume)
```

---

## 2. Unraid & Docker Deployment

Slip is packaged with an Alpine-based multi-stage `Dockerfile` and `docker-entrypoint.sh` supporting Unraid's `PUID`/`PGID` host-container permission mapping.

### Quick Start with Docker Compose

```yaml
version: '3.8'

services:
  slip:
    image: slip:latest
    build:
      context: .
      dockerfile: Dockerfile
    container_name: slip
    restart: unless-stopped
    ports:
      - "${HOST_PORT:-3000}:${PORT:-3000}"
    volumes:
      - /mnt/user/appdata/slip:/config
    environment:
      - NODE_ENV=${NODE_ENV:-production}
      - PORT=${PORT:-3000}
      - HOST=${HOST:-0.0.0.0}
      - DB_PATH=${DB_PATH:-/config/bookmarks.db}
      - CACHE_DIR=${CACHE_DIR:-/config/cache}
      - PUID=${PUID:-99}
      - PGID=${PGID:-100}
      - COOKIE_SECURE=${COOKIE_SECURE:-false}
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:${PORT:-3000}/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Starting the Container

```bash
# Build and run container in detached mode
docker compose up -d

# Check real-time logs
docker compose logs -f

# Verify container health
curl -f http://localhost:3000/health
```

---

## 3. Configuration & Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `HOST_PORT` | `3000` | Port on your host/Unraid to access Slip (e.g. `3080`). |
| `PORT` | `3000` | Port on which the HTTP server listens inside the container. |
| `HOST` | `0.0.0.0` | Bind host address. |
| `NODE_ENV` | `production` | Node runtime environment (`production`, `development`, `test`). |
| `DB_PATH` | `/config/bookmarks.db` | Path to the SQLite database file on host/container storage. |
| `CACHE_DIR` | `/config/cache` | Path where local thumbnail images are cached and served. |
| `FRONTEND_DIST`| `/app/frontend/dist` | Path to compiled React SPA static distribution. |
| `PUID` | `99` | User ID for file permissions (Unraid `nobody` default). |
| `PGID` | `100` | Group ID for file permissions (Unraid `users` default). |
| `COOKIE_SECURE` | `false` | Set to `true` if hosting behind an HTTPS reverse proxy. |

---

## 4. API Endpoints Reference

### Authentication (`/api/auth`)
* `GET /api/auth/status` — Returns `{ initialized: boolean }` (false if no admin user exists yet).
* `POST /api/auth/register` — Registers the first user as Admin (or creates new users if logged in as Admin).
* `POST /api/auth/login` — Authenticates credentials and sets HTTP-only signed session cookie.
* `GET /api/auth/me` — Returns current authenticated user profile.
* `POST /api/auth/logout` — Destroys session cookie.
* `POST /api/auth/keys` — Generates a new permanent API Key (Bearer token).
* `GET /api/auth/keys` — Lists metadata for generated API keys.
* `DELETE /api/auth/keys/:id` — Revokes an active API key.

### Bookmarks & Content (`/api/bookmarks`)
* `GET /api/bookmarks` — Lists user bookmarks (supports `?type=article|video|product|image|website` and `?tag=name`).
* `GET /api/bookmarks/search?q=query` — Full-text search across titles, descriptions, reader text, and tags using SQLite FTS5.
* `POST /api/bookmarks` — Scrapes and archives a new bookmark (`{ url, tags }`).
* `PUT /api/bookmarks/:id` — Updates title, description, category, and tags.
* `POST /api/bookmarks/:id/rescrape` — Re-scrapes metadata, OpenGraph tags, and cover images for a single bookmark.
* `POST /api/bookmarks/rescrape-all` — Triggers a global background batch re-scrape for all user bookmarks.
* `DELETE /api/bookmarks/:id` — Deletes a bookmark and its associated tag links.
* `GET /api/bookmarks/tags` — Returns user-scoped tags with usage counts.

### Public Shareables (`/api/share`)
* `POST /api/share/bookmark/:id` — Creates a public, unauthenticated read-only token link.
* `GET /api/share/public/bookmark/:token` — Read-only public endpoint to view a shared bookmark and reader article.
* `DELETE /api/share/bookmark/:id` — Revokes a shared bookmark link.
* `POST /api/share/tag/:id` — Generates a public collection link for a tag.
* `GET /api/share/public/tag/:token` — Read-only access to bookmarks in a shared tag collection.
* `DELETE /api/share/tag/:id` — Revokes a shared tag collection link.

### Netscape HTML Import & Export (`/api/io`)
* `POST /api/io/import` — Batch imports bookmarks from standard Netscape HTML files (Chrome, Safari, Firefox, Edge, Raindrop).
* `GET /api/io/export` — Downloads user bookmarks formatted as standard Netscape HTML.

---

## 5. Development & Testing Commands

### Backend (`cd backend`)
```bash
# Run unit & integration tests (47 tests across 7 test suites)
npm test

# Run development server with hot-reload
npm run dev

# Compile TypeScript to JavaScript (dist/)
npm run build

# Start compiled production server
npm start
```

### Frontend (`cd frontend`)
```bash
# Run frontend UI tests (6 tests in Vitest)
npm test

# Run Vite development server
npm run dev

# Build production frontend bundle (dist/)
npm run build
```

---

## 6. Storage & Database Backup

* **Single-File Backup**: The entire state of Slip is stored in `/config` (or `/mnt/user/appdata/slip`).
* **Hot Backup**: Because SQLite is running in **WAL mode** (`PRAGMA journal_mode = WAL;`), you can safely back up `bookmarks.db` while the container is running:
  ```bash
  sqlite3 /mnt/user/appdata/slip/bookmarks.db ".backup '/mnt/user/backups/slip_backup.db'"
  ```
* **Restore**: Copy your backup file back to `/mnt/user/appdata/slip/bookmarks.db` and restart the container.

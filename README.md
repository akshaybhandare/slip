<div align="center">

# 🔖 Slip

**A lightning-fast, self-hosted visual bookmark archive and reading space.**  
*Inspired by mymind. Built for self-hosters, creators, and researchers.*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL%20%2B%20FTS5-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Unraid](https://img.shields.io/badge/Unraid-Compatible-F15A24?logo=unraid&logoColor=white)](https://unraid.net/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

## 🌟 Highlights

* **🎨 Orderful Modern Visual Archive**: Clean, high-density stream masonry grid that organizes articles, videos, design inspiration, products, and notes with zero layout glitching.
* **📱 Mobile-First Architecture**: 2-column mobile streams, thumb-friendly slide-up bottom sheets, touch-scrolling filter chips, and a quick-save floating action button (FAB).
* **🧠 Smart Scraping Engine**: Automatically extracts OpenGraph tags, JSON-LD structured schemas, article text, and falls back to full-page screenshots when anti-bot firewalls block metadata.
* **⚡ Instant FTS5 Search**: Full-text indexing across bookmark titles, descriptions, reader text, domain names, and tags.
* **📖 Built-in Reader Mode**: Distraction-free article reader with sanitized HTML, custom typography, and zero ads or trackers.
* **🏷️ Interactive Tag System**: Quick-tag saved links with keyboard autocompletion and one-tap saved tag reuse suggestions (`+ #tag`).
* **📦 Netscape HTML Import & Export**: Import from Chrome, Safari, Firefox, Edge, and Raindrop, or export your entire archive anytime.
* **🔗 Public Shareables**: Generate secure read-only public tokens for individual bookmarks or curated tag collections.
* **🛡️ Self-Hosted & Private**: Single SQLite database file with WAL mode, running completely on your own hardware or server.

---

## 🏗️ Architecture

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

## 🚀 Quick Start with Docker Compose

Create a `docker-compose.yml` file:

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
      - ./config:/config
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

Start the container:

```bash
docker compose up -d
```

Open [**`http://localhost:3000`**](http://localhost:3000) in your browser. The first registered user is automatically provisioned as the primary Administrator.

---

## 🖥️ Unraid Server Deployment

1. **Create Appdata Directory**:
   ```bash
   mkdir -p /mnt/user/appdata/slip
   ```

2. **Template / Compose Settings**:
   * **Host Port**: `3000` -> **Container Port**: `3000`
   * **Host Path**: `/mnt/user/appdata/slip` -> **Container Path**: `/config`
   * **Variables**:
     * `PUID`: `99` (Unraid default `nobody`)
     * `PGID`: `100` (Unraid default `users`)
     * `NODE_ENV`: `production`

3. The container's built-in `docker-entrypoint.sh` automatically ensures all files in `/config` are owned by `PUID:PGID` so you never encounter permission errors on Unraid array shares.

---

## 💻 Local Development

### Prerequisites
* Node.js 20+
* npm

### 1. Setup Backend
```bash
cd backend
npm install
npm run dev
```
*Backend runs on `http://localhost:3000`.*

### 2. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173` with automatic API proxying to backend.*

---

## 🧪 Testing

Slip has complete test coverage across both frontend and backend suites:

```bash
# Run backend test suite (47 tests: SQLite, FTS5, Auth, Scraper, Queue, Netscape IO)
cd backend && npm test

# Run frontend UI tests (6 tests: TagInput, Responsive Masonry, Mobile FAB, Sync)
cd frontend && npm test
```

---

## ⚙️ Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `HOST_PORT` | `3000` | Port on your host/Unraid to access Slip (e.g. `3080`). |
| `PORT` | `3000` | Port for the HTTP server inside the container. |
| `HOST` | `0.0.0.0` | Bind host address. |
| `NODE_ENV` | `production` | Node environment (`production`, `development`, `test`). |
| `DB_PATH` | `/config/bookmarks.db` | Absolute path to SQLite database. |
| `CACHE_DIR` | `/config/cache` | Directory where thumbnails and screenshots are cached. |
| `PUID` | `99` | Process user ID for Unraid file permissions. |
| `PGID` | `100` | Process group ID for Unraid file permissions. |
| `COOKIE_SECURE` | `false` | Set to `true` if hosting behind an HTTPS reverse proxy. |

---

## 📄 License

MIT © [Akshay Bhandare](https://github.com/akshaybhandare)

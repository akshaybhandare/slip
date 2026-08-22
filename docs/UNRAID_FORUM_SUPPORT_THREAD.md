# [Support] AkshayBhandare - Slip

**Slip** is a lightning-fast, self-hosted visual bookmark archive and reading space (inspired by mymind). Built specifically for self-hosters and home-lab enthusiasts to run cleanly on Unraid.

---

## 🔗 Links & Resources

* **GitHub Repository**: [https://github.com/akshaybhandare/slip](https://github.com/akshaybhandare/slip)
* **Unraid Template Repository**: [https://github.com/akshaybhandare/unraid-slip](https://github.com/akshaybhandare/unraid-slip)
* **Bug Tracker & Issues**: [https://github.com/akshaybhandare/slip/issues](https://github.com/akshaybhandare/slip/issues)
* **Docker Container Registry**: `ghcr.io/akshaybhandare/slip:latest`
* **User Guide**: [USER_GUIDE.md](https://github.com/akshaybhandare/slip/blob/main/USER_GUIDE.md)

---

## 🌟 Features Overview

* **🎨 Orderful Modern Visual Archive**: High-density stream masonry grid that cleanly organizes articles, videos, images, design inspiration, products, and notes.
* **📱 Mobile-First Design**: 2-column mobile stream, slide-up bottom sheets, touch-scrolling chips, and quick-save FAB.
* **⚡ Instant FTS5 Search**: High-speed full-text indexing over titles, descriptions, reader text, domain names, and tags.
* **✨ AI Smart Search (Optional / BYO-AI)**: Natural language conversational search (supports OpenAI, Claude, Gemini, Ollama, OpenRouter). *When no AI key is entered, all AI features are completely invisible and Slip runs lightweight.*
* **✨ "Put Where It Belongs" (AI Recommendation)**: Intelligently suggests relevant Clips for newly saved slips with 1-click filing.
* **📁 Clips (Hierarchical Folders)**: Organize cards into nested collections and sub-clips without cluttering the main stream.
* **♻️ Recycle Clip (Soft Delete & Restore)**: Non-destructive deletion with 6-second Instant Undo toast, optimistic UI updates, and safe permanent purge confirmations.
* **📖 Distraction-Free Reader Mode**: Clean typography, sanitized HTML, zero ads/trackers, with personal text highlights and notes.
* **📦 Netscape HTML Import & Export**: 1-click import from Chrome, Safari, Firefox, Edge, or Raindrop.
* **🛡️ Private & Persistent**: Single SQLite WAL database + local image thumbnail cache in `/config`.

---

## ⚙️ Default Unraid Template Configuration

| Setting | Container Value | Recommended Host Value | Description |
| :--- | :--- | :--- | :--- |
| **WebUI Port** | `3000` | `3000` (or `3080`) | Web interface port |
| **Appdata Storage** | `/config` | `/mnt/user/appdata/slip` | Persistent SQLite DB & cache |
| **PUID** | `99` | `99` | Unraid default (`nobody`) |
| **PGID** | `100` | `100` | Unraid default (`users`) |
| **NODE_ENV** | `production` | `production` | Production environment |

---

## ❓ Frequently Asked Questions (FAQ)

### 1. Where is my database stored?
All database files (`bookmarks.db`, `bookmarks.db-wal`, `bookmarks.db-shm`) and cached thumbnails are located in `/mnt/user/appdata/slip`. You can easily back up this single folder using the CA Appdata Backup plugin.

### 2. Can I use Slip completely offline or without AI?
**Yes!** Slip is 100% functional without any AI services. When no AI API key is configured, Slip operates as a pure local SQLite FTS5 visual bookmarking archive.

### 3. How do I report issues or feature requests?
Please submit issues and feature requests directly to the [Slip GitHub Issues](https://github.com/akshaybhandare/slip/issues) page or reply to this support thread!

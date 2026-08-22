# Slip v1.0.0 Release Notes 🚀

We are thrilled to announce the official **v1.0.0** release of **Slip** — a lightning-fast, self-hosted visual bookmark archive and reading space!

With this milestone release, Slip is now officially packaged and available on the **Unraid Community Applications** store!

---

## 🌟 What's New in v1.0.0

### 🎨 Visual & Frontend Experience
* **Orderful Modern Visual Archive**: Dynamic high-density masonry grid displaying bookmarks as visual cards with responsive layouts.
* **Mobile-First UX**: Responsive 2-column mobile streams, thumb-accessible slide-up bottom sheets, touch-scrolling filter chips, and floating action button (FAB).
* **System-Aware Dark Mode**: 3-state theme switcher (Light ☀️, Dark 🌙, System 📱) with OLED true-black styling and WCAG AA/AAA contrast tuning.
* **Distraction-Free Reader Mode**: Clean typography, sanitized HTML, zero ads/trackers, with personal text highlights and notes.

### ⚡ Search, Organization & Recycle Bin
* **SQLite WAL & FTS5 Full-Text Search**: Sub-millisecond full-text queries across titles, descriptions, reader text, domain names, and personal notes.
* **Clips (Hierarchical Folders)**: Organize cards into nested collections and sub-clips without cluttering the main stream.
* **Recycle Clip & Safe Deletion**: Non-destructive soft-deletion with a 6-second Instant Undo floating toast, optimistic zero-wait updates, and safe permanent purge confirmations.

### 🤖 Optional Bring-Your-Own-AI (BYO-AI)
* **Smart Search**: Natural language semantic query parser matching concepts and synonyms with relevance scores and hover explanations.
* **"Put Where It Belongs"**: Instant contextual AI recommendation of relevant Clips for newly saved slips with 1-click filing.
* **AI Auto-Tagging**: Intelligently assigns tags while strictly reusing and prioritizing existing user tag vocabularies.
* **Zero-AI Disconnected Fallback**: When no AI API key is entered, all AI buttons, badges, and background calls remain completely invisible.

### 📦 Ingestion & Data Portability
* **Netscape HTML Import & Export**: One-click migration from Chrome, Safari, Firefox, Edge, and Raindrop.
* **Manifest V3 Browser Extension**: 1-click bookmarking HUD popup with tag suggestions and direct API key authentication.
* **iOS Share Sheet & Apple Shortcut**: 1-tap mobile background sharing from Safari, Twitter/X, Reddit, and YouTube.
* **Public Shareables**: Generate cryptographically random, read-only public tokens for individual bookmarks or tag collections.

### 🖥️ Deployment & Unraid
* **Unraid Community Applications (CA)**: Official 1-click template in the Unraid Apps tab.
* **Optimized Alpine Docker Image**: Multi-stage build with `PUID`/`PGID` host-container permission mapping.
* **Zero SaaS Dependencies**: 100% self-hosted, keeping all data, thumbnails, and databases strictly on your local hardware.

---

## 🛠️ Installation & Upgrades

### Unraid Community Applications
Search for **`Slip`** in the Unraid **Apps** tab and click **Install**.

### Docker Compose
```bash
docker pull ghcr.io/akshaybhandare/slip:v1.0.0
docker compose up -d
```

---

**Full Changelog**: https://github.com/akshaybhandare/slip/commits/v1.0.0

# Slip v1.1.0 Release Notes 🎨

We are excited to announce **Slip v1.1.0** — introducing rich multi-theme styling, a consolidated all-in-one settings hub, enhanced responsive layouts, and UI refinements!

---

## 🌟 What's New in v1.1.0

### 🎨 Multi-Theme Architecture & Dynamic Presets
* **Expanded Theme Presets**: Introducing a rich collection of curated theme options including Dark (OLED), Light, Dracula, Nord, Catppuccin, Forest, Monokai, Cyberpunk, Lavender, and Tokyo Night.
* **Instant Dynamic Switching**: Live theme application with reactive CSS variables without requiring page reload.
* **Persistent Preferences**: Seamless local persistence of selected themes across desktop and mobile sessions.

### ⚙️ Consolidated All-in-One Settings Hub
* **Unified Settings Modal**: Replaced disparate modals with a centralized tabbed settings manager:
  * **General Tab**: Application configuration, default view preferences, and system info.
  * **Themes Tab**: Visual theme preview selector and color palette customizer.
  * **AI / Integrations Tab**: Encrypted BYO-AI provider configuration, inline credential testing, and model selector.
  * **Account / Users Tab**: Multi-user account management and API keys.
* **Streamlined Navbar**: Clean navigation bar with single-click access to the unified settings suite.

### ♻️ UI Polishing & Recycle Bin Refinements
* **Enhanced Recycle Bin Actions**: Improved button contrast, responsive mobile action rows, and refined styling for trash management.
* **Modal & Input Adjustments**: Responsive modal dimensions, unified input heights, and cleaner mobile touch targets across screen sizes.

---

## 🛠️ Installation & Upgrades

### Docker Compose
```bash
docker pull ghcr.io/akshaybhandare/slip:v1.1.0
docker compose up -d
```

### Direct Pull (Latest)
```bash
docker pull ghcr.io/akshaybhandare/slip:latest
docker compose up -d
```

---

**Full Changelog**: https://github.com/akshaybhandare/slip/compare/v1.0.0...v1.1.0

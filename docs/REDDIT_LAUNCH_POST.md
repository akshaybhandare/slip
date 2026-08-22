# Reddit Launch Post Template (r/selfhosted & r/unraid)

**Post Title**:  
`Slip — A visual, self-hosted bookmark archive & reading space (inspired by mymind) is now live on Unraid Community Apps!`

---

**Post Body**:

Hey everyone! 👋

I built **Slip**, a lightweight, visual bookmarking archive and distraction-free reading space built specifically for self-hosters and home-lab setups. It is now officially available on the **Unraid Community Applications** store!

### 🎯 Why another bookmark manager?
Most bookmarking apps fall into one of two traps:
1. They treat bookmarks as endless lists of text links (like browser bookmarks from 2004).
2. They force you into spending hours maintaining rigid, multi-nested folder hierarchies.

Slip takes inspiration from the *purposeful disorganization / visual memory* approach: you save links, articles, products, design inspiration, and notes, and Slip turns them into rich visual cards that your brain naturally recognizes.

### ✨ Key Features:
* **🎨 Orderful Modern Visual Archive**: Dynamic masonry grid that organizes articles, videos, images, products, and notes.
* **📱 Mobile-First Design**: 2-column mobile streams, thumb-friendly slide-up bottom sheets, touch-scrolling filter chips, and a quick-save floating action button.
* **⚡ Instant FTS5 Search**: Full-text SQLite indexing across titles, descriptions, scraped reader content, domain names, and tags.
* **✨ AI Smart Search & "Put Where It Belongs" (Optional / BYO-AI)**: Natural language search ("*articles about sqlite performance optimization*") and automatic Clip suggestions. Supports OpenAI, Claude, Gemini, Ollama, OpenRouter. *If no AI key is entered, all AI features are completely invisible and Slip runs 100% lightweight and local.*
* **📁 Clips (Hierarchical Folders)**: Optional nested collections (e.g. `Hobbies` > `3D Printing` > Slips) that stay tucked away until you need them.
* **♻️ Recycle Clip (Soft Delete & Restore)**: Non-destructive deletion with 6-second Instant Undo toast, optimistic UI updates, and safe permanent purge confirmations.
* **📖 Built-in Reader Mode**: Clean typography, sanitized HTML, zero ads/trackers, with personal text highlights and notes.
* **📦 Netscape HTML Import & Export**: One-click import from Chrome, Safari, Firefox, Edge, and Raindrop.
* **🛡️ 100% Self-Hosted & Private**: Single SQLite database file with WAL mode, running completely inside an Alpine container on your home hardware.

### 🚀 Getting Started:
* **Unraid**: Search for `Slip` in the **Apps** tab and click Install!
* **Docker Compose**: Check the quickstart at [https://github.com/akshaybhandare/slip](https://github.com/akshaybhandare/slip)

**GitHub**: [https://github.com/akshaybhandare/slip](https://github.com/akshaybhandare/slip)  
**License**: MIT

I'd love to hear your feedback, thoughts, and feature suggestions!

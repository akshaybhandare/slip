# Slip — User Guide & Onboarding Manual

Welcome to **Slip**, a lightning-fast, self-hosted visual bookmark archive and reading space. This guide covers everything you need to know to get started, organize your content, connect artificial intelligence, and automate capture using our API and iOS Shortcuts.

---

## 📖 1. What is Slip?

Slip is a privacy-first web archive designed to capture, read, and search the things you want to remember (articles, design inspiration, videos, products, and notes). 

Unlike traditional bookmark managers that display a list of plain blue links, Slip saves a **visual card** for every item, extracts core text, creates local screenshot/thumbnail fallbacks, and keeps everything stored safely in a single SQLite database running on your own server.

---

## 📁 2. Organizing with Clips & Tags

Slip offers two primary ways to organize your saved items: **Tags** (flat, cross-cutting labels) and **Clips** (hierarchical folders).

### What is a "Clip"?
A **Clip** is a container that holds bookmark cards. Unlike traditional folders that clutter your interface, Clips are **hidden by default** to keep your main visual stream clean.
* **Hierarchical Structure**: You can nest Clips inside other Clips (e.g. `Hobbies` ➔ `3D Printing` ➔ `Slips`).
* **Pinning**: You can "pin" your favorite Clips to the sidebar or top navigation for 1-click access.
* **Smart Filtering**: Clicking a Clip shows only the bookmarks assigned to that collection and its sub-clips.

### The Tag System
* **Quick Tagging**: When editing a card, type `#` to see auto-completed suggestions based on your existing vocabulary.
* **Interactive Chips**: Tap tag pills on cards to instantly filter your main feed.

---

## 🤖 3. Connecting your own AI (BYO-AI)

Slip supports a **Bring Your Own AI (BYO-AI)** model. You can connect your own keys to unlock smart search and automation.

### Supported Providers
* OpenAI (GPT-4o / GPT-4o-mini)
* Anthropic (Claude 3.5 Sonnet / Claude 3 Haiku)
* Google Gemini (Gemini 1.5 Pro / Flash)
* Local Providers (Ollama, OpenRouter, Together AI)

### How to Configure AI
1. Log in as the administrator and navigate to **Settings** ➔ **AI Configuration**.
2. Select your provider, paste your API Key, and select your preferred model.
3. Click **Test & Save**. (Slip encrypts your API keys using AES-256 encryption before storing them in your local database).

### Disconnected Fallback (Zero-AI Mode)
If you choose not to connect an AI provider, **Slip functions perfectly as a standard, lightweight bookmark archiver**. All AI buttons, search modes, and auto-tagging options are hidden so they do not clutter your interface.

---

## ♻️ 4. Managing Deletions (Recycle Clip & Toast Undo)

Accidentally deleting bookmarks is frustrating, which is why Slip uses a non-destructive **Recycle Clip** (Soft Delete) mechanism.

### How it works:
1. **Soft Delete**: When you click the **Delete** (trash) icon on any bookmark card, it is immediately removed from the active grid and moved to the **Recycle Clip**.
2. **Undo Toast**: When deleted, a floating toast banner appears at the bottom of the screen: `Card moved to Recycle Clip (Undo)`. You have **6 seconds** to click "Undo" and restore it instantly with zero database delay.
3. **Cascade Clip Deletions**: If you delete a parent Clip that contains sub-clips, Slip will ask you whether to:
   * **Promote**: Keep the sub-clips and move them up one level.
   * **Cascade**: Move the entire tree (parent, sub-clips, and all enclosed bookmarks) to the Recycle Clip.
4. **Permanent Purge**: To free up disk space, go to the Recycle Clip and click **Empty Recycle Clip** to permanently purge all soft-deleted entries from the database.

---

## 🔌 5. Developer API & Integrations

Slip exposes a full JSON REST API to automate ingestion. You can generate permanent authorization tokens directly from your dashboard.

### Creating an API Key:
1. Go to **Settings** ➔ **Developer Settings / API Keys**.
2. Click **Generate New Key**, give it a name (e.g., `iOS Shortcut`), and copy the token.

### Native iOS Shortcut Setup
You can save any URL to Slip in **under 1 second** using a native iOS Shortcut from your Safari Share Sheet:

1. Open the **Shortcuts** app on your iPhone or iPad.
2. Create a new shortcut called **Save to Slip**.
3. Set the shortcut to **Receive: URLs** from the Share Sheet.
4. Add the **"Get Contents of URL"** action and configure it:
   * **URL**: `http://<your-unraid-ip>:3000/api/bookmarks`
   * **Method**: `POST`
   * **Headers**:
     * `Authorization`: `Bearer YOUR_API_TOKEN_HERE`
     * `Content-Type`: `application/json`
   * **Request Body**: `JSON`
     * `url`: Set to the Safari webpage input variable.
5. Tap the settings icon in the Shortcut editor and toggle **"Show in Share Sheet"**.

Now, when browsing any website on iOS, tap **Share** ➔ **Save to Slip** to archive the link instantly in the background!

---

## 🌐 6. Desktop Browser Extension
* Install the **Slip Extension** on your desktop browser (Chrome, Brave, Firefox, Edge, Safari).
* Open the extension options, input your **Slip Server URL** (e.g. `http://192.168.1.50:3000`), paste your **API Key**, and click **Save**.
* Press `Cmd+Shift+S` (Mac) or `Ctrl+Shift+S` (Windows) to capture and tag any webpage in one click without leaving your current tab.

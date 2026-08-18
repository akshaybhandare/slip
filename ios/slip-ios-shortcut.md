# 📱 Slip — Apple iOS Share Sheet Shortcut Setup

Save links, articles, tweets, YouTube videos, and **local images/photos** directly to your **Slip Visual Mind** with 1-tap from your iPhone or iPad native Share Sheet.

---

## 📋 Overview of Setup

Setting up the shortcut takes **about 2 minutes** and consists of two parts:
1. **[Step 0: Get Your API Key & Server URL](#-step-0-get-your-api-key--server-url)** (1-time key generation)
2. **[Step 1-5: Build the Universal iOS Shortcut](#-universal-ios-shortcut-urls--images)** (Saves links AND Photos/Images)

---

## 🔑 Step 0: Get Your API Key & Server URL

Your shortcut needs an **API Key** so it can save bookmarks to your user account without needing login cookies.

### 🌐 Determine Your Server URL
* **Local Home Network / NAS (Unraid/Docker):**
  ```text
  http://<YOUR_SERVER_IP>:3080/api/bookmarks
  ```
  *(Example: `http://192.168.10.30:3080/api/bookmarks` — Note: use `http://`, not `https://`)*
* **Public Domain / Reverse Proxy / Cloudflare Tunnel:**
  ```text
  https://slip.yourdomain.com/api/bookmarks
  ```

---

### 🔑 Generate Your API Key (Choose Method A or B)

#### Method A: Browser Console (Fastest — 1 Click)
If you are logged into Slip in your web browser:
1. Open your Slip web page (e.g. `http://192.168.10.30:3080`).
2. Open Developer Tools Console (`Cmd + Option + I` on Mac, or `F12` on Windows).
3. Paste the following and hit **Enter**:
   ```javascript
   fetch('/api/auth/apikey', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ name: 'iOS Shortcut' })
   })
   .then(r => r.json())
   .then(data => prompt('Copy your API Key:', data.apiKey));
   ```
4. Copy the generated key (starts with `slip_...`).

---

#### Method B: Terminal / cURL
Run this command on your Mac/Linux terminal:

```bash
curl -s -X POST http://<YOUR_SERVER_IP>:3080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "YOUR_USERNAME", "password": "YOUR_PASSWORD"}' \
  -c /tmp/slip_cookie.txt > /dev/null && \
curl -s -X POST http://<YOUR_SERVER_IP>:3080/api/auth/apikey \
  -H "Content-Type: application/json" \
  -d '{"name": "iOS Shortcut"}' \
  -b /tmp/slip_cookie.txt && rm -f /tmp/slip_cookie.txt
```

---

## 🛠️ Universal iOS Shortcut (URLs + Images + PDFs)

This smart shortcut automatically detects whether you are sharing a **web link** (Safari, Twitter, YouTube), a **photo/image** (Apple Photos, Screenshots), or a **PDF document** (Files app, Safari PDF downloads) and routes it seamlessly to your Slip archive with zero configuration changes.

### 1️⃣ Step 1: Create a New Shortcut
1. In the **Shortcuts** app, tap the **`+`** icon in the top-right corner.
2. Tap the title at the top (*"New Shortcut"*) and rename it to **`Save to Slip`**.
3. Tap the icon to choose an orange background and a **Bookmark** symbol.

---

### 2️⃣ Step 2: Enable the iOS Share Sheet
1. Tap the **ⓘ (Info / Details)** icon at the bottom of the screen.
2. Toggle **ON** **"Show in Share Sheet"**.
3. Under **"Receive"**, tap and ensure these are enabled:
   * **URLs**
   * **Safari web pages**
   * **Images**
   * **Media**
   * **PDFs** / **Files** (from Apple Files app)
4. Tap **Done** in the top right to return to the shortcut editor.

---

### 3️⃣ Step 3: Add the Smart Routing Logic

Follow this action sequence in the Shortcuts editor:

#### A. Check if the input is an Image, File, or PDF
1. Tap **Add Action**, search for **`If`**, and select it.
2. Set the condition: If `Shortcut Input` `has any value` (or tap `Shortcut Input` → choose **Type: Image** or **Type: File**).

#### B. Handle Image & PDF Uploads (Zero Changes Needed!)
3. Inside the top half of the *If* block:
   * Search for **`Base64 Encode`** and add it (Encodes `Shortcut Input`).
   * Search for **`Get Contents of URL`** and add it:
     * **URL:** `http://<YOUR_SERVER_IP>:3080/api/bookmarks/upload`
     * **Method:** `POST`
     * **Headers:**
       * `Authorization`: `Bearer slip_YOUR_API_KEY_HERE`
       * `Content-Type`: `application/json`
     * **Request Body:** `JSON`
       * `image_data`: Select the `Base64 Encoded` variable from the previous step.
       * `filename`: `iOS_Photo.jpg` (or `Shortcut Input` Name)

#### C. Handle Web Link Sharing (Otherwise)
4. Inside the **Otherwise** block:
   * Search for **`Get URLs from Input`** and add it (Input: `Shortcut Input`).
   * Search for **`Get Contents of URL`** and add it:
     * **URL:** `http://<YOUR_SERVER_IP>:3080/api/bookmarks`
     * **Method:** `POST`
     * **Headers:**
       * `Authorization`: `Bearer slip_YOUR_API_KEY_HERE`
       * `Content-Type`: `application/json`
     * **Request Body:** `JSON`
       * `url`: Select the `URLs` variable from *Get URLs from Input*.

#### D. Show Success Banner
5. Below the **End If** block:
   * Search for **`Show Notification`** and set text to: **`✓ Saved to Slip Archive`**.
6. Tap **Done** in the top-right corner.

---

## ⚡ Visual Shortcut Flow

```text
┌──────────────────────────────────────────────────────────────┐
│ Receive [URLs, Safari web pages, Images] from Share Sheet    │
├──────────────────────────────────────────────────────────────┤
│ 1. If [Shortcut Input] has Images / Photos                   │
│    ├─ 2. Base64 Encode [Shortcut Input]                      │
│    └─ 3. Get Contents of [http://...:3080/api/bookmarks/upload]│
│          • Method: POST                                      │
│          • Headers: Authorization: Bearer slip_...           │
│                     Content-Type: application/json           │
│          • Body: { "image_data": [Base64], "filename": "..." }│
│ 4. Otherwise (Web Link)                                      │
│    ├─ 5. Get URLs from [Shortcut Input]                      │
│    └─ 6. Get Contents of [http://...:3080/api/bookmarks]     │
│          • Method: POST                                      │
│          • Headers: Authorization: Bearer slip_...           │
│                     Content-Type: application/json           │
│          • Body: { "url": [URLs] }                           │
│ 7. End If                                                    │
├──────────────────────────────────────────────────────────────┤
│ 8. Show Notification: "✓ Saved to Slip Archive"              │
└──────────────────────────────────────────────────────────────┘
```

---

## 💻 Developer & Command-Line API Examples

### 1. Upload Local Image File via cURL (Direct Binary Body)
```bash
curl -X POST http://<YOUR_SERVER_IP>:3080/api/bookmarks/upload \
  -H "Authorization: Bearer slip_YOUR_API_KEY" \
  -H "Content-Type: image/png" \
  -H "X-Filename: architecture-diagram.png" \
  -H "X-Title: System Architecture 2026" \
  -H "X-Tags: design, architecture, system" \
  --data-binary @/path/to/my_image.png
```

### 2. Upload Local Image File via Base64 JSON Payload
```bash
BASE64_IMG=$(base64 -i /path/to/my_image.jpg)
curl -X POST http://<YOUR_SERVER_IP>:3080/api/bookmarks/upload \
  -H "Authorization: Bearer slip_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"image_data\": \"$BASE64_IMG\",
    \"filename\": \"design-moodboard.jpg\",
    \"title\": \"Design Moodboard\",
    \"tags\": [\"inspiration\", \"visual\"]
  }"
```

---

## 🎉 How to Use It on iPhone / iPad

1. **For Web Links:** In Safari, Twitter, Reddit, or YouTube, tap **Share (⎋)** → tap **`Save to Slip`**.
2. **For Images & Photos:** In Apple **Photos**, open any picture or screenshot, tap **Share (⎋)** → tap **`Save to Slip`**.
3. An iOS notification will immediately confirm: `✓ Saved to Slip Archive`.
4. Open your Slip dashboard — your photo or bookmark will appear in your gallery with full-resolution caching, tag filtering, and instant search!

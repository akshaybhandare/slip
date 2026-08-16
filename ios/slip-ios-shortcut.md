# 📱 Slip — Apple iOS Share Sheet Shortcut Setup

Save links, articles, tweets, and YouTube videos directly to your **Slip Visual Mind** with 1-tap from your iPhone or iPad native Share Sheet.

---

## 📋 Overview of Setup

Setting up the shortcut takes **about 2 minutes** and consists of two parts:
1. **[Step 0: Get Your API Key & Server URL](#-step-0-get-your-api-key--server-url)** (1-time key generation)
2. **[Step 1-5: Build the iOS Shortcut](#-step-by-step-ios-shortcut-creation)** (Visual step-by-step in the Shortcuts app)

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
Run this command on your Mac/Linux terminal (replace `YOUR_SERVER_IP`, `YOUR_PORT`, `YOUR_USERNAME`, and `YOUR_PASSWORD`):

```bash
curl -s -X POST http://<YOUR_SERVER_IP>:<PORT>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "YOUR_USERNAME", "password": "YOUR_PASSWORD"}' \
  -c /tmp/slip_cookie.txt > /dev/null && \
curl -s -X POST http://<YOUR_SERVER_IP>:<PORT>/api/auth/apikey \
  -H "Content-Type: application/json" \
  -d '{"name": "iOS Shortcut"}' \
  -b /tmp/slip_cookie.txt && rm -f /tmp/slip_cookie.txt
```

---

## 🛠️ Step-by-Step iOS Shortcut Creation

Open the built-in **Shortcuts** app on your iPhone or iPad and follow these 5 steps:

### 1️⃣ Step 1: Create a New Shortcut
1. In the **Shortcuts** app, tap the **`+`** icon in the top-right corner.
2. Tap the title at the top (*"New Shortcut"*) and rename it to **`Save to Slip`**.
3. *(Optional)* Tap the icon to choose an orange background and a **Bookmark** symbol.

---

### 2️⃣ Step 2: Enable the iOS Share Sheet
1. Tap the **ⓘ (Info / Details)** icon at the bottom of the screen (or the slider icon on iPad).
2. Toggle **ON** **"Show in Share Sheet"**.
3. Under **"Receive"**, tap and ensure **URLs** and **Safari web pages** are selected.
4. Tap **Done** in the top right to return to the shortcut editor.

---

### 3️⃣ Step 3: Add Action 1 — "Get URLs from Input"
> [!TIP]
> This step ensures that rich Safari webpage objects and Twitter/YouTube share items are cleanly converted into plain URL text strings.

1. Tap **Add Action** (or search in the bottom search bar).
2. Search for: **`Get URLs from Input`** and select it.
3. It will automatically connect to receive `Shortcut Input`.

---

### 4️⃣ Step 4: Add Action 2 — "Get Contents of URL" (Send to Slip)
1. Tap the bottom search bar, search for **`Get Contents of URL`**, and select it.
2. Configure the action with the following parameters:

| Field | Value / Setting | Notes |
| :--- | :--- | :--- |
| **URL** | `http://<YOUR_SERVER_IP>:3080/api/bookmarks` | Use `http://` for local IPs; use `https://` only if you have an SSL domain. |
| **Method** | **`POST`** | Tap *Show More* / arrow `>` to reveal. |
| **Headers** | Tap *Add new field*: | |
| ↳ *Header 1* | Key: `Authorization` <br> Text: `Bearer slip_YOUR_API_KEY_HERE` | Include the word `Bearer` followed by a space and your key. |
| ↳ *Header 2* | Key: `Content-Type` <br> Text: `application/json` | |
| **Request Body** | Select **`JSON`** | |
| ↳ *JSON Field* | Type: **`Text`** <br> Key: `url` <br> Value: Select **`URLs`** variable | Tap the value box, select the **`URLs`** variable from Step 3 in the keyboard toolbar. |

---

### 5️⃣ Step 5: Add Action 3 — "Show Notification"
1. Tap the bottom search bar, search for **`Show Notification`**, and select it.
2. Set the text to: **`✓ Saved to Slip Archive`**.
3. Tap **Done** in the top-right corner to save your shortcut.

---

## ⚡ Visual Action Flow Summary

Your completed shortcut actions should look like this:

```text
┌────────────────────────────────────────────────────────┐
│ Receive [URLs and Safari web pages] from Share Sheet   │
├────────────────────────────────────────────────────────┤
│ 1. Get URLs from [Shortcut Input]                      │
├────────────────────────────────────────────────────────┤
│ 2. Get Contents of [http://192.168.10.30:3080/api/...] │
│    • Method: POST                                      │
│    • Headers:                                          │
│        Authorization: Bearer slip_xxxxxxxx...          │
│        Content-Type: application/json                  │
│    • Request Body: JSON                                │
│        url : [URLs]                                    │
├────────────────────────────────────────────────────────┤
│ 3. Show Notification: "✓ Saved to Slip Archive"        │
└────────────────────────────────────────────────────────┘
```

---

## 🎉 How to Use It on iPhone / iPad

1. Open any article in **Safari**, tweet on **Twitter/X**, post on **Reddit**, or video on **YouTube**.
2. Tap the iOS **Share (⎋)** button (square with upward arrow).
3. Scroll down the share sheet and tap **`Save to Slip`**.
4. An iOS banner will notify you: `✓ Saved to Slip Archive`.
5. Open your Slip dashboard — your new bookmark is parsed, tagged, screenshotted, and ready!

---

## 🔍 Troubleshooting & Common Pitfalls

### ❌ "A TLS error caused the secure connection to fail"
* **Cause:** The URL starts with `https://` instead of `http://` on an unencrypted local IP.
* **Fix:** Change the URL in Step 4 from `https://192.168.x.x...` to `http://192.168.x.x...`.

---

### ❌ "Unauthorized: No token provided"
* **Cause:** The `Authorization` header is missing or improperly formatted.
* **Fix:** Verify the header key is exactly `Authorization` and the value starts with `Bearer slip_...` (ensure there is a space after `Bearer`).

---

### ❌ Notification shows "Saved" but bookmark does not appear in Slip
* **Cause 1:** You tested the shortcut by tapping it inside the Shortcuts app instead of via the Share Sheet. (Inside the app, `Shortcut Input` has no URL).
* **Fix 1:** Test it by tapping the **Share** button inside Safari on an actual webpage.
* **Cause 2:** Safari passed a webpage object that was not converted to a string.
* **Fix 2:** Ensure Step 3 (**Get URLs from Input**) is present, and the JSON `url` field uses the **`URLs`** variable.

---

### ❌ Server not reachable when away from home Wi-Fi
* **Cause:** Local IPs (`192.168.x.x`) only work when connected to your home Wi-Fi network.
* **Fix:** To save bookmarks when away on 5G/cellular data:
  * Connect to your home VPN (e.g. **WireGuard** or **Tailscale** on iOS), OR
  * Expose Slip via a secure HTTPS domain using **Cloudflare Tunnel** or a reverse proxy.

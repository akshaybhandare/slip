# 📱 Slip — Apple iOS Share Sheet Shortcut Setup

Follow these simple steps to add **"Save to Slip"** directly into your **iOS Native Share Sheet** on iPhone and iPad.

Once set up, you can save links with 1-tap from **Safari, Twitter/X, Reddit, YouTube, Instagram, Chrome**, and any other iOS app!

---

## ⚡ 1-Minute Step-by-Step Setup

### Step 1: Open the Shortcuts App on iPhone
1. Open the built-in **Shortcuts** app on your iPhone or iPad.
2. Tap the **`+`** (Plus icon) in the top-right corner to create a new Shortcut.
3. Tap the title at the top ("New Shortcut") and rename it to **`Save to Slip`**.
4. Tap the icon next to the title, choose an orange color and the **Bookmark** symbol.

---

### Step 2: Enable "Show in Share Sheet"
1. Tap the **ℹ️ (Info / Details)** icon at the bottom.
2. Toggle on **"Show in Share Sheet"**.
3. Under "Receive", set it to receive: **URLs** and **Safari web pages**.

---

### Step 3: Add the Action (Send to Slip API)
1. Tap **Add Action** (or search in the action bar).
2. Search for and select: **"Get Contents of URL"** (under Web / Network).
3. Configure the action as follows:

* **URL**:
  ```
  http://<YOUR_UNRAID_IP>:3080/api/bookmarks
  ```
  *(Or your public HTTPS domain if using a reverse proxy e.g. `https://slip.yourdomain.com/api/bookmarks`)*

* Tap **"Show More"** or the arrow next to URL:
  * **Method**: `POST`
  * **Headers**:
    * Tap *Add new field*:
      * Key: `Authorization`
      * Value: `Bearer YOUR_API_KEY_HERE`
    * Tap *Add new field*:
      * Key: `Content-Type`
      * Value: `application/json`
  * **Request Body**: Choose `JSON`
    * Tap *Add new field*:
      * Type: `Text`
      * Key: `url`
      * Value: Select the variable **`Shortcut Input`** (from Share Sheet)

---

### Step 4: Add Visual Confirmation Toast
1. Search for action: **"Show Notification"**.
2. Set text to: **`✓ Saved to Slip Archive`**.
3. Tap **Done** in the top right.

---

## 🎉 How to Use It on iPhone:

1. Open any article in **Safari**, tweet on **Twitter/X**, or video in **YouTube**.
2. Tap the iOS **Share** button.
3. Tap **"Save to Slip"**.
4. An iOS banner will notify you: `✓ Saved to Slip Archive`.
5. The link is now instantly saved, scraped, and available in your Slip visual mind!

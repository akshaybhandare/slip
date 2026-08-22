# 🔖 SLIP: The Visual Archiving Chronicles
*A Guided Visual Quest with Slippy, your Server Companion.*

---

## 🗺️ Meet Your Guide

<img src="docs/slippy_mascot.jpg" alt="Slippy the Mascot" width="180" height="180" style="border-radius: 20px;" />

💬 **Slippy**: *"Hi! I'm Slippy, your local database companion! Let's get Slip set up on your Unraid server."*

---

## 🎮 QUEST 1: Awakening the Server
*Objective: Understand what you just installed on Unraid.*

💬 **Slippy**: *"Behold! You've successfully summoned Slip onto your Unraid array! I've set up shop inside a tiny Alpine container running on port 3000. All your saved bookmarks, cache images, and databases are stored safely under your server's `/config` directory."*

```text
📋 QUEST LOG:
[✓] Summon container on Port 3000
[✓] Establish persistent vault in /mnt/user/appdata/slip
```

> [!NOTE]
> **Slippy's Safety Guard**: I use your Unraid `PUID` and `PGID` settings to make sure I don't write files with root permissions, so you never get those annoying permission locks on your shares!

---

## 🤖 QUEST 2: Summoning the AI Core (BYO-AI)
*Objective: Decide whether to play as a Classic Archiver or an AI Wizard.*

💬 **Slippy**: *"Here is where you make a choice. You can play Slip in two modes. I will adapt to whatever you choose!"*

```mermaid
flowchart TD
    A["Choose your path"] -->|Classic Path| B["🛡️ Pure Bookmarking (Zero-AI Clutter)"]
    A -->|Wizard Path| C["🧠 Summon AI Core (OpenAI/Gemini/Ollama)"]
```

💬 **Slippy**: *"If you want the AI Wizard path, bring me your API keys from **OpenAI**, **Claude**, **Gemini**, or even a local **Ollama** server. Go to **Settings ➔ AI Configuration**, paste the key, and click Save. I'll encrypt it instantly with AES-256."*

💬 **Slippy**: *"Once connected, I will automatically read your articles to tags, summarize notes, and let you search using conceptual thoughts instead of exact words!"*

> [!TIP]
> **Slippy's Promise**: Don't want AI? No problem. I'll hide all AI buttons, settings, and badges so they don't get in your way. No clutter, just fast bookmarking!

---

## 📂 QUEST 3: Sorting the Loot (Clips & Tags)
*Objective: Organize your visual cards without making a mess.*

💬 **Slippy**: *"Look at your dashboard! You can save articles, videos, design graphics, and products. Let's keep them tidy."*

💬 **Slippy**: *"You have two tools in your inventory:"*

* **🏷️ Tags**: Flat, quick labels like `#inspiration` or `#development`. Tap them on any card to instantly filter your view.
* **📁 Clips**: Think of these as secret compartments. You can nest them (e.g. `Hobbies` ➔ `3D Printing`). 

> [!IMPORTANT]
> **Slippy's Organizing Trick**: Unlike standard folders that crowd your view, Clips are **hidden by default**. Your dashboard stays clean. You can "pin" your favorite Clips to the sidebar to jump to them quickly!

---

## ♻️ QUEST 4: The Recycle Shield (How Deletions Work)
*Objective: Salvage items from accidental destruction.*

💬 **Slippy**: *"Whoops! Clicked delete on that recipe card by accident? Don't panic, I have deployed the **Recycle Shield**!"*

```text
[ Card Deleted! ] ───(6-Second Warp)───> [ Undo Toast ] ──(Click)──> [ Restored! ]
                                             │ (Time Expires)
                                             ▼
                                     [ Recycle Clip ]
```

💬 **Slippy**: *"When you click delete, I hold the card in mid-air for **6 seconds**. You'll see a floating banner at the bottom. Tap **Undo** to bring it back instantly."*

💬 **Slippy**: *"If you let the timer run out, the card goes to the **Recycle Clip**. It's not gone! You can open the Recycle Clip from the menu to restore it. If you want to permanently purge it, click **Empty Recycle Clip** to free up server space."*

---

## 🌀 QUEST 5: The Teleportation Portal (Access Slip Anywhere)
*Objective: Connect to your home server securely from anywhere in the world.*

💬 **Slippy**: *"So, you're at a coffee shop and want to view your bookmarks? Normally, your Unraid server is locked inside your home network. But we can build a secure teleportation tunnel using **Tailscale**!"*

```mermaid
sequenceDiagram
    participant Phone as 📱 Your Phone (LTE)
    participant Portal as 🌀 Tailscale Encrypted Tunnel
    participant Unraid as 🖥️ Unraid Server (Home)
    
    Phone->>Portal: "Activate Connection!"
    Portal->>Unraid: Safe Handshake (Magic IP 100.x.y.z)
    Unraid-->>Phone: Load Slip Instantly!
```

💬 **Slippy**: *"No port forwarding. No firewall holes. Here is the ritual:"*

1. **Install Tailscale on Unraid**: Go to your Unraid **Apps** tab, search for **Tailscale**, and install it. Log in to register your server.
2. **Find your Magic IP**: Look at your Tailscale dashboard. Your server will get a new IP address starting with `100.x.y.z`.
3. **Install on your Phone**: Get the Tailscale app on your phone or laptop and log in. Turn it ON.
4. **Access Slip**: Open your browser on the road and type `http://100.x.y.z:3000`. You are in!

---

## 📱 QUEST 6: The 1-Second Capture (iOS Share Sheet)
*Objective: Save links directly from Safari in under a second.*

💬 **Slippy**: *"Now, let's connect your phone's share button directly to my server!"*

💬 **Slippy**: *"Go to **Settings ➔ API Keys** on your Slip dashboard, generate a new key, and copy the code. Then, create an iOS Shortcut like this:"*

```ini
[POST] http://100.x.y.z:3000/api/bookmarks
├── Headers:
│   ├── Authorization: Bearer YOUR_API_KEY
│   └── Content-Type: application/json
└── JSON Body:
    └── url: [Safari Webpage URL]
```

💬 **Slippy**: *"Enable 'Show in Share Sheet'. Now, whenever you are reading a cool article on Safari, just tap Share ➔ Save to Slip. I will catch the link and archive it in under a second!"*

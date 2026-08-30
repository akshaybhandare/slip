# Slip v1.2.0 Release Notes 🧠⚡

We are thrilled to announce **Slip v1.2.0** — introducing 100% on-device semantic vector search, transparent hybrid retrieval, and contextual Related Slips discovery powered by embedded local neural representations with zero external API dependencies.

---

## 🌟 What's New in v1.2.0

### 1. On-Device Semantic Vector Search (#37)
* **Local Neural Embeddings**: Integrated `@huggingface/transformers` using `Xenova/bge-small-en-v1.5` (384-dimensional vector embeddings, ~33MB quantized ONNX runtime).
* **Transparent Hybrid Ranking**: Fuses SQLite FTS5 BM25 lexical ranking ($0.6$) with in-memory Float32 cosine dot-product similarity ($0.4$). Pinned slips remain pinned at the top.
* **Concept Search**: Search your visual archive using conceptual intent and synonyms even when slips contain zero exact keyword matches (e.g. searching *"cloud container deployment"* matches *"Kubernetes cluster setup"*).
* **Zero UI Clutter**: Built directly into the standard search bar without requiring separate "AI search mode" toggles.
* **Sub-10ms Latency**: In-memory TypedArray dot-product execution runs in $<2\text{ms}$ across thousands of slips.

### 2. "Related Slips" Discovery in Reader Mode (#40)
* **Contextual Discovery**: Opening Reader Mode on any article or note automatically computes and presents up to 3 closely related slips from your archive.
* **Similarity Match Badges**: Visual confidence pills (e.g., `88% match`) display semantic relevance.
* **Instant 1-Click Navigation**: Clicking a related slip smoothly transitions Reader Mode to that document in-place.

### 3. Feed Stability & Flicker Elimination
* **Silent Background Refresh**: Implemented non-destructive background data loading during "Sync All" maintenance sweeps, eliminating feed grid unmounting and screen flickering.
* **Sequential Queue Processing**: Eliminated duplicate vectorization passes and race conditions between web scraping and vector indexing.

### 4. 100% Offline Homelab & Zero-Config Upgrades
* **Docker Pre-Caching**: ONNX model files are pre-baked into `/app/models` inside the container image for instant, zero-download air-gapped boots.
* **Automatic Startup Backfill**: On server launch, Slip quietly vectorizes any unindexed slips in the background—existing libraries update with zero manual steps.
* **SQLite BLOB Storage**: Raw 384-d vectors are stored as binary `BLOB`s in `slip_embeddings` with `ON DELETE CASCADE` hygiene.

---

## 🧪 Comprehensive Verification & QA

- **Playwright Real-User E2E Tests**: 19 / 19 passed across all user scenarios (including new `e2e/semantic-search.spec.ts`).
- **Backend Integration Tests**: 211 / 211 tests passed (15 / 15 test suites).
- **Frontend Vitest Suite**: 129 / 129 tests passed (12 / 12 test suites).
- **Production Builds**: Backend `tsc` (0 errors) and Frontend `vite build` (0 errors).

---

## 🐳 Docker Deployment

```bash
docker pull ghcr.io/akshaybhandare/slip:v1.2.0
```

---

**Full Changelog**: https://github.com/akshaybhandare/slip/compare/v1.1.1...v1.2.0

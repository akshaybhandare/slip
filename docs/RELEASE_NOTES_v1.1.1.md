# Slip v1.1.1 Release Notes ⚡

We are excited to announce **Slip v1.1.1** — introducing a unified multi-selection system with a floating bulk action dock, consolidated bulk API architecture, instant undo toast support, and Playwright end-to-end user testing suites.

---

## 🌟 What's New in v1.1.1

### 1. Multi-Selection System & Floating Bulk Action Dock
* **Card Checkboxes**: Multi-select slip cards and clip folders with a single click in both feed and clip views.
* **Floating Bulk Action Bar**: An animated dock displaying live selection counts, "Select All / Deselect All", and context-aware bulk operations.
* **Single Source of Truth Action Registry**: Declarative action matrix ensuring consistent action availability across frontend and backend contexts (Feed, Clip Detail, Recycle Clip).

### 2. Bulk Operations & Architecture Consolidation
* **Consolidated Bulk Endpoints (#21)**: Standardized unified routes in `backend/src/routes/bulk.ts` and eliminated duplicate route handlers across `bookmarks.ts` and `clips.ts`.
* **Deduplicated Undo Sorting (#22)**: Streamlined restore sorting logic via `mergeRestored()`.
* **Strict Array ID Parsing (#23)**: Removed accidental single `body.id` fallbacks to enforce explicit array payloads.
* **Dead Code Elimination (#24)**: Removed shadowed variable declarations in restore loops.
* **Atomic Bulk Unclip**: Added single-transaction `DELETE /api/clips/:id/bookmarks` support, replacing previous sequential N+1 client request loops.
* **Multi-Tenant Security Hardening**: Enforced `user_id` query scoping across all subqueries and required `deleted_at IS NOT NULL` for permanent deletion.

### 3. Playwright End-to-End Testing Suites
* **Comprehensive Test Suites**:
  - `bulk-operations.spec.ts`: Multi-select controls, dynamic counters, bulk delete, recycle bin routing, restore, and permanent deletion.
  - `clips-and-theme.spec.ts`: Clip hierarchy, sub-clips, vertical breadcrumb spine, and theme presets.
  - `slips-and-bulk.spec.ts`: Real user slip creation, live search, and content filter tabs.
  - `human-chaos.spec.ts`: Human-like exploratory testing, typo corrections, search thrashing, and 12-step chaos monkey invariance checks.

---

## 🐳 Docker Deployment

```bash
docker pull ghcr.io/akshaybhandare/slip:v1.1.1
```

---

**Full Changelog**: https://github.com/akshaybhandare/slip/compare/v1.1.0...v1.1.1

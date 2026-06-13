# setara-ui Tracker

Last updated: 2026-06-13

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked

Beads issues: run `bd list --status=open` in the setara root for live status.

---

## ✅ Completed (summary)

**Foundation & shell**
- SvelteKit + TypeScript scaffold, plain CSS design token system, dark mode
- App shell: sidebar, mobile top bar, command palette (⌘K), theme toggle
- Login with DEMO_ACCOUNTS (Admin/QA/Viewer/Guest), mock auth, session storage
- Teal accent (`#00AFA5`) + deep navy (`#0B1220`) brand; Sora/Inter/JetBrains Mono
- SetaraLoader animation (hexagonal progress + orbit variants)
- SvelteKit vendor chunk splitting (RevoGrid, Chart.js, markdown, UI primitives)

**Project & test case management**
- Project list, detail (metric cards, latest build/plan, coverage chart, 4th metric card for builds), settings, API keys
- Test Repository: directory tree CRUD, scenario CRUD, bulk approve/reject, bulk copy/delete
- Repository import wizard: Excel upload → validate preview → confirm → result (async polling, import history, error report)
- Scenario detail drawer (full edit: name, description, priority/status/automatable, step editor)
- Step editor (RevoGrid): keyword dropdown, pointer/focus row tracking, move/delete/duplicate
- Directory move/rename/delete modals, bulk action bar, filter bar (auto status + priority)
- Coverage Map and Quality Map (SetaraMindMap renderer with drag, node links)
- **Tag support**: `TagInput.svelte` multi-chip input component with sanitize/display separation, max-20 enforcement
- **Tag filter bar**: `TagFilterBar.svelte` (project-scoped tag pool, ANY/ALL mode toggle) on scenario list
- **Semantic search page**: `/repository/search` — similarity query, scored results list
- **AI suggest page**: `/builds/{id}/suggest` — trigger LLM+vector suggestion, display scored results

**Build management**
- Build list page: sortable headers (Name ↑↓ / Created ↑↓ / Verified ↑↓), backend-backed sort via URL params
- Build detail: large doughnut chart, scenario table, verify gate enforcement, history/audit diff modal
- Build detail: **description and build requirements displayed** in meta section (2026-05-29)
- Build create form: **requirements field** (textarea) included in modal (2026-05-29)
- Add-from-run page (`/builds/{id}/add-from-run`): 2-step full-page (pick run → review scenarios)
- Add-manual page (`/builds/{id}/add-manual`): split-layout directory tree (nested, chevrons, counts) + sortable scenario table (name/priority)
- Build quality map page; build trend chart on plan detail

**Plans & quality gates**
- Global `/plans`: cross-squad table, squad filter, sortable column headers, backend-backed sort
- Squad plan list: sortable headers, backend-backed sort via URL params
- Squad plan detail: builds table (pass/fail/pending per build), plan lifecycle metadata, close flow
- Plan quality map with build node navigation links

**Execution & live updates**
- Execution list and detail, live indicator (WebSocket state pill)
- `ScenarioResultDetail` slide-in panel (status, meta, exception, steps)
- `WebSocketManager`: auto-reconnect with backoff, multi-subscriber
- `RUN_STARTED` / discovery / finish events update execution list and detail state

**Organization & admin**
- Coverage overview → squad detail navigation
- Squad detail page: project coverage table, coverage donut, pass rate trend, top 3 volatile projects
- Admin: tribes, squads, users (member management modal, lead search)

**Sortable audit (2026-05-28)**
- All paginated list pages with server-side data use backend-backed sort (URL params → page loader → API)
- Add-manual scenario sort is correctly client-side (all data loaded upfront, no pagination)
- Build detail scenario sort correctly resets cursor and reloads from API on sort change

**New scenario form (2026-05-29)**
- TagInput wired into new scenario creation form — tags sent on submit

**UI verification (2026-06-13)**
- Added `npm run test:ui` adoption guardrails for shared alerts, export flow links, and wrapper-layer presence
- Added dependency-free `npm run test:ui` coverage for API/realtime helpers, WebSocket store guardrails, critical component flows, primary route presence, Dockerfile readiness, GHCR workflow readiness, and CI verification wiring

---

## 🔲 Remaining Work

### Scenario tags
- [ ] Scenario edit drawer does not show or edit tags — beads: `setara-fah` · P3

### Live updates
- [ ] Dashboard (`/dashboard`) metric cards and recent projects table update from WebSocket events — beads: `setara-uqe` · P2

### Admin
- [ ] Intelligence health admin page — surface `/api/admin/intelligence/health` endpoint — beads: `setara-8z3` · P3

### Style consistency
- [ ] Migrate raw `<button>` elements to use `Button` component across all pages — beads: `setara-6fp` · P3

### Verification
- [x] UI adoption guardrails for bespoke error banners/export links/wrapper presence — beads: `setara-ks7` · P3
- [x] API/realtime helper and WebSocket store guardrails — beads: `setara-ks7.1` · P3
- [x] Critical flow guardrails (build verify, plan close, scenario AI draft, export, AI review) — beads: `setara-ks7.3` · P3
- [x] Route, CI, Dockerfile, and GHCR smoke-readiness guardrails — beads: `setara-ks7.2` · P3
- [ ] OpenAPI contract smoke check in CI against mock mode — beads: `setara-x3m` · P3

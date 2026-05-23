# setara-ui Tracker

Last synced with parent tracker: 2026-05-23

```text
UI: [~] Comprehensive multi-route dashboard restructure implemented
```

- [x] Git repository initialized on `main`.
- [x] Local Git identity set to `ygrip <yunaz.gilang@gmail.com>`.
- [x] Remote set to `git@github.com-personal:ygrip/setara-ui.git`.
- [x] SvelteKit + TypeScript scaffold added.
- [x] API config/client foundation added.
- [x] Dockerfile added.
- [x] Apache-2.0 license and docs added.
- [x] `npm run check` passes (0 errors, 0 warnings).
- [x] `npm run build` passes.
- [x] CSS variable / design token foundation (no Tailwind — using plain CSS with `--color-*` tokens).
- [x] Authenticated app shell with sidebar, top bar, hamburger mobile drawer, theme toggle.
- [x] Dark mode via `prefers-color-scheme` + localStorage toggle (flash prevention in app.html).
- [x] Login page with mock session auth (localStorage `setara_session`).
- [x] Projects list page with search and New Project modal.
- [x] Workspace selector page (`/workspace`) — project grid with search, navigates to project dashboard.
- [x] Dashboard page (`/dashboard`) — cross-project metrics, recent projects table, charts placeholder.
- [x] Project detail page rewritten as rich dashboard — MetricCard row, QualityGateBadge, recent runs, quick links.
- [x] Executions list page (`/projects/{key}/executions`) — replaces `runs/`. Filters bar (static, coming soon note).
- [x] Execution detail page (`/projects/{key}/executions/{runId}`) — MetricCard row, metadata grid, live indicator, scenario results placeholder.
- [x] Test Repository page (`/projects/{key}/repository`) — three-column structural stub (tree, list, detail panels).
- [x] Coverage page (`/projects/{key}/coverage`) — metric cards, formulas reference, chart placeholders.
- [x] Release Plans page (`/projects/{key}/release-plans`) — empty state, status reference card.
- [x] Release Plan detail stub (`/projects/{key}/release-plans/{planId}`) — coming soon.
- [x] Project Settings page (`/projects/{key}/settings`) — category cards grid.
- [x] API Keys settings page (`/projects/{key}/settings/api-keys`) — full key management with create/revoke/rotate.
- [x] Admin layout with horizontal pill sub-nav (Tribes / Squads / Users / Roles).
- [x] Admin Tribes page (`/admin/tribes`) — extracted from old single-page admin.
- [x] Admin Squads page (`/admin/squads`) — extracted from old single-page admin.
- [x] Admin Users page (`/admin/users`) — extracted from old single-page admin.
- [x] Admin Roles page (`/admin/roles`) — placeholder with role reference.
- [x] Sidebar rewritten: Dashboard + Projects (global), project-contextual section with Release Plans / Test Repository / Executions / Coverage (active links when projectKey present, dimmed otherwise), Administration.
- [x] Top bar always visible on desktop and mobile — live indicator (pulsing green dot), project key pill (desktop), user avatar.
- [x] Old `runs/` pages converted to redirects to `executions/`.
- [x] Old `plans/` page converted to redirect to `/projects`.
- [x] Shared components: Badge, Button, Card, Modal, DataTable, ThemeToggle, MetricCard, QualityGateBadge.
- [x] Typed API clients: projects.ts, organization.ts, runs.ts, apikeys.ts.
- [ ] Permission/role-aware UI states.
- [ ] Session refresh behavior.
- [ ] Scenario tree view (live, connected to backend).
- [ ] Manual execution screen.
- [ ] WebSocket live run updates.
- [ ] Plans detail page (post-backend).
- [ ] End-to-end smoke tests.
- [ ] Frontend container smoke test.

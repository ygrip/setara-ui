<p align="center">
  <img src="logo.png" alt="Setara" width="80" />
</p>

<h1 align="center">setara-ui</h1>

<p align="center">SvelteKit 5 frontend for Setara — real-time test execution dashboard, scenario repository, and build tracking</p>

<p align="center">
  <a href="https://github.com/ygrip/setara-ui/pkgs/container/setara-ui"><img src="https://img.shields.io/badge/GHCR-setara--ui-blue?logo=docker" alt="Docker" /></a>
</p>

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20+ |
| npm | 10+ |

---

## Quick Start

```bash
npm install

# Against a running backend (setara-core at localhost:8080):
npm run dev
# → http://localhost:5173

# With mock data (no backend required):
npm run dev:mock
# → http://localhost:5173  (in-memory stubs, no network calls)
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_SETARA_API_BASE_URL` | `http://localhost:8080` | Base URL for the setara-core REST API |
| `VITE_SETARA_WS_BASE_URL` | `ws://localhost:8080` | Base URL for WebSocket connections |
| `VITE_MOCK` | `false` | Set to `true` to activate in-memory mock mode |

For local development, create a `.env.local` file:

```sh
VITE_SETARA_API_BASE_URL=http://localhost:8080
VITE_SETARA_WS_BASE_URL=ws://localhost:8080
```

When deploying via `setara-platform`, these values are injected at image build time via Docker build args (`PUBLIC_SETARA_API_BASE_URL`, `PUBLIC_SETARA_WS_BASE_URL`).

---

## Folder Structure

```
src/
├── routes/
│   ├── (app)/                   # Authenticated app shell (shared layout + nav)
│   │   ├── dashboard/           # Per-project execution dashboard
│   │   ├── projects/            # Project list + project-scoped views
│   │   │   └── [key]/
│   │   │       ├── scenarios/   # Scenario CRUD, step editor
│   │   │       ├── executions/  # Run history + result details
│   │   │       └── plans/       # Test plans
│   │   ├── coverage-overview/   # Cross-project coverage summary
│   │   ├── squads/              # Squad management
│   │   ├── workspace/           # Workspace-level settings
│   │   ├── admin/               # Admin panel (users, API keys, DLQ)
│   │   └── profile/             # User profile
│   ├── login/                   # Login page
│   └── api/                     # SvelteKit server routes (SSR endpoints)
├── lib/
│   ├── api/                     # Typed API client functions (fetch wrappers)
│   ├── components/              # Shared UI components
│   ├── features/                # Feature-scoped components (collocated with routes)
│   ├── mock/                    # In-memory mock handlers for dev:mock mode
│   ├── stores/                  # Svelte runes-based state ($state, $derived)
│   └── types/                   # Shared TypeScript types
└── static/                      # Static assets
```

The app is built with **SvelteKit 5 runes** (`$state`, `$derived`, `$effect`) throughout — no legacy Svelte stores.

---

## Key Features

- **Dashboard** — per-project live execution feed via WebSocket; pass/fail trend charts; recent runs table
- **Projects and Scenarios** — full CRUD for projects, scenarios, and BDD step definitions; tree-based folder navigation
- **Build Tracking** — tag executions to named builds; compare pass rates across builds
- **Plans** — create and manage test plans scoped to a project
- **Coverage Overview** — cross-project scenario coverage summary for QA leads and managers
- **Admin Panel** — user management, API key issuance, dead-letter queue inspection and retry
- **Real-time updates** — WebSocket subscription per project; execution results appear without page refresh

---

## Build and Deploy

### Verification

```bash
npm run check     # Svelte diagnostics
npm run test:ui   # lightweight UI adoption guardrails
npm run build     # production build
```

### Static build

```bash
npm run build
npm run preview   # preview the production build locally
```

### Docker (via setara-platform)

`setara-platform` runs the published frontend image by default:

```bash
# From setara-platform directory:
SETARA_UI_IMAGE=ghcr.io/ygrip/setara-ui:latest ./scripts/compose.sh up frontend

# Or start the full stack:
make live
```

Use the platform build overlay when testing unpublished local UI changes:

```bash
./scripts/compose.sh -f docker-compose.yml -f docker-compose.build.yml up --build frontend
```

The `Dockerfile` in this repo performs a Node build stage and serves the output via a minimal runtime image.

---

## Mock Mode

`npm run dev:mock` activates in-memory stubs for all API calls and WebSocket events. No running backend is required.

Use mock mode for:
- UI development and component iteration without a local backend
- Visual testing and Storybook-style exploration

Run against the real backend (`npm run dev`) for:
- API contract validation
- End-to-end feature verification
- WebSocket and live-reload testing

---

## Documentation

- [Development](docs/development.md) — component patterns, runes conventions, mock layer details

## Repository

```text
git@github.com:ygrip/setara-ui.git
```

## License

Apache License 2.0. See [LICENSE](LICENSE).

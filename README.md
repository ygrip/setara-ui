<p align="center">
  <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 1254 1254" role="img" aria-label="Setara logo">
    <defs>
      <linearGradient id="g" x1="228" y1="967" x2="980" y2="278" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#00A6CF"/>
        <stop offset="0.5" stop-color="#2FE3C5"/>
        <stop offset="1" stop-color="#98F0C9"/>
      </linearGradient>
    </defs>
    <polygon points="627,181 967,392 967,862 627,1073 287,862 287,392" fill="none" stroke="url(#g)" stroke-width="72" stroke-linejoin="round" stroke-linecap="round"/>
    <polygon points="379,570 479,570 532,543 579,518 608,507 633,505 662,514 710,541 760,568 875,568 842,628 756,628 699,600 657,580 630,576 604,581 556,604 504,629 415,629" fill="url(#g)"/>
    <polygon points="379,720 480,720 532,693 580,668 608,657 633,655 662,664 710,691 760,718 875,718 842,778 756,778 699,750 657,730 630,726 604,731 556,754 504,779 415,779" fill="url(#g)"/>
  </svg>
</p>

<h1 align="center">setara-ui</h1>

<p align="center">SvelteKit 5 frontend for Setara — real-time test execution dashboard, scenario repository, and build tracking</p>

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

### Static build

```bash
npm run build
npm run preview   # preview the production build locally
```

### Docker (via setara-platform)

The frontend image is built and orchestrated by `setara-platform`:

```bash
# From setara-platform directory:
docker compose up frontend

# Or start the full stack:
make live
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

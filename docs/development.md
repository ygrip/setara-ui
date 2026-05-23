# Development

## Requirements

- Node.js 22+
- npm 11+

## Local Commands

```sh
npm install
npm run check
npm run build
npm run dev
```

## Environment

```text
VITE_SETARA_API_BASE_URL=http://localhost:8080
VITE_SETARA_WS_BASE_URL=ws://localhost:8080
```

The frontend should remain deployable separately from `setara-core`. Runtime URLs must be environment driven.

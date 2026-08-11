# CodePilot v2

> Universal Browser-Based Coding Assistant — Phase 0 Foundation

CodePilot is a browser extension and backend architecture designed to assist developers directly inside web-based coding environments.

## Phase 0 Status

Phase 0 establishes a clean, production-oriented baseline environment:

- **Manifest V3 Extension**: Built with React, TypeScript, and Vite.
- **Backend**: Express + TypeScript service providing system telemetry and health status (`/api/health`).
- **Communication Architecture**: Asynchronous messaging handshake between Popup, Background Service Worker, and Content Script with active tab state tracking.
- **Minimal Utility UI**: Uncluttered developer interface following strict non-gimmicky design principles.

---

## Project Structure

```
codePilot/
├── extension/             # Chrome Extension (Manifest V3)
│   ├── public/            # Extension manifest and assets
│   ├── src/
│   │   ├── background/    # Service worker & tab state management
│   │   ├── content/       # Content script handshake
│   │   ├── popup/         # React UI component tree
│   │   └── shared/        # Shared types, constants, logger
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── backend/               # Express + TypeScript Server
│   ├── src/
│   │   ├── config/        # Environment schema validation
│   │   ├── routes/        # API routers (/api/health)
│   │   ├── services/      # Business logic services
│   │   ├── types/         # Service data contracts
│   │   ├── utils/         # Backend logger
│   │   └── server.ts      # Server bootstrap
│   ├── tests/             # Health and state validation unit tests
│   ├── package.json
│   └── tsconfig.json
├── docs/                  # Architecture, Development & Roadmap docs
│   ├── architecture.md
│   ├── development.md
│   └── roadmap.md
├── .gitignore
├── .env.example
├── README.md
└── package.json
```

---

## Development & Build Commands

Run commands from the project root:

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs backend watch server and extension build watcher concurrently |
| `npm run build` | Builds both backend (`backend/dist`) and extension (`extension/dist`) |
| `npm run typecheck` | Validates TypeScript types across backend and extension |
| `npm run lint` | Runs lint checks across workspace packages |
| `npm test` | Runs Phase 0 suite verifying backend health and handshake logic |

---

## Loading the Extension in Chrome

1. Build the extension bundle:
   ```bash
   npm run build
   ```
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in upper right corner).
4. Click **Load unpacked**.
5. Select the `extension/dist` directory.

---

## Running the Backend

```bash
cd backend
npm run dev
```

Test health endpoint:
```bash
curl http://localhost:3000/api/health
```

---

## Limitations (Phase 0)

- No AI agent integration or model providers (OpenRouter/Qwen) implemented yet.
- Problem extraction and page parsing are not active in Phase 0.
- No automatic code submission or DOM manipulation.

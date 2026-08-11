# CodePilot Development Guide

## Environment Prerequisites

- **Node.js**: `>= 18.x` (Tested on `v24.18.1`)
- **npm**: `>= 9.x` (Tested on `11.16.0`)
- **TypeScript**: `~5.4.5`

---

## Development Workflow

### Installation

Dependencies are managed separately per workspace package.

```bash
# Install root, backend, and extension dependencies
npm install && npm --prefix backend install && npm --prefix extension install
```

### Running Local Development Servers

```bash
# Start backend watcher & extension bundler concurrently from project root:
npm run dev
```

### Code Quality Verification

Before committing, run:

```bash
# Typecheck
npm run typecheck

# Linting / Type Validation
npm run lint

# Run Phase 0 test suite
npm test
```

### Building for Production / Chrome

```bash
npm run build
```

Output directories:
- `backend/dist` (Express Server build)
- `extension/dist` (Unpacked Chrome Extension build)

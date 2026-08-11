# CodePilot Architecture — Phase 0

## System Overview

CodePilot v2 is split into two primary decoupled layers:

1. **Browser Runtime (Chrome Extension Manifest V3)**:
   Responsible for UI presentation, tab lifecycle tracking, and page handshake.
2. **Backend Engine (Node.js + Express + TypeScript)**:
   Provides standalone API microservices and status verification.

---

## Extension Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                          Popup UI                           │
│                     (React / App.tsx)                       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                  GET_EXTENSION_STATUS message
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Background Service Worker                  │
│                     (service-worker.ts)                     │
│               - Per-Tab State Map<number, TabState>         │
│               - chrome.tabs.onRemoved / onUpdated listeners │
└──────────────────────────────┬──────────────────────────────┘
                               │
               GET_CONTENT_SCRIPT_STATUS ping
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       Content Script                        │
│                     (content-script.ts)                     │
│               - Initialized event notification             │
│               - Handshake response listener                 │
└─────────────────────────────────────────────────────────────┘
```

### Component Details

- **Popup (`extension/src/popup`)**: Compact 320px UI presenting assistant status, content script connectivity, and page detection state.
- **Background Service Worker (`extension/src/background/service-worker.ts`)**: Maintains an in-memory map of `TabState` keyed by `tabId`. Cleans up state on tab deletion or reset during navigation.
- **Content Script (`extension/src/content/content-script.ts`)**: Injected into active web pages. Sends a `CONTENT_SCRIPT_READY` message upon load and responds to status checks.

---

## Data Models

```typescript
export interface TabState {
  tabId: number;
  contentScriptReady: boolean;
  lastUpdated: number;
}

export interface ExtensionStatusResponsePayload {
  status: ExtensionStatus;
  contentScriptConnected: boolean;
  codingPageDetected: boolean;
  tabId?: number;
  message?: string;
}
```

---

## Backend Architecture

```
HTTP GET /api/health
    │
    ▼
health.router.ts
    │
    ▼
health.service.ts ──► Returns HealthResponse { status: "ok", service: "codepilot-backend", timestamp, uptime }
```

# CodePilot v2 Roadmap

## Phase 0: Foundation (COMPLETED)
- Workspace structure & Manifest V3 configuration.
- React + TypeScript + Vite extension architecture.
- Express + TypeScript backend with `/api/health`.
- Popup ↔ Background ↔ Content Script handshake & tab state.
- Documentation & initial testing suite.

## Phase 1: Browser Runtime
- Enhanced tab lifecycle tracking & persistent background state storage.
- Active tab context detection & permission management.

## Phase 2: Universal Page Detection
- Detection of coding platform URLs (LeetCode, HackerRank, CodeChef, custom problem pages).
- Page type classification engine.

## Phase 3: Problem Extraction
- Parsing DOM structures for problem statements, sample test cases, constraints, and target programming language.

## Phase 4: OpenRouter + Qwen Integration
- Secure provider connection, API key management, and stream response handling.

## Phase 5: Reasoning Agent
- Multi-step reasoning pipeline for problem decomposition and edge-case analysis.

## Phase 6: Code Generation
- Clean code output formatting tailored for target language environments.

## Phase 7: Validation + Debugging
- Static analysis & error reflection loops.

## Phase 8: Editor Adapters
- Monaco, CodeMirror, Ace, and text area content injection adapters.

## Phase 9: Platform Adapters
- Platform-specific quirks & customized extraction/injection adapters.

## Phase 10: Production Hardening
- Performance optimizations, security audits, distribution bundling.

/**
 * Page Bridge Injector
 * Note: page-bridge.js is declared in manifest.json with execution world: "MAIN".
 * Chrome loads page-bridge.js directly into the page context without inline DOM script injection.
 */
export function ensurePageBridgeInjected(): void {
  // No-op: Bridge is registered via manifest.json with world: "MAIN"
}

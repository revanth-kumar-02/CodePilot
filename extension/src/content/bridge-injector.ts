/**
 * Page Bridge Injector
 * Ensures page-bridge.js is active in the main window context.
 */
export function ensurePageBridgeInjected(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const BRIDGE_ID = 'codepilot-monaco-page-bridge-active';
  if ((window as any)[BRIDGE_ID]) return;

  try {
    const scriptId = 'codepilot-page-bridge-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        script.src = chrome.runtime.getURL('page-bridge.js');
        script.onload = () => {
          try {
            script.remove();
          } catch {}
        };
        (document.head || document.documentElement || document.body).appendChild(script);
      }
    }
  } catch {
    // Ignore DOM injection fallback error
  }
}

import { EditorAdapter, EditorType, InsertionResult, MonacoDiagnostics, CompactInsertionDiagnostics, formatCompactDiagnostics } from './types';
import { ensurePageBridgeInjected } from '../bridge-injector';

export class MonacoAdapter implements EditorAdapter {
  public readonly name = 'Monaco Editor Adapter';
  public readonly type: EditorType = 'monaco';

  public detect(): boolean {
    if (typeof document === 'undefined') return false;
    ensurePageBridgeInjected();
    return !!(
      document.querySelector('.monaco-editor') ||
      document.querySelector('[data-mode-id]') ||
      (window as unknown as { monaco?: unknown }).monaco
    );
  }

  private sendBridgeMessage(
    type: 'CODEPILOT_MONACO_PING' | 'CODEPILOT_MONACO_GET' | 'CODEPILOT_MONACO_SET' | 'CODEPILOT_MONACO_CANCEL',
    payload?: { code?: string; targetLanguage?: string; mode?: 'instant' | 'progressive'; insertionId?: string },
    timeoutMs = 15000,
    onProgress?: (progress: number) => void
  ): Promise<any> {
    ensurePageBridgeInjected();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return new Promise((resolve) => {
      let timer: ReturnType<typeof setTimeout> | null = null;

      const resetTimer = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          window.removeEventListener('message', handler);
          const fallbackDiagnostics: MonacoDiagnostics = {
            bridge: 'TIMEOUT',
            monacoRuntime: 'NOT FOUND',
            activeEditor: 'NOT FOUND',
            model: 'NOT FOUND',
            modelUri: 'N/A',
            write: 'FAIL',
            readback: 'FAIL',
            expectedLength: payload?.code ? payload.code.length : 0,
            actualLength: 0,
            verification: 'FAIL',
          };
          resolve({
            source: 'CODEPILOT_PAGE_BRIDGE',
            type: 'CODEPILOT_MONACO_RESULT',
            id: requestId,
            success: false,
            bridgeConnected: false,
            errorCode: 'MONACO_BRIDGE_UNAVAILABLE',
            message: 'MONACO_BRIDGE_UNAVAILABLE: Monaco page bridge timed out or is inaccessible.',
            diagnostics: fallbackDiagnostics,
          });
        }, timeoutMs);
      };

      const handler = (event: MessageEvent) => {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.source !== 'CODEPILOT_PAGE_BRIDGE') return;

        if (data.type === 'CODEPILOT_MONACO_PROGRESS' && data.id === requestId) {
          if (onProgress && typeof data.progress === 'number') {
            onProgress(data.progress);
          }
          resetTimer();
          return;
        }

        if (data.id !== requestId) return;

        if (timer) clearTimeout(timer);
        window.removeEventListener('message', handler);
        resolve(data);
      };

      window.addEventListener('message', handler);

      window.postMessage(
        {
          source: 'CODEPILOT_CONTENT',
          type,
          id: requestId,
          payload,
        },
        '*'
      );

      resetTimer();
    });
  }

  public cancelInsertion(insertionId?: string): void {
    try {
      window.postMessage(
        {
          source: 'CODEPILOT_CONTENT',
          type: 'CODEPILOT_MONACO_CANCEL',
          id: `cancel_${Date.now()}`,
          payload: { insertionId },
        },
        '*'
      );
    } catch {
      // Ignore cancel post error
    }
  }

  public focus(): void {
    try {
      const textarea = document.querySelector('.monaco-editor textarea.inputarea') as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
      }
    } catch {
      // Focus fallback
    }
  }

  public async detectLanguage(): Promise<string | null> {
    try {
      const res = await this.sendBridgeMessage('CODEPILOT_MONACO_PING');
      const lang = res?.safeMetadata?.detectedLanguage || res?.detectedLanguage;
      if (lang) return lang;

      const modeAttr = document.querySelector('[data-mode-id]')?.getAttribute('data-mode-id');
      if (modeAttr) return modeAttr;
    } catch {
      // Ignore
    }
    return null;
  }

  public async getValue(): Promise<string> {
    try {
      const res = await this.sendBridgeMessage('CODEPILOT_MONACO_GET');
      if (res && res.value !== undefined) {
        return res.value;
      }
    } catch {
      // Ignore
    }
    return '';
  }

  public async setValue(code: string): Promise<boolean> {
    const res = await this.insertCode(code, undefined, { mode: 'instant' });
    return res.success;
  }

  public async insertCode(
    code: string,
    targetLanguage?: string,
    options?: import('./types').InsertionOptions
  ): Promise<InsertionResult> {
    ensurePageBridgeInjected();

    const currentUrl = typeof window !== 'undefined' ? window.location.href : 'N/A';
    const isLeetCode = currentUrl.includes('leetcode');
    const platformName = isLeetCode ? 'LeetCode' : currentUrl.includes('codechef') ? 'CodeChef' : 'Generic';

    // 1. Reactive Handshake Polling (poll PING up to 2.5s for async Monaco ready state)
    let pingRes: any = null;
    const startTime = Date.now();
    const maxWaitMs = 2500;

    while (Date.now() - startTime < maxWaitMs) {
      pingRes = await this.sendBridgeMessage('CODEPILOT_MONACO_PING', undefined, 1000);
      if (pingRes && pingRes.bridgeConnected && pingRes.safeMetadata?.modelFound) {
        break;
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    const bridgeAvailable = Boolean(pingRes && pingRes.bridgeConnected);

    if (!bridgeAvailable) {
      const compactDiagnostics: CompactInsertionDiagnostics = {
        platform: platformName,
        url: currentUrl,
        contentScript: 'LOADED',
        extensionContext: typeof chrome !== 'undefined' && chrome.runtime?.id ? 'AVAILABLE' : 'FAILED',
        editorDetector: 'FOUND',
        editorType: 'Monaco',
        editorBridge: 'UNAVAILABLE',
        editorAdapter: this.name,
        insertionRequest: 'RECEIVED',
        write: 'FAIL',
        readback: 'FAIL',
        verification: 'FAIL',
        final: 'FAILED',
      };

      return {
        success: false,
        editorType: 'monaco',
        errorCode: 'MONACO_BRIDGE_UNAVAILABLE',
        message: 'MONACO_BRIDGE_UNAVAILABLE: Monaco page bridge timed out or is inaccessible.',
        diagnostics: pingRes?.diagnostics || {
          bridge: 'TIMEOUT',
          monacoRuntime: 'NOT FOUND',
          activeEditor: 'NOT FOUND',
          model: 'NOT FOUND',
          modelUri: 'N/A',
          write: 'FAIL',
          readback: 'FAIL',
          expectedLength: code.length,
          actualLength: 0,
          verification: 'FAIL',
        },
        compactDiagnostics,
        compactDiagnosticsFormatted: formatCompactDiagnostics(compactDiagnostics),
      };
    }

    const metadata = pingRes.safeMetadata || {};

    if (!metadata.runtimeFound || !metadata.editorFound || !metadata.modelFound) {
      const errorCode = !metadata.runtimeFound
        ? 'EDITOR_NOT_FOUND'
        : !metadata.editorFound
        ? 'EDITOR_NOT_ACCESSIBLE'
        : 'MONACO_MODEL_NOT_FOUND';

      const compactDiagnostics: CompactInsertionDiagnostics = {
        platform: platformName,
        url: currentUrl,
        contentScript: 'LOADED',
        extensionContext: typeof chrome !== 'undefined' && chrome.runtime?.id ? 'AVAILABLE' : 'FAILED',
        editorDetector: metadata.runtimeFound ? 'FOUND' : 'NOT_FOUND',
        editorType: 'Monaco',
        editorBridge: 'AVAILABLE',
        editorAdapter: this.name,
        insertionRequest: 'RECEIVED',
        write: 'FAIL',
        readback: 'FAIL',
        verification: 'FAIL',
        final: 'FAILED',
      };

      return {
        success: false,
        editorType: 'monaco',
        errorCode,
        message: `${errorCode}: Monaco editor runtime or model incomplete.`,
        diagnostics: {
          bridge: 'CONNECTED',
          monacoRuntime: metadata.runtimeFound ? 'FOUND' : 'NOT FOUND',
          activeEditor: metadata.editorFound ? 'FOUND' : 'NOT FOUND',
          model: metadata.modelFound ? 'FOUND' : 'NOT FOUND',
          modelUri: metadata.modelUri || 'N/A',
          write: 'FAIL',
          readback: 'FAIL',
          expectedLength: code.length,
          actualLength: 0,
          verification: 'FAIL',
        },
        compactDiagnostics,
        compactDiagnosticsFormatted: formatCompactDiagnostics(compactDiagnostics),
      };
    }

    // 2. Perform Insertion with verified Bridge + Monaco + Editor + Model
    const setRes = await this.sendBridgeMessage(
      'CODEPILOT_MONACO_SET',
      {
        code,
        targetLanguage,
        mode: options?.mode || 'progressive',
        insertionId: options?.insertionId,
      },
      30000,
      options?.onProgress
    );

    const diagnostics = setRes.diagnostics || {
      bridge: 'CONNECTED',
      monacoRuntime: 'FOUND',
      activeEditor: 'FOUND',
      model: 'FOUND',
      modelUri: metadata.modelUri,
      write: setRes.success ? 'PASS' : 'FAIL',
      readback: setRes.success ? 'PASS' : 'FAIL',
      expectedLength: code.length,
      actualLength: setRes.value ? setRes.value.length : 0,
      verification: setRes.success ? 'PASS' : 'FAIL',
    };

    diagnostics.bridge = 'CONNECTED';
    const isSuccess = Boolean(setRes.success);

    const compactDiagnostics: CompactInsertionDiagnostics = {
      platform: platformName,
      url: currentUrl,
      contentScript: 'LOADED',
      extensionContext: typeof chrome !== 'undefined' && chrome.runtime?.id ? 'AVAILABLE' : 'FAILED',
      editorDetector: 'FOUND',
      editorType: 'Monaco',
      editorBridge: 'AVAILABLE',
      editorAdapter: this.name,
      insertionRequest: 'RECEIVED',
      write: diagnostics.write || (isSuccess ? 'PASS' : 'FAIL'),
      readback: diagnostics.readback || (isSuccess ? 'PASS' : 'FAIL'),
      verification: diagnostics.verification || (isSuccess ? 'PASS' : 'FAIL'),
      final: isSuccess ? 'SUCCESS' : 'FAILED',
    };

    return {
      success: isSuccess,
      editorType: 'monaco',
      errorCode: setRes.errorCode,
      detectedEditorLanguage: setRes.detectedLanguage || metadata.detectedLanguage,
      message: setRes.message || (isSuccess ? '✓ Inserted and verified' : 'Insertion into Monaco Editor failed.'),
      diagnostics,
      compactDiagnostics,
      compactDiagnosticsFormatted: formatCompactDiagnostics(compactDiagnostics),
    };
  }
}

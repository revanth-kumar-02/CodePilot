import { MonacoDiagnostics } from './adapters/types';

export function initMonacoPageBridge(): void {
  if (typeof window === 'undefined') return;

  const BRIDGE_ID = 'codepilot-monaco-page-bridge-active';
  if ((window as any)[BRIDGE_ID]) return;
  (window as any)[BRIDGE_ID] = true;

  function computeTypingDelay(char: string, config?: { minDelay?: number; maxDelay?: number; enabled?: boolean }): number {
    const enabled = config?.enabled ?? true;
    if (!enabled) return 0;
    const min = Math.max(5, config?.minDelay ?? 40);
    const max = Math.max(min, config?.maxDelay ?? 70);
    const base = min + Math.floor(Math.random() * (max - min + 1));
    if (char === '\n') return Math.floor(base * 2.2);
    if (char === ' ' || char === '\t') return Math.floor(base * 1.3);
    return base;
  }

  function findActiveMonaco() {
    const info = {
      runtimeFound: false,
      activeEditorFound: false,
      modelFound: false,
      isDomFallback: false,
      editor: null as any,
      model: null as any,
      modelUri: 'N/A',
      detectedLanguage: null as string | null,
    };

    let monacoGlobal = (window as any).monaco;
    if (!monacoGlobal || !monacoGlobal.editor) {
      try {
        if (typeof (window as any).require === 'function') {
          monacoGlobal = (window as any).require('vs/editor/editor.main');
        }
      } catch {}
    }
    if (!monacoGlobal || !monacoGlobal.editor) {
      try {
        monacoGlobal = (window as any).monacoInstance;
      } catch {}
    }
    if (!monacoGlobal || !monacoGlobal.editor) {
      try {
        for (const key of Object.keys(window)) {
          const val = (window as any)[key];
          if (val && typeof val === 'object' && val.editor && typeof val.editor.getEditors === 'function') {
            monacoGlobal = val;
            break;
          }
        }
      } catch {}
    }

    if (monacoGlobal && monacoGlobal.editor) {
      info.runtimeFound = true;
    }

    // Strategy 1: Find active editor from monaco.editor.getEditors()
    if (monacoGlobal && monacoGlobal.editor && typeof monacoGlobal.editor.getEditors === 'function') {
      const editors = monacoGlobal.editor.getEditors();
      if (Array.isArray(editors) && editors.length > 0) {
        const candidateEditors = editors.filter((e: any) => {
          try {
            if (!e || typeof e.getModel !== 'function') return false;
            if (typeof e.getOption === 'function' && monacoGlobal.editor.EditorOption?.readOnly) {
              if (e.getOption(monacoGlobal.editor.EditorOption.readOnly)) return false;
            }
            return true;
          } catch {
            return false;
          }
        });

        const listToSearch = candidateEditors.length > 0 ? candidateEditors : editors;

        // 1. Focused editor
        let chosen = listToSearch.find((e: any) => {
          try {
            return (
              (typeof e.hasTextFocus === 'function' && e.hasTextFocus()) ||
              (typeof e.hasWidgetFocus === 'function' && e.hasWidgetFocus())
            );
          } catch {
            return false;
          }
        });

        // 2. Visible editor DOM container with model
        if (!chosen) {
          chosen = listToSearch.find((e: any) => {
            try {
              const node = e.getDomNode();
              return node && node.offsetWidth > 0 && node.offsetHeight > 0 && Boolean(e.getModel());
            } catch {
              return false;
            }
          });
        }

        // 3. Fallback to any editor with model
        if (!chosen) {
          chosen = listToSearch.find((e: any) => {
            try {
              return Boolean(e.getModel());
            } catch {
              return false;
            }
          });
        }

        if (chosen) {
          info.activeEditorFound = true;
          info.editor = chosen;
          try {
            const m = chosen.getModel();
            if (m) {
              info.modelFound = true;
              info.model = m;
              info.modelUri = m.uri ? m.uri.toString() : 'inmemory://model/1';
              if (typeof m.getLanguageId === 'function') {
                info.detectedLanguage = m.getLanguageId();
              }
            }
          } catch {
            // Ignore
          }
        }
      }
    }

    // Strategy 2: Search monaco.editor.getModels()
    if (!info.modelFound && monacoGlobal && monacoGlobal.editor && typeof monacoGlobal.editor.getModels === 'function') {
      const models = monacoGlobal.editor.getModels();
      if (Array.isArray(models) && models.length > 0) {
        const validModels = models.filter((m: any) => m && typeof m.getValue === 'function');
        if (validModels.length > 0) {
          const sorted = [...validModels].sort((a: any, b: any) => {
            const lenA = (a.getValue() || '').length;
            const lenB = (b.getValue() || '').length;
            return lenB - lenA;
          });
          const bestModel = sorted[0];
          info.modelFound = true;
          info.model = bestModel;
          info.modelUri = bestModel.uri ? bestModel.uri.toString() : 'inmemory://model/1';
          if (typeof bestModel.getLanguageId === 'function') {
            info.detectedLanguage = bestModel.getLanguageId();
          }
        }
      }
    }

    // Strategy 3: Check DOM elements bound to monaco & React Fiber properties
    if (!info.modelFound) {
      const monacoNodes = document.querySelectorAll('.monaco-editor, [data-mode-id], .react-monaco-editor-container, .hr-monaco-editor');
      for (const node of Array.from(monacoNodes)) {
        let instance = (node as any).__monaco_editor__ || (node as any).editor || (node as any)._editor || (node as any)._editorContext || (node as any).codeEditor;

        if (!instance) {
          const reactKeys = Object.keys(node).filter((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactProps$') || k.startsWith('__reactContainer$'));
          for (const k of reactKeys) {
            let fiber = (node as any)[k];
            let depth = 0;
            while (fiber && depth < 15) {
              if (fiber.memoizedProps) {
                if (fiber.memoizedProps.editor && typeof fiber.memoizedProps.editor.getModel === 'function') {
                  instance = fiber.memoizedProps.editor;
                  break;
                }
              }
              if (fiber.stateNode && fiber.stateNode.editor && typeof fiber.stateNode.editor.getModel === 'function') {
                instance = fiber.stateNode.editor;
                break;
              }
              fiber = fiber.return;
              depth++;
            }
            if (instance) break;
          }
        }

        if (instance && typeof instance.getModel === 'function') {
          info.runtimeFound = true;
          info.activeEditorFound = true;
          info.editor = instance;
          const m = instance.getModel();
          if (m) {
            info.modelFound = true;
            info.model = m;
            info.modelUri = m.uri ? m.uri.toString() : 'inmemory://model/1';
            if (typeof m.getLanguageId === 'function') {
              info.detectedLanguage = m.getLanguageId();
            }
            break;
          }
        }
      }
    }

    // Strategy 4: DOM Fallback for HackerRank / locked Monaco setups
    if (!info.modelFound) {
      const domEditor = document.querySelector('.monaco-editor, [data-mode-id], .react-monaco-editor-container, .hr-monaco-editor');
      if (domEditor) {
        info.runtimeFound = true;
        info.activeEditorFound = true;
        info.modelFound = true;
        info.isDomFallback = true;
        info.modelUri = 'dom://monaco-fallback';
        const langAttr = document.querySelector('[data-mode-id]')?.getAttribute('data-mode-id');
        if (langAttr) {
          info.detectedLanguage = langAttr;
        }
      }
    }

    return info;
  }

  const activeCancelledIds = new Set<string>();

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== 'CODEPILOT_CONTENT' || !data.type || !data.id) return;

    const { type, id, payload } = data;

    if (type === 'CODEPILOT_MONACO_CANCEL') {
      const cancelId = payload?.insertionId || id;
      if (cancelId) {
        activeCancelledIds.add(cancelId);
      }
      return;
    }

    if (type === 'CODEPILOT_MONACO_PING') {
      const target = findActiveMonaco();
      const actualLen = target.isDomFallback
        ? (document.querySelector('.monaco-editor .view-lines') as HTMLElement)?.innerText?.length || 0
        : target.model
        ? (target.model.getValue() || '').length
        : 0;

      const diagnostics: MonacoDiagnostics = {
        bridge: 'CONNECTED',
        monacoRuntime: target.runtimeFound ? 'FOUND' : 'NOT FOUND',
        activeEditor: target.activeEditorFound ? 'FOUND' : 'NOT FOUND',
        model: target.modelFound ? 'FOUND' : 'NOT FOUND',
        modelUri: target.modelUri,
        write: 'FAIL',
        readback: target.modelFound ? 'PASS' : 'FAIL',
        expectedLength: 0,
        actualLength: actualLen,
        verification: 'FAIL',
      };

      window.postMessage(
        {
          source: 'CODEPILOT_PAGE_BRIDGE',
          type: 'CODEPILOT_MONACO_PONG',
          id,
          bridgeConnected: true,
          safeMetadata: {
            runtimeFound: target.runtimeFound,
            editorFound: target.activeEditorFound,
            modelFound: target.modelFound,
            modelUri: target.modelUri,
            detectedLanguage: target.detectedLanguage,
          },
          diagnostics,
        },
        '*'
      );
      return;
    }

    if (type === 'CODEPILOT_MONACO_GET') {
      const target = findActiveMonaco();
      let actualValue = '';
      if (target.isDomFallback) {
        const viewLinesNode = document.querySelector('.monaco-editor .view-lines');
        if (viewLinesNode) {
          actualValue = (viewLinesNode as HTMLElement).innerText || viewLinesNode.textContent || '';
        } else {
          const inputarea = document.querySelector('.monaco-editor textarea.inputarea') as HTMLTextAreaElement;
          actualValue = inputarea ? inputarea.value : '';
        }
      } else {
        actualValue = target.model ? target.model.getValue() || '' : '';
      }

      const diagnostics: MonacoDiagnostics = {
        bridge: 'CONNECTED',
        monacoRuntime: target.runtimeFound ? 'FOUND' : 'NOT FOUND',
        activeEditor: target.activeEditorFound ? 'FOUND' : 'NOT FOUND',
        model: target.modelFound ? 'FOUND' : 'NOT FOUND',
        modelUri: target.modelUri,
        write: 'FAIL',
        readback: target.modelFound ? 'PASS' : 'FAIL',
        expectedLength: 0,
        actualLength: actualValue.length,
        verification: 'FAIL',
      };

      window.postMessage(
        {
          source: 'CODEPILOT_PAGE_BRIDGE',
          type: 'CODEPILOT_MONACO_RESULT',
          id,
          success: target.modelFound,
          errorCode: target.runtimeFound
            ? target.modelFound
              ? undefined
              : 'MONACO_MODEL_NOT_FOUND'
            : 'MONACO_BRIDGE_UNAVAILABLE',
          diagnostics,
          value: actualValue,
          detectedLanguage: target.detectedLanguage,
        },
        '*'
      );
      return;
    }

    if (type === 'CODEPILOT_MONACO_SET') {
      const code = payload?.code || '';
      const mode = payload?.mode || 'progressive';
      const insertionId = payload?.insertionId || id;
      const target = findActiveMonaco();

      const diagnostics: MonacoDiagnostics = {
        bridge: 'CONNECTED',
        monacoRuntime: target.runtimeFound ? 'FOUND' : 'NOT FOUND',
        activeEditor: target.activeEditorFound ? 'FOUND' : 'NOT FOUND',
        model: target.modelFound ? 'FOUND' : 'NOT FOUND',
        modelUri: target.modelUri,
        write: 'FAIL',
        readback: 'FAIL',
        expectedLength: code.length,
        actualLength: 0,
        verification: 'FAIL',
      };

      if (!target.runtimeFound) {
        window.postMessage(
          {
            source: 'CODEPILOT_PAGE_BRIDGE',
            type: 'CODEPILOT_MONACO_RESULT',
            id,
            success: false,
            errorCode: 'MONACO_BRIDGE_UNAVAILABLE',
            message: 'MONACO_BRIDGE_UNAVAILABLE: Monaco runtime not found in page context.',
            diagnostics,
          },
          '*'
        );
        return;
      }

      if (!target.isDomFallback && (!target.modelFound || !target.model)) {
        window.postMessage(
          {
            source: 'CODEPILOT_PAGE_BRIDGE',
            type: 'CODEPILOT_MONACO_RESULT',
            id,
            success: false,
            errorCode: 'MONACO_MODEL_NOT_FOUND',
            message: 'MONACO_MODEL_NOT_FOUND: Could not locate active Monaco editor model.',
            diagnostics,
          },
          '*'
        );
        return;
      }

      // 1. Focus active editor
      if (target.editor && typeof target.editor.focus === 'function') {
        try {
          target.editor.focus();
        } catch {
          // Ignore focus failure
        }
      }

      // Remove cancellation flag if set previously
      activeCancelledIds.delete(insertionId);

      const performReadbackVerification = (actualValue: string) => {
        diagnostics.readback = actualValue ? 'PASS' : 'FAIL';
        diagnostics.actualLength = actualValue.length;

        const normExpected = code.replace(/\r\n/g, '\n').trim();
        const normActual = actualValue.replace(/\r\n/g, '\n').trim();
        const isVerified =
          normActual === normExpected ||
          normActual.includes(normExpected) ||
          normExpected.includes(normActual);

        diagnostics.verification = isVerified ? 'PASS' : 'FAIL';

        if (isVerified) {
          window.postMessage(
            {
              source: 'CODEPILOT_PAGE_BRIDGE',
              type: 'CODEPILOT_MONACO_RESULT',
              id,
              success: true,
              message: '✓ Inserted and verified',
              diagnostics,
              value: actualValue,
              detectedLanguage: target.detectedLanguage,
            },
            '*'
          );
        } else {
          window.postMessage(
            {
              source: 'CODEPILOT_PAGE_BRIDGE',
              type: 'CODEPILOT_MONACO_RESULT',
              id,
              success: false,
              errorCode: 'INSERTION_VERIFICATION_FAILED',
              message: 'INSERTION_VERIFICATION_FAILED: Written code does not match model readback value.',
              diagnostics,
              value: actualValue,
              detectedLanguage: target.detectedLanguage,
            },
            '*'
          );
        }
      };

      if (target.isDomFallback) {
        const inputarea = document.querySelector('.monaco-editor textarea.inputarea, .ace_text-input, textarea') as HTMLTextAreaElement;
        if (!inputarea) {
          window.postMessage(
            {
              source: 'CODEPILOT_PAGE_BRIDGE',
              type: 'CODEPILOT_MONACO_RESULT',
              id,
              success: false,
              errorCode: 'EDITOR_NOT_ACCESSIBLE',
              message: 'EDITOR_NOT_ACCESSIBLE: Editor input textarea not accessible in DOM.',
              diagnostics,
            },
            '*'
          );
          return;
        }

        try {
          inputarea.focus();
        } catch {}

        let currentLength = 0;
        const totalLength = code.length;

        try {
          inputarea.select();
          document.execCommand('selectAll', false);
        } catch {}

        const domStep = () => {
          if (activeCancelledIds.has(insertionId)) {
            activeCancelledIds.delete(insertionId);
            window.postMessage(
              {
                source: 'CODEPILOT_PAGE_BRIDGE',
                type: 'CODEPILOT_MONACO_RESULT',
                id,
                success: false,
                errorCode: 'INSERTION_CANCELLED',
                message: 'INSERTION_CANCELLED',
                diagnostics,
              },
              '*'
            );
            return;
          }

          if (currentLength >= totalLength) {
            diagnostics.write = 'PASS';
            const viewLines = document.querySelector('.monaco-editor .view-lines');
            const actualVal = viewLines ? (viewLines as HTMLElement).innerText || '' : inputarea.value || '';
            performReadbackVerification(actualVal);
            return;
          }

          if (mode === 'instant') {
            try {
              document.execCommand('insertText', false, code);
              inputarea.dispatchEvent(new Event('input', { bubbles: true }));
            } catch {
              inputarea.value = code;
              inputarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
            diagnostics.write = 'PASS';
            const viewLines = document.querySelector('.monaco-editor .view-lines');
            const actualVal = viewLines ? (viewLines as HTMLElement).innerText || '' : inputarea.value || '';
            performReadbackVerification(actualVal);
            return;
          }

          const charToInsert = code[currentLength];
          currentLength++;

          try {
            document.execCommand('insertText', false, charToInsert);
          } catch {
            try {
              inputarea.value = charToInsert;
              inputarea.dispatchEvent(new Event('input', { bubbles: true }));
            } catch {
              // Ignore fallback errors
            }
          }

          const key = charToInsert === '\n' ? 'Enter' : charToInsert === '\t' ? 'Tab' : charToInsert;
          const keyOpts = { key, bubbles: true, cancelable: true };
          inputarea.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
          inputarea.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: charToInsert, bubbles: true }));
          inputarea.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: charToInsert, bubbles: true }));
          inputarea.dispatchEvent(new KeyboardEvent('keyup', keyOpts));

          const progress = Math.min(100, Math.floor((currentLength / totalLength) * 100));
          window.postMessage(
            {
              source: 'CODEPILOT_PAGE_BRIDGE',
              type: 'CODEPILOT_MONACO_PROGRESS',
              id,
              insertionId,
              progress,
            },
            '*'
          );

          const delay = computeTypingDelay(charToInsert, payload?.typingSpeed);
          setTimeout(domStep, delay);
        };

        domStep();
        return;
      }

      if (mode === 'instant') {
        let writePass = false;
        try {
          if (typeof target.model.setValue === 'function') {
            target.model.setValue(code);
            writePass = true;
          }
        } catch {
          try {
            if (target.editor && typeof target.editor.setValue === 'function') {
              target.editor.setValue(code);
              writePass = true;
            }
          } catch {
            writePass = false;
          }
        }

        diagnostics.write = writePass ? 'PASS' : 'FAIL';

        if (!writePass) {
          window.postMessage(
            {
              source: 'CODEPILOT_PAGE_BRIDGE',
              type: 'CODEPILOT_MONACO_RESULT',
              id,
              success: false,
              errorCode: 'INSERTION_VERIFICATION_FAILED',
              message: 'INSERTION_VERIFICATION_FAILED: Failed to set Monaco model value.',
              diagnostics,
            },
            '*'
          );
          return;
        }

        let actualValue = '';
        try {
          actualValue = target.model.getValue() || '';
        } catch {
          actualValue = '';
        }

        performReadbackVerification(actualValue);
        return;
      }

      // Strict Anti-Detection Character-by-Character Typing Mode
      let currentLength = 0;
      const totalLength = code.length;

      // Clear existing model content ONCE at start of typing
      try {
        target.model.setValue('');
      } catch {
        // Ignore initial clear error
      }

      const step = () => {
        if (activeCancelledIds.has(insertionId)) {
          activeCancelledIds.delete(insertionId);
          window.postMessage(
            {
              source: 'CODEPILOT_PAGE_BRIDGE',
              type: 'CODEPILOT_MONACO_RESULT',
              id,
              success: false,
              errorCode: 'INSERTION_CANCELLED',
              message: 'INSERTION_CANCELLED',
              diagnostics,
            },
            '*'
          );
          return;
        }

        if (currentLength >= totalLength) {
          diagnostics.write = 'PASS';
          let actualValue = '';
          try {
            actualValue = target.model.getValue() || '';
          } catch {
            actualValue = '';
          }
          performReadbackVerification(actualValue);
          return;
        }

        const charToInsert = code[currentLength];
        currentLength++;

        const currentSlice = code.slice(0, currentLength);
        try {
          target.model.setValue(currentSlice);
        } catch {
          // Fallback ignore
        }

        // Anti-Detection: Dispatch DOM Key & Input Events
        try {
          const domNode =
            target.editor && typeof target.editor.getDomNode === 'function'
              ? target.editor.getDomNode()
              : document.activeElement;
          if (domNode) {
            const key = charToInsert === '\n' ? 'Enter' : charToInsert === '\t' ? 'Tab' : charToInsert;
            const keyOpts = { key, bubbles: true, cancelable: true };
            domNode.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
            domNode.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: charToInsert, bubbles: true }));
            domNode.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: charToInsert, bubbles: true }));
            domNode.dispatchEvent(new KeyboardEvent('keyup', keyOpts));
          }
        } catch {
          // Ignore event dispatch errors
        }

        if (target.editor && typeof target.editor.revealPosition === 'function') {
          try {
            const lineCount = target.model.getLineCount();
            const maxCol = target.model.getLineMaxColumn(lineCount);
            target.editor.revealPosition({ lineNumber: lineCount, column: maxCol });
          } catch {
            // Ignore reveal error
          }
        }

        const progress = Math.min(100, Math.floor((currentLength / totalLength) * 100));

        window.postMessage(
          {
            source: 'CODEPILOT_PAGE_BRIDGE',
            type: 'CODEPILOT_MONACO_PROGRESS',
            id,
            insertionId,
            progress,
          },
          '*'
        );

        const delay = computeTypingDelay(charToInsert, payload?.typingSpeed);
        setTimeout(step, delay);
      };

      step();
    }
  });
}

// Auto-run when injected into browser window
if (typeof window !== 'undefined') {
  initMonacoPageBridge();
}

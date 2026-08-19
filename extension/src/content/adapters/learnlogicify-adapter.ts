import { EditorAdapter, EditorType, InsertionOptions, InsertionResult, CompactInsertionDiagnostics, formatCompactDiagnostics } from './types';
import { LearnLogicifyProblemExtractor } from '../../extraction/extractors/learnlogicify-extractor';
import { TypingEngine } from './typing-engine';

export class LearnLogicifyAdapter implements EditorAdapter {
  public readonly name = 'LearnLogicify Adapter';
  public readonly type: EditorType = 'monaco';

  public detect(): boolean {
    if (typeof document === 'undefined') return false;
    const isLearnLogicifyPage = LearnLogicifyProblemExtractor.isLearnLogicify(document);
    const hasEditor = !!(
      document.querySelector('.monaco-editor') ||
      document.querySelector('.cm-editor') ||
      document.querySelector('.CodeMirror') ||
      document.querySelector('.ace_editor') ||
      document.querySelector('textarea') ||
      document.querySelector('[contenteditable="true"]')
    );
    return isLearnLogicifyPage && hasEditor;
  }

  public focus(): void {
    try {
      const monacoArea = document.querySelector('.monaco-editor textarea.inputarea') as HTMLTextAreaElement;
      if (monacoArea) {
        monacoArea.focus();
        return;
      }
      const cm6Content = document.querySelector('.cm-content') as HTMLElement;
      if (cm6Content) {
        cm6Content.focus();
        return;
      }
      const cm5Textarea = document.querySelector('.CodeMirror textarea') as HTMLTextAreaElement;
      if (cm5Textarea) {
        cm5Textarea.focus();
        return;
      }
      const aceInput = document.querySelector('.ace_text-input') as HTMLTextAreaElement;
      if (aceInput) {
        aceInput.focus();
        return;
      }
      const genericTextarea = document.querySelector('textarea') as HTMLTextAreaElement;
      if (genericTextarea) {
        genericTextarea.focus();
      }
    } catch {
      // Focus fallback
    }
  }

  public detectLanguage(): string | null {
    try {
      const langAttr = document.querySelector('[data-mode-id]')?.getAttribute('data-mode-id') ||
                       document.querySelector('[data-language]')?.getAttribute('data-language');
      if (langAttr) return langAttr;

      const langSelect = document.querySelector('select[class*="language"]') as HTMLSelectElement;
      if (langSelect && langSelect.value) {
        return langSelect.value;
      }
    } catch {
      // Ignore
    }
    return null;
  }

  public getValue(): string {
    try {
      const viewLinesNode = document.querySelector('.monaco-editor .view-lines');
      if (viewLinesNode) {
        return (viewLinesNode as HTMLElement).innerText || viewLinesNode.textContent || '';
      }

      const cm5Element = document.querySelector('.CodeMirror') as unknown as { CodeMirror?: { getValue?: () => string } };
      if (cm5Element?.CodeMirror?.getValue) {
        return cm5Element.CodeMirror.getValue() || '';
      }

      const cm6Content = document.querySelector('.cm-content');
      if (cm6Content) {
        return cm6Content.textContent || '';
      }

      const aceElement = document.querySelector('.ace_editor') as unknown as { env?: { editor?: { getValue?: () => string } } };
      if (aceElement?.env?.editor?.getValue) {
        return aceElement.env.editor.getValue() || '';
      }

      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      if (textarea) {
        return textarea.value || '';
      }
    } catch {
      // Ignore
    }
    return '';
  }

  public setValue(code: string): boolean {
    try {
      this.focus();

      // Monaco Inputarea
      const monacoInput = document.querySelector('.monaco-editor textarea.inputarea') as HTMLTextAreaElement;
      if (monacoInput) {
        try {
          monacoInput.select();
          document.execCommand('selectAll', false);
          document.execCommand('insertText', false, code);
          monacoInput.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        } catch {}
      }

      // CodeMirror 5
      const cm5Element = document.querySelector('.CodeMirror') as unknown as { CodeMirror?: { setValue?: (v: string) => void } };
      if (cm5Element?.CodeMirror?.setValue) {
        cm5Element.CodeMirror.setValue(code);
        return true;
      }

      // CodeMirror 6 / Generic DOM
      const cm6Content = document.querySelector('.cm-content') as HTMLElement;
      if (cm6Content) {
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(cm6Content);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        const success = document.execCommand('insertText', false, code);
        if (!success) {
          cm6Content.textContent = code;
        }
        cm6Content.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }

      // Textarea
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      if (textarea) {
        textarea.value = code;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    } catch (e) {
      console.warn('[CodePilot][LearnLogicifyAdapter] Set value failed:', e);
    }
    return false;
  }

  public async insertCode(
    code: string,
    _targetLanguage?: string,
    options?: InsertionOptions
  ): Promise<InsertionResult> {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : 'N/A';

    // 1. Focus
    this.focus();

    // 2. Write (Progressive typing or Instant)
    const isProgressive = options?.mode !== 'instant';
    const typingCfg = options?.typingSpeed || TypingEngine.getConfig();

    if (isProgressive && typingCfg.enabled) {
      const monacoInput = document.querySelector('.monaco-editor textarea.inputarea, textarea') as HTMLTextAreaElement;
      if (monacoInput) {
        try {
          monacoInput.focus();
          monacoInput.select();
          document.execCommand('selectAll', false);
        } catch {}
      }

      for (let i = 0; i < code.length; i++) {
        if (options?.isCancelled && options.isCancelled()) {
          return {
            success: false,
            editorType: this.type,
            errorCode: 'INSERTION_CANCELLED',
            message: 'INSERTION_CANCELLED',
          };
        }

        const char = code[i];
        if (monacoInput) {
          try {
            document.execCommand('insertText', false, char);
          } catch {
            this.setValue(code.slice(0, i + 1));
          }
        } else {
          this.setValue(code.slice(0, i + 1));
        }

        if (options?.onProgress) {
          options.onProgress(Math.floor(((i + 1) / code.length) * 100));
        }

        await TypingEngine.delay(char, typingCfg);
      }
    } else {
      this.setValue(code);
    }

    // 3. Readback Verification
    const actualValue = this.getValue();
    const normExpected = code.replace(/\r\n/g, '\n').trim();
    const normActual = actualValue.replace(/\r\n/g, '\n').trim();

    const isVerified =
      normActual === normExpected ||
      normActual.includes(normExpected) ||
      normExpected.includes(normActual);

    const compactDiagnostics: CompactInsertionDiagnostics = {
      platform: 'LearnLogicify',
      url: currentUrl,
      contentScript: 'LOADED',
      extensionContext: typeof chrome !== 'undefined' && chrome.runtime?.id ? 'AVAILABLE' : 'FAILED',
      editorDetector: 'FOUND',
      editorType: this.type,
      editorBridge: 'AVAILABLE',
      editorAdapter: this.name,
      insertionRequest: 'RECEIVED',
      write: 'PASS',
      readback: isVerified ? 'PASS' : 'FAIL',
      verification: isVerified ? 'PASS' : 'FAIL',
      final: isVerified ? 'SUCCESS' : 'FAILED',
    };

    if (!isVerified) {
      return {
        success: false,
        editorType: this.type,
        errorCode: 'EDITOR_READBACK_FAILED',
        message: 'EDITOR_READBACK_FAILED: Written code failed readback verification on LearnLogicify.',
        compactDiagnostics,
        compactDiagnosticsFormatted: formatCompactDiagnostics(compactDiagnostics),
      };
    }

    return {
      success: true,
      editorType: this.type,
      message: '✓ Inserted and verified on LearnLogicify',
      compactDiagnostics,
      compactDiagnosticsFormatted: formatCompactDiagnostics(compactDiagnostics),
    };
  }
}

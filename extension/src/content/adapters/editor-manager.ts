import { EditorAdapter, InsertionResult } from './types';
import { MonacoAdapter } from './monaco-adapter';
import { CodeMirrorAdapter } from './codemirror-adapter';
import { AceAdapter } from './ace-adapter';
import { ContentEditableAdapter } from './contenteditable-adapter';
import { TextareaAdapter } from './textarea-adapter';
import { LanguageRegistry, SupportedLanguage } from '../../shared/language-registry';

export class EditorManager {
  private static adapters: EditorAdapter[] = [
    new MonacoAdapter(),
    new CodeMirrorAdapter(),
    new AceAdapter(),
    new ContentEditableAdapter(),
    new TextareaAdapter(),
  ];

  public static getActiveAdapter(): EditorAdapter | null {
    for (const adapter of this.adapters) {
      if (adapter.detect()) {
        return adapter;
      }
    }
    return null;
  }

  private static activeCancelledIds = new Set<string>();

  public static cancelInsertion(insertionId?: string): void {
    if (insertionId) {
      this.activeCancelledIds.add(insertionId);
    }
    const adapter = this.getActiveAdapter() as any;
    if (adapter && typeof adapter.cancelInsertion === 'function') {
      adapter.cancelInsertion(insertionId);
    }
  }

  public static normalizeCode(code: string): string {
    return code.replace(/\r\n/g, '\n').trim();
  }

  public static async insertCode(
    code: string,
    targetLanguage?: SupportedLanguage,
    forceInsert: boolean = false,
    options?: import('./types').InsertionOptions
  ): Promise<InsertionResult> {
    const adapter = this.getActiveAdapter();
    if (!adapter) {
      return {
        success: false,
        editorType: 'unknown',
        errorCode: 'EDITOR_NOT_FOUND',
        message: 'EDITOR_NOT_FOUND: No supported code editor detected on page.',
      };
    }

    if (options?.insertionId) {
      this.activeCancelledIds.delete(options.insertionId);
    }

    // 1. Language Mismatch Check
    if (targetLanguage && !forceInsert && typeof adapter.detectLanguage === 'function') {
      const detectedRaw = await adapter.detectLanguage();
      if (detectedRaw) {
        const detectedNormalized = LanguageRegistry.normalize(detectedRaw);
        if (detectedNormalized !== targetLanguage) {
          return {
            success: false,
            editorType: adapter.type,
            errorCode: 'LANGUAGE_MISMATCH',
            detectedEditorLanguage: detectedNormalized,
            message: `Language mismatch: CodePilot (${LanguageRegistry.getInfo(targetLanguage).displayName}) vs Editor (${LanguageRegistry.getInfo(detectedNormalized).displayName})`,
          };
        }
      }
    }

    // 2. Delegate to custom insertCode if adapter provides it (e.g. MonacoAdapter with Page Bridge)
    if (typeof adapter.insertCode === 'function') {
      const customRes = await adapter.insertCode(code, targetLanguage, options);
      if (customRes) {
        return customRes;
      }
    }

    // 3. Fallback standard / progressive write & readback logic
    try {
      adapter.focus();
    } catch {
      // Ignore focus error
    }

    const isCancelled = () => {
      if (options?.insertionId && this.activeCancelledIds.has(options.insertionId)) return true;
      if (options?.isCancelled && options.isCancelled()) return true;
      return false;
    };

    if (options?.mode === 'instant') {
      const writeSuccess = await adapter.setValue(code);
      if (!writeSuccess) {
        return {
          success: false,
          editorType: adapter.type,
          errorCode: 'EDITOR_NOT_ACCESSIBLE',
          message: 'EDITOR_NOT_ACCESSIBLE: Failed to write code into detected editor.',
        };
      }
    } else {
      let currentLength = 0;
      const totalLength = code.length;
      const chunkSize = Math.max(1, Math.min(3, Math.ceil(totalLength / 120)));

      while (currentLength < totalLength) {
        if (isCancelled()) {
          if (options?.insertionId) this.activeCancelledIds.delete(options.insertionId);
          return {
            success: false,
            editorType: adapter.type,
            errorCode: 'INSERTION_CANCELLED',
            message: 'INSERTION_CANCELLED',
          };
        }

        currentLength = Math.min(totalLength, currentLength + chunkSize);
        const chunkText = code.slice(0, currentLength);
        await adapter.setValue(chunkText);

        try {
          adapter.focus();
        } catch {
          // Ignore focus error
        }

        const progress = Math.min(100, Math.floor((currentLength / totalLength) * 100));
        if (options?.onProgress) {
          options.onProgress(progress);
        }

        if (currentLength < totalLength) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }
    }

    const readback = await adapter.getValue();
    const isVerified = this.verifyReadback(code, readback);

    if (isVerified) {
      return {
        success: true,
        editorType: adapter.type,
        message: '✓ Inserted and verified',
      };
    }

    return {
      success: false,
      editorType: adapter.type,
      errorCode: 'INSERTION_VERIFICATION_FAILED',
      message: 'INSERTION_VERIFICATION_FAILED: Editor write completed but failed readback verification.',
    };
  }

  public static verifyReadback(expected: string, readback: string): boolean {
    if (!readback || readback.trim().length === 0) return false;
    const normExpected = this.normalizeCode(expected);
    const normReadback = this.normalizeCode(readback);

    return normReadback === normExpected || normReadback.includes(normExpected) || normExpected.includes(normReadback);
  }

  public static async getEditorValue(): Promise<string> {
    const adapter = this.getActiveAdapter();
    return adapter ? await adapter.getValue() : '';
  }
}

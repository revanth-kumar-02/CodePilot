import { EditorAdapter, InsertionResult, InsertionOptions } from './types';
import { MonacoAdapter } from './monaco-adapter';
import { CodeChefAdapter } from './codechef-adapter';
import { CodeMirrorAdapter } from './codemirror-adapter';
import { AceAdapter } from './ace-adapter';
import { ContentEditableAdapter } from './contenteditable-adapter';
import { TextareaAdapter } from './textarea-adapter';
import { LanguageRegistry, SupportedLanguage } from '../../shared/language-registry';
import { JavaStructureValidator } from '../../shared/java-structure-validator.ts';
import { Logger } from '../../shared/utils/logger';

const logger = new Logger('EditorManager');

export class EditorManager {
  private static adapters: EditorAdapter[] = [
    new MonacoAdapter(),
    new CodeChefAdapter(),
    new CodeMirrorAdapter(),
    new AceAdapter(),
    new ContentEditableAdapter(),
    new TextareaAdapter(),
  ];

  private static isInserting = false;
  private static activeInsertionId: string | null = null;
  private static completedInsertionIds = new Set<string>();
  private static activeCancelledIds = new Set<string>();
  private static isCodePilotInserting = false;

  public static isCodePilotWriting(): boolean {
    return this.isCodePilotInserting || this.isInserting;
  }

  public static getActiveInsertionId(): string | null {
    return this.activeInsertionId;
  }

  public static getActiveAdapter(): EditorAdapter | null {
    for (const adapter of this.adapters) {
      if (adapter.detect()) {
        return adapter;
      }
    }
    return null;
  }

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

  public static validateJavaStructure(code: string, platform?: string): { valid: boolean; reason?: string } {
    const norm = this.normalizeCode(code);

    // 1. Check for duplicate public class declarations
    const publicClassMatches = norm.match(/public\s+class\s+\w+/g) || [];
    if (publicClassMatches.length > 1) {
      return { valid: false, reason: `Multiple public class declarations found: ${publicClassMatches.length}` };
    }

    // 2. Check for duplicate 'public class Main'
    const mainMatches = norm.match(/public\s+class\s+Main/g) || [];
    if (mainMatches.length > 1) {
      return { valid: false, reason: `Duplicate 'public class Main' declarations detected: ${mainMatches.length}` };
    }

    // 3. Run JavaStructureValidator if available
    const expectedClass = platform === 'leetcode' ? 'Solution' : 'Main';
    const validation = JavaStructureValidator.validate(norm, expectedClass as any);
    if (!validation.valid) {
      return { valid: false, reason: validation.issues.join('; ') };
    }

    return { valid: true };
  }

  public static async insertCode(
    code: string,
    targetLanguage?: SupportedLanguage,
    _forceInsert: boolean = false,
    options?: InsertionOptions
  ): Promise<InsertionResult> {
    const insertionId = options?.insertionId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ins_${Date.now()}`);

    // 1. Single Insert Guarantee & Insertion Lock
    if (this.isInserting || (insertionId && this.completedInsertionIds.has(insertionId))) {
      logger.warn(`Insertion ID: ${insertionId} | Duplicate Guard: BLOCKED | Final: DUPLICATE_INSERTION_BLOCKED`);
      return {
        success: false,
        editorType: 'unknown',
        errorCode: 'DUPLICATE_INSERTION_BLOCKED',
        message: 'DUPLICATE_INSERTION_BLOCKED: Insertion operation already in progress or completed for this ID.',
      };
    }

    this.isInserting = true;
    this.activeInsertionId = insertionId;
    this.isCodePilotInserting = true;

    try {
      const adapter = this.getActiveAdapter();
      const platformName = typeof window !== 'undefined' && window.location ? window.location.hostname : 'unknown';

      const currentActiveId = this.activeInsertionId;
      logger.info(`Insertion ID: ${insertionId} (active: ${currentActiveId})\nPlatform: ${platformName}\nEditor: ${adapter?.type || 'none'}\nRequest: START`);

      if (!adapter) {
        logger.warn(`Insertion ID: ${insertionId} | Editor: NONE | Final: FAILED`);
        return {
          success: false,
          editorType: 'unknown',
          errorCode: 'EDITOR_NOT_FOUND',
          message: 'EDITOR_NOT_FOUND: No supported code editor detected on page.',
        };
      }

      // 2. Structure Validation (Java)
      if (targetLanguage === 'java' || LanguageRegistry.normalize(targetLanguage) === 'java') {
        const platform = platformName.includes('leetcode') ? 'leetcode' : 'generic';
        const javaCheck = this.validateJavaStructure(code, platform);
        if (!javaCheck.valid) {
          logger.warn(`Insertion ID: ${insertionId} | Java Validation: FAIL (${javaCheck.reason}) | Final: FAILED`);
          return {
            success: false,
            editorType: adapter.type,
            errorCode: 'CODE_STRUCTURE_INVALID',
            message: `CODE_STRUCTURE_INVALID: ${javaCheck.reason}`,
          };
        }
      }

      // 3. Idempotency Check (Already inserted)
      const currentContent = await adapter.getValue();
      if (this.normalizeCode(currentContent) === this.normalizeCode(code)) {
        this.completedInsertionIds.add(insertionId);
        logger.info(`Insertion ID: ${insertionId} | Duplicate Guard: PASS | Final: ALREADY_INSERTED`);
        return {
          success: true,
          editorType: adapter.type,
          errorCode: 'ALREADY_INSERTED',
          message: 'ALREADY_INSERTED: Exact generated code is already present in the editor.',
        };
      }

      if (options?.insertionId) {
        this.activeCancelledIds.delete(options.insertionId);
      }

      // 4. Custom Adapter Handling (e.g. MonacoAdapter)
      if (typeof adapter.insertCode === 'function') {
        const customRes = await adapter.insertCode(code, targetLanguage, options);
        if (customRes) {
          if (customRes.success) this.completedInsertionIds.add(insertionId);
          logger.info(`Insertion ID: ${insertionId} | Write: ${customRes.success ? 'PASS' : 'FAIL'} | Final: ${customRes.success ? 'INSERTED' : 'FAILED'}`);
          return customRes;
        }
      }

      // 5. Standard Atomic Write Operation
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

      if (isCancelled()) {
        return {
          success: false,
          editorType: adapter.type,
          errorCode: 'INSERTION_CANCELLED',
          message: 'INSERTION_CANCELLED',
        };
      }

      // Perform single atomic replace write
      const writeSuccess = await adapter.setValue(code);
      if (!writeSuccess) {
        logger.warn(`Insertion ID: ${insertionId} | Write: FAIL | Final: FAILED`);
        return {
          success: false,
          editorType: adapter.type,
          errorCode: 'EDITOR_NOT_ACCESSIBLE',
          message: 'EDITOR_NOT_ACCESSIBLE: Failed to write code into detected editor.',
        };
      }

      // 6. Readback & Verification
      await new Promise((resolve) => setTimeout(resolve, 60));
      const readback = await adapter.getValue();
      const isVerified = this.verifyReadback(code, readback);

      if (isVerified) {
        this.completedInsertionIds.add(insertionId);
        logger.info(`Insertion ID: ${insertionId} | Write: PASS | Readback: PASS | Final: INSERTED`);
        return {
          success: true,
          editorType: adapter.type,
          message: '✓ Inserted and verified',
        };
      }

      logger.warn(`Insertion ID: ${insertionId} | Write: PASS | Readback: FAIL | Final: FAILED`);
      return {
        success: false,
        editorType: adapter.type,
        errorCode: 'INSERTION_VERIFICATION_FAILED',
        message: 'INSERTION_VERIFICATION_FAILED: Editor write completed but failed readback verification.',
      };
    } finally {
      this.isInserting = false;
      this.activeInsertionId = null;
      // Allow DOM event propagation to settle before lifting MutationObserver guard
      setTimeout(() => {
        this.isCodePilotInserting = false;
      }, 100);
    }
  }

  public static verifyReadback(expected: string, readback: string): boolean {
    if (!readback || readback.trim().length === 0) return false;
    const normExpected = this.normalizeCode(expected);
    const normReadback = this.normalizeCode(readback);

    return normReadback === normExpected || normReadback.includes(normExpected);
  }

  public static async getEditorValue(): Promise<string> {
    const adapter = this.getActiveAdapter();
    return adapter ? await adapter.getValue() : '';
  }
}

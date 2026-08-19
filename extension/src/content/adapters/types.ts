export type EditorType = 'monaco' | 'codemirror' | 'ace' | 'contenteditable' | 'textarea' | 'unknown';

export type EditorErrorCode =
  | 'EDITOR_NOT_FOUND'
  | 'EDITOR_NOT_ACCESSIBLE'
  | 'LANGUAGE_MISMATCH'
  | 'MONACO_BRIDGE_UNAVAILABLE'
  | 'MONACO_MODEL_NOT_FOUND'
  | 'INSERTION_VERIFICATION_FAILED'
  | 'EDITOR_READBACK_FAILED'
  | 'INSERTION_CANCELLED'
  | 'ALREADY_INSERTED'
  | 'CODE_STRUCTURE_INVALID'
  | 'DUPLICATE_INSERTION_BLOCKED';

export interface MonacoDiagnostics {
  bridge?: 'CONNECTED' | 'TIMEOUT';
  monacoRuntime: 'FOUND' | 'NOT FOUND';
  activeEditor: 'FOUND' | 'NOT FOUND';
  model: 'FOUND' | 'NOT FOUND';
  modelUri?: string;
  write: 'PASS' | 'FAIL';
  readback: 'PASS' | 'FAIL';
  expectedLength: number;
  actualLength: number;
  verification: 'PASS' | 'FAIL';
}

export interface InsertionOptions {
  mode?: 'instant' | 'progressive';
  insertionId?: string;
  typingSpeed?: { minDelay: number; maxDelay: number; enabled: boolean };
  onProgress?: (progress: number) => void;
  isCancelled?: () => boolean;
}

export interface CompactInsertionDiagnostics {
  platform: string;
  url: string;
  contentScript: 'LOADED' | 'NOT_LOADED';
  extensionContext: 'AVAILABLE' | 'FAILED';
  editorDetector: 'FOUND' | 'NOT_FOUND';
  editorType: string;
  editorBridge: 'AVAILABLE' | 'UNAVAILABLE';
  editorAdapter: string;
  insertionRequest: 'RECEIVED' | 'NOT_RECEIVED';
  write: 'PASS' | 'FAIL';
  readback: 'PASS' | 'FAIL';
  verification: 'PASS' | 'FAIL';
  final: 'SUCCESS' | 'FAILED';
}

export function formatCompactDiagnostics(diag: CompactInsertionDiagnostics): string {
  return [
    `Platform:`,
    diag.platform,
    ``,
    `URL:`,
    diag.url,
    ``,
    `Content Script:`,
    diag.contentScript,
    ``,
    `Extension Context:`,
    diag.extensionContext,
    ``,
    `Editor Detector:`,
    diag.editorDetector,
    ``,
    `Editor Type:`,
    diag.editorType,
    ``,
    `Editor Bridge:`,
    diag.editorBridge,
    ``,
    `Editor Adapter:`,
    diag.editorAdapter,
    ``,
    `Insertion Request:`,
    diag.insertionRequest,
    ``,
    `Write:`,
    diag.write,
    ``,
    `Readback:`,
    diag.readback,
    ``,
    `Verification:`,
    diag.verification,
    ``,
    `Final:`,
    diag.final,
  ].join('\n');
}

export interface InsertionResult {
  success: boolean;
  editorType: EditorType;
  errorCode?: EditorErrorCode;
  detectedEditorLanguage?: string | null;
  message?: string;
  diagnostics?: MonacoDiagnostics;
  compactDiagnostics?: CompactInsertionDiagnostics;
  compactDiagnosticsFormatted?: string;
}

export interface EditorAdapter {
  name: string;
  type: EditorType;
  detect(): boolean | Promise<boolean>;
  getValue(): string | Promise<string>;
  setValue(code: string): boolean | Promise<boolean>;
  focus(): void;
  detectLanguage?(): string | null | Promise<string | null>;
  insertCode?(code: string, targetLanguage?: string, options?: InsertionOptions): Promise<InsertionResult | null>;
}

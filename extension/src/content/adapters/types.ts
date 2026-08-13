export type EditorType = 'monaco' | 'codemirror' | 'ace' | 'contenteditable' | 'textarea' | 'unknown';

export type EditorErrorCode =
  | 'EDITOR_NOT_FOUND'
  | 'EDITOR_NOT_ACCESSIBLE'
  | 'LANGUAGE_MISMATCH'
  | 'MONACO_BRIDGE_UNAVAILABLE'
  | 'MONACO_MODEL_NOT_FOUND'
  | 'INSERTION_VERIFICATION_FAILED'
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
  onProgress?: (progress: number) => void;
  isCancelled?: () => boolean;
}

export interface InsertionResult {
  success: boolean;
  editorType: EditorType;
  errorCode?: EditorErrorCode;
  detectedEditorLanguage?: string | null;
  message?: string;
  diagnostics?: MonacoDiagnostics;
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

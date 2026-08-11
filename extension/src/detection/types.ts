export type PageType = 'unknown' | 'normal' | 'coding' | 'coding-problem' | 'editor';

export interface DetectionSignal {
  id: string;
  category: 'content' | 'editor' | 'structure' | 'url' | 'language' | 'interaction';
  score: number;
  evidence: string;
}

export interface EditorDetection {
  detected: boolean;
  type: 'monaco' | 'codemirror' | 'ace' | 'textarea' | 'contenteditable' | 'unknown';
  confidence: number;
  signals: DetectionSignal[];
}

export interface PageSnapshot {
  url: string;
  hostname: string;
  pathname: string;
  title: string;
  headings: string[];
  visibleTextSample: string;
  forms: number;
  textareas: number;
  contentEditables: number;
  iframes: number;
  buttons: string[];
  inputs: string[];
  scriptHints: string[];
  detectedEditorHints: string[];
}

export interface PageDetectionResult {
  type: PageType;
  confidence: number;
  signals: DetectionSignal[];
  editor: EditorDetection;
  detectedAt: number;
  url: string;
  title: string;
  detectionDurationMs: number;
}

export interface PageDetectionState {
  status: 'pending' | 'detected' | 'error';
  result?: PageDetectionResult;
  lastUpdated?: number;
}

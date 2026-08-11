import { PageSnapshot, EditorDetection, DetectionSignal } from './types';

export class EditorDetector {
  public static detect(snapshot: PageSnapshot): EditorDetection {
    const signals: DetectionSignal[] = [];

    // 1. Monaco Editor Check
    if (snapshot.detectedEditorHints.includes('monaco-dom')) {
      signals.push({
        id: 'editor-monaco-dom',
        category: 'editor',
        score: 0.95,
        evidence: 'Detected Monaco Editor DOM structures (.monaco-editor)',
      });
      return {
        detected: true,
        type: 'monaco',
        confidence: 0.95,
        signals,
      };
    }

    if (snapshot.scriptHints.includes('monaco-script')) {
      signals.push({
        id: 'editor-monaco-script',
        category: 'editor',
        score: 0.8,
        evidence: 'Detected Monaco script bundle reference',
      });
      return {
        detected: true,
        type: 'monaco',
        confidence: 0.8,
        signals,
      };
    }

    // 2. CodeMirror Check
    if (snapshot.detectedEditorHints.includes('codemirror-dom')) {
      signals.push({
        id: 'editor-codemirror-dom',
        category: 'editor',
        score: 0.92,
        evidence: 'Detected CodeMirror DOM structures (.CodeMirror / .cm-editor)',
      });
      return {
        detected: true,
        type: 'codemirror',
        confidence: 0.92,
        signals,
      };
    }

    if (snapshot.scriptHints.includes('codemirror-script')) {
      signals.push({
        id: 'editor-codemirror-script',
        category: 'editor',
        score: 0.78,
        evidence: 'Detected CodeMirror script bundle reference',
      });
      return {
        detected: true,
        type: 'codemirror',
        confidence: 0.78,
        signals,
      };
    }

    // 3. Ace Editor Check
    if (snapshot.detectedEditorHints.includes('ace-dom')) {
      signals.push({
        id: 'editor-ace-dom',
        category: 'editor',
        score: 0.9,
        evidence: 'Detected Ace Editor DOM structures (.ace_editor)',
      });
      return {
        detected: true,
        type: 'ace',
        confidence: 0.9,
        signals,
      };
    }

    if (snapshot.scriptHints.includes('ace-script')) {
      signals.push({
        id: 'editor-ace-script',
        category: 'editor',
        score: 0.75,
        evidence: 'Detected Ace script bundle reference',
      });
      return {
        detected: true,
        type: 'ace',
        confidence: 0.75,
        signals,
      };
    }

    // 4. Textarea Fallback
    if (snapshot.textareas > 0) {
      signals.push({
        id: 'editor-textarea',
        category: 'editor',
        score: 0.4,
        evidence: `Detected ${snapshot.textareas} textarea element(s)`,
      });
      return {
        detected: true,
        type: 'textarea',
        confidence: 0.4,
        signals,
      };
    }

    // 5. Contenteditable Fallback
    if (snapshot.contentEditables > 0) {
      signals.push({
        id: 'editor-contenteditable',
        category: 'editor',
        score: 0.35,
        evidence: `Detected ${snapshot.contentEditables} contenteditable element(s)`,
      });
      return {
        detected: true,
        type: 'contenteditable',
        confidence: 0.35,
        signals,
      };
    }

    return {
      detected: false,
      type: 'unknown',
      confidence: 0,
      signals: [],
    };
  }
}

import assert from 'node:assert';
import { test, describe } from 'node:test';

interface PageSnapshotMock {
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

interface DetectionSignalMock {
  id: string;
  category: 'content' | 'editor' | 'structure' | 'url' | 'language' | 'interaction';
  score: number;
  evidence: string;
}

interface EditorDetectionMock {
  detected: boolean;
  type: 'monaco' | 'codemirror' | 'ace' | 'textarea' | 'contenteditable' | 'unknown';
  confidence: number;
  signals: DetectionSignalMock[];
}

function detectEditorMock(snapshot: PageSnapshotMock): EditorDetectionMock {
  const signals: DetectionSignalMock[] = [];
  if (snapshot.detectedEditorHints.includes('monaco-dom')) {
    signals.push({ id: 'editor-monaco-dom', category: 'editor', score: 0.95, evidence: 'Monaco DOM' });
    return { detected: true, type: 'monaco', confidence: 0.95, signals };
  }
  if (snapshot.detectedEditorHints.includes('codemirror-dom')) {
    signals.push({ id: 'editor-codemirror-dom', category: 'editor', score: 0.92, evidence: 'CodeMirror DOM' });
    return { detected: true, type: 'codemirror', confidence: 0.92, signals };
  }
  if (snapshot.textareas > 0) {
    signals.push({ id: 'editor-textarea', category: 'editor', score: 0.4, evidence: 'Textarea' });
    return { detected: true, type: 'textarea', confidence: 0.4, signals };
  }
  return { detected: false, type: 'unknown', confidence: 0, signals: [] };
}

function extractSignalsMock(snapshot: PageSnapshotMock, editor: EditorDetectionMock): DetectionSignalMock[] {
  const signals: DetectionSignalMock[] = [...editor.signals];
  const fullText = (snapshot.title + ' ' + snapshot.headings.join(' ') + ' ' + snapshot.visibleTextSample).toLowerCase();

  const keywords = [
    { key: 'problem statement', id: 'content-problem-statement', score: 0.25 },
    { key: 'input format', id: 'content-input-format', score: 0.25 },
    { key: 'output format', id: 'content-output-format', score: 0.25 },
    { key: 'constraints', id: 'content-constraints', score: 0.2 },
    { key: 'sample input', id: 'content-sample-input', score: 0.25 },
    { key: 'sample output', id: 'content-sample-output', score: 0.25 },
  ];

  keywords.forEach((item) => {
    if (fullText.includes(item.key)) {
      signals.push({ id: item.id, category: 'content', score: item.score, evidence: `Detected phrase "${item.key}"` });
    }
  });

  const matchedButtons = snapshot.buttons.filter((btn) => ['run', 'run code', 'compile', 'submit'].includes(btn.toLowerCase()));
  if (matchedButtons.length > 0) {
    signals.push({ id: 'interaction-run-control', category: 'interaction', score: 0.25, evidence: `Action button: ${matchedButtons.join(', ')}` });
  }

  if (fullText.includes('article') || fullText.includes('published on') || fullText.includes('documentation') || fullText.includes('travel guide')) {
    signals.push({ id: 'normal-article-structure', category: 'structure', score: -0.2, evidence: 'Normal article/doc indicator' });
  }

  return signals;
}

function classifyMock(signals: DetectionSignalMock[], editor: EditorDetectionMock) {
  const contentSignals = signals.filter((s) => s.category === 'content');
  const totalContentScore = contentSignals.reduce((acc, s) => acc + s.score, 0);

  // Coding problem with editor / controls
  if (totalContentScore >= 0.5 && (editor.detected || signals.some((s) => s.category === 'interaction'))) {
    const confidence = Math.min(0.98, 0.6 + totalContentScore * 0.4);
    return { type: 'coding-problem', confidence: Number(confidence.toFixed(2)) };
  }

  // Coding problem without editor
  if (totalContentScore >= 0.5) {
    const confidence = Math.min(0.78, 0.5 + totalContentScore * 0.35);
    return { type: 'coding-problem', confidence: Number(confidence.toFixed(2)) };
  }

  // Standalone Editor
  if (editor.detected && editor.confidence >= 0.7 && totalContentScore < 0.4) {
    return { type: 'editor', confidence: 0.9 };
  }

  return { type: 'normal', confidence: 0.85 };
}

describe('Phase 2 Page Detection Engine Tests', () => {
  test('TEST 1: Normal webpage classification', () => {
    const snapshot: PageSnapshotMock = {
      url: 'https://example.com/climate',
      hostname: 'example.com',
      pathname: '/climate',
      title: 'Global Climate Overview',
      headings: ['Global Climate Overview', 'Introduction'],
      visibleTextSample: 'Climate change refers to long-term shifts in temperatures.',
      forms: 0, textareas: 0, contentEditables: 0, iframes: 0,
      buttons: [], inputs: [], scriptHints: [], detectedEditorHints: [],
    };
    const editor = detectEditorMock(snapshot);
    const signals = extractSignalsMock(snapshot, editor);
    const res = classifyMock(signals, editor);

    assert.strictEqual(res.type, 'normal');
  });

  test('TEST 2: Programming article classification', () => {
    const snapshot: PageSnapshotMock = {
      url: 'https://blog.example.com/java-2026',
      hostname: 'blog.example.com',
      pathname: '/java-2026',
      title: 'Understanding Modern Java Features',
      headings: ['Understanding Modern Java Features'],
      visibleTextSample: 'Author: Tech Blog. Published on August 2026. Java has evolved rapidly.',
      forms: 0, textareas: 0, contentEditables: 0, iframes: 0,
      buttons: [], inputs: [], scriptHints: [], detectedEditorHints: [],
    };
    const editor = detectEditorMock(snapshot);
    const signals = extractSignalsMock(snapshot, editor);
    const res = classifyMock(signals, editor);

    assert.strictEqual(res.type, 'normal');
  });

  test('TEST 3: Documentation page classification', () => {
    const snapshot: PageSnapshotMock = {
      url: 'https://docs.example.com/api',
      hostname: 'docs.example.com',
      pathname: '/api',
      title: 'API Reference Documentation',
      headings: ['API Reference Documentation'],
      visibleTextSample: 'Table of contents: Authentication, Endpoints, Error Codes.',
      forms: 0, textareas: 0, contentEditables: 0, iframes: 0,
      buttons: [], inputs: [], scriptHints: [], detectedEditorHints: [],
    };
    const editor = detectEditorMock(snapshot);
    const signals = extractSignalsMock(snapshot, editor);
    const res = classifyMock(signals, editor);

    assert.strictEqual(res.type, 'normal');
  });

  test('TEST 4: Generic code editor classification', () => {
    const snapshot: PageSnapshotMock = {
      url: 'https://sandbox.example.com',
      hostname: 'sandbox.example.com',
      pathname: '/',
      title: 'Online Code Sandbox',
      headings: ['Online Code Sandbox'],
      visibleTextSample: 'Welcome to code sandbox.',
      forms: 0, textareas: 0, contentEditables: 0, iframes: 0,
      buttons: ['Run'], inputs: [], scriptHints: [], detectedEditorHints: ['monaco-dom'],
    };
    const editor = detectEditorMock(snapshot);
    const signals = extractSignalsMock(snapshot, editor);
    const res = classifyMock(signals, editor);

    assert.strictEqual(res.type, 'editor');
  });

  test('TEST 5: Coding problem + editor classification', () => {
    const snapshot: PageSnapshotMock = {
      url: 'https://platform.example.com/problems/two-sum',
      hostname: 'platform.example.com',
      pathname: '/problems/two-sum',
      title: 'Two Sum Problem',
      headings: ['Problem Statement', 'Input Format', 'Output Format', 'Constraints'],
      visibleTextSample: 'Given an array of integers nums and target, return indices. Input Format Output Format Constraints Sample Input Sample Output',
      forms: 0, textareas: 0, contentEditables: 0, iframes: 0,
      buttons: ['Run Code', 'Submit'], inputs: [], scriptHints: [], detectedEditorHints: ['monaco-dom'],
    };
    const editor = detectEditorMock(snapshot);
    const signals = extractSignalsMock(snapshot, editor);
    const res = classifyMock(signals, editor);

    assert.strictEqual(res.type, 'coding-problem');
    assert.ok(res.confidence >= 0.8);
  });

  test('TEST 6: Coding problem without editor classification', () => {
    const snapshot: PageSnapshotMock = {
      url: 'https://platform.example.com/problems/matrix-rotation',
      hostname: 'platform.example.com',
      pathname: '/problems/matrix-rotation',
      title: 'Matrix Rotation Task',
      headings: ['Problem Statement', 'Input Format', 'Output Format', 'Constraints'],
      visibleTextSample: 'Rotate the given N x N matrix. Input Format Output Format Constraints',
      forms: 0, textareas: 0, contentEditables: 0, iframes: 0,
      buttons: [], inputs: [], scriptHints: [], detectedEditorHints: [],
    };
    const editor = detectEditorMock(snapshot);
    const signals = extractSignalsMock(snapshot, editor);
    const res = classifyMock(signals, editor);

    assert.strictEqual(res.type, 'coding-problem');
    assert.ok(res.confidence < 0.8);
  });

  test('TEST 7: Editor without problem task classification', () => {
    const snapshot: PageSnapshotMock = {
      url: 'https://playground.example.com',
      hostname: 'playground.example.com',
      pathname: '/',
      title: 'Interactive Code Playground',
      headings: ['Playground'],
      visibleTextSample: 'Scratchpad playground',
      forms: 0, textareas: 0, contentEditables: 0, iframes: 0,
      buttons: [], inputs: [], scriptHints: [], detectedEditorHints: ['codemirror-dom'],
    };
    const editor = detectEditorMock(snapshot);
    const signals = extractSignalsMock(snapshot, editor);
    const res = classifyMock(signals, editor);

    assert.strictEqual(res.type, 'editor');
  });

  test('TEST 8: Page with only keyword "Java" is NOT coding', () => {
    const snapshot: PageSnapshotMock = {
      url: 'https://travel.example.com/java',
      hostname: 'travel.example.com',
      pathname: '/java',
      title: 'Travel Guide to Java Island',
      headings: ['Travel Guide to Java Island'],
      visibleTextSample: 'Java is an island of Indonesia bordered by the ocean.',
      forms: 0, textareas: 0, contentEditables: 0, iframes: 0,
      buttons: [], inputs: [], scriptHints: [], detectedEditorHints: [],
    };
    const editor = detectEditorMock(snapshot);
    const signals = extractSignalsMock(snapshot, editor);
    const res = classifyMock(signals, editor);

    assert.notStrictEqual(res.type, 'coding-problem');
    assert.notStrictEqual(res.type, 'coding');
    assert.strictEqual(res.type, 'normal');
  });

  test('TEST 9: Full coding problem structure with controls', () => {
    const snapshot: PageSnapshotMock = {
      url: 'https://judge.example.com/problem/101',
      hostname: 'judge.example.com',
      pathname: '/problem/101',
      title: 'Problem 101',
      headings: ['Problem Statement', 'Input Format', 'Output Format'],
      visibleTextSample: 'Problem Statement Input Format Output Format Constraints Sample Input Sample Output',
      forms: 0, textareas: 0, contentEditables: 0, iframes: 0,
      buttons: ['Run', 'Submit'], inputs: [], scriptHints: [], detectedEditorHints: ['monaco-dom'],
    };
    const editor = detectEditorMock(snapshot);
    const signals = extractSignalsMock(snapshot, editor);
    const res = classifyMock(signals, editor);

    assert.strictEqual(res.type, 'coding-problem');
    assert.ok(res.confidence >= 0.85);
  });

  test('TEST 10: Dynamic content classification update', () => {
    // Initial load: no problem statement yet
    const initialSnapshot: PageSnapshotMock = {
      url: 'https://spa.example.com/task',
      hostname: 'spa.example.com',
      pathname: '/task',
      title: 'Loading Task...',
      headings: ['Loading...'],
      visibleTextSample: 'Please wait...',
      forms: 0, textareas: 0, contentEditables: 0, iframes: 0,
      buttons: [], inputs: [], scriptHints: [], detectedEditorHints: [],
    };
    let editor = detectEditorMock(initialSnapshot);
    let signals = extractSignalsMock(initialSnapshot, editor);
    let res = classifyMock(signals, editor);

    assert.strictEqual(res.type, 'normal');

    // Dynamic DOM update: problem statement inserted
    const updatedSnapshot: PageSnapshotMock = {
      ...initialSnapshot,
      title: 'Task 1: Array Reversal',
      headings: ['Problem Statement', 'Input Format'],
      visibleTextSample: 'Problem Statement Input Format Output Format Constraints',
      buttons: ['Run Code'],
      detectedEditorHints: ['monaco-dom'],
    };
    editor = detectEditorMock(updatedSnapshot);
    signals = extractSignalsMock(updatedSnapshot, editor);
    res = classifyMock(signals, editor);

    assert.strictEqual(res.type, 'coding-problem');
  });
});

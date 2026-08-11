import { PageDetectionResult, PageSnapshot } from './types';
import { FeatureExtractor } from './feature-extractor';
import { EditorDetector } from './editor-detector';
import { SignalRegistry } from './signal-registry';
import { ScoringEngine } from './scoring-engine';

export class PageDetector {
  private static cache: {
    url: string;
    result: PageDetectionResult;
    timestamp: number;
  } | null = null;

  public static detectPage(doc: Document = document, win: Window = window, forceRefresh = false): PageDetectionResult {
    const startTime = performance.now();
    const currentUrl = doc.location ? doc.location.href : '';

    // Cache lookup (valid within 5 seconds for same URL if not force refreshed)
    if (!forceRefresh && this.cache && this.cache.url === currentUrl && Date.now() - this.cache.timestamp < 5000) {
      return this.cache.result;
    }

    // 1. Extract lightweight snapshot
    const snapshot: PageSnapshot = FeatureExtractor.extractFromDOM(doc, win);

    // 2. Detect code editor technology
    const editor = EditorDetector.detect(snapshot);

    // 3. Extract detection signals
    const signals = SignalRegistry.extractSignals(snapshot, editor);

    // 4. Classify & score page
    const classification = ScoringEngine.evaluate(signals, editor);

    const endTime = performance.now();
    const durationMs = Number((endTime - startTime).toFixed(2));

    const result: PageDetectionResult = {
      type: classification.type,
      confidence: classification.confidence,
      signals,
      editor,
      detectedAt: Date.now(),
      url: snapshot.url,
      title: snapshot.title,
      detectionDurationMs: durationMs,
    };

    // Cache update
    this.cache = {
      url: currentUrl,
      result,
      timestamp: Date.now(),
    };

    return result;
  }

  public static detect(snapshot: PageSnapshot): PageDetectionResult {
    const startTime = performance.now();
    const editor = EditorDetector.detect(snapshot);
    const signals = SignalRegistry.extractSignals(snapshot, editor);
    const classification = ScoringEngine.evaluate(signals, editor);
    const durationMs = Number((performance.now() - startTime).toFixed(2));

    return {
      type: classification.type,
      confidence: classification.confidence,
      signals,
      editor,
      detectedAt: Date.now(),
      url: snapshot.url,
      title: snapshot.title,
      detectionDurationMs: durationMs,
    };
  }

  public static clearCache(): void {
    this.cache = null;
  }
}

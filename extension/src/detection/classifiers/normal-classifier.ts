import { DetectionSignal, EditorDetection } from '../types';
import { ClassificationResult } from './problem-classifier';

export class NormalClassifier {
  public static classify(signals: DetectionSignal[], _editor: EditorDetection): ClassificationResult {
    const docSignals = signals.filter((s) => s.id === 'normal-article-structure');

    if (docSignals.length > 0) {
      return {
        type: 'normal',
        confidence: 0.88,
      };
    }

    return {
      type: 'normal',
      confidence: 0.75,
    };
  }
}

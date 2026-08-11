import { DetectionSignal, EditorDetection } from '../types';
import { ClassificationResult } from './problem-classifier';

export class CodingClassifier {
  public static classify(signals: DetectionSignal[], editor: EditorDetection): ClassificationResult | null {
    // 1. Standalone Code Editor / Playground (Editor without full problem task structure)
    const contentSignals = signals.filter((s) => s.category === 'content');
    const totalContentScore = contentSignals.reduce((acc, s) => acc + s.score, 0);

    if (editor.detected && editor.confidence >= 0.7 && totalContentScore < 0.4) {
      return {
        type: 'editor',
        confidence: Number(Math.min(0.95, editor.confidence + 0.1).toFixed(2)),
      };
    }

    // 2. Generic Coding Page / Workspace
    const totalScore = signals.reduce((acc, s) => acc + s.score, 0);
    if (totalScore >= 0.45) {
      return {
        type: 'coding',
        confidence: Number(Math.min(0.79, 0.5 + totalScore * 0.3).toFixed(2)),
      };
    }

    return null;
  }
}

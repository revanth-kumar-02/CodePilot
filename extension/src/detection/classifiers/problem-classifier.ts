import { DetectionSignal, EditorDetection, PageType } from '../types';

export interface ClassificationResult {
  type: PageType;
  confidence: number;
}

export class ProblemClassifier {
  public static classify(signals: DetectionSignal[], editor: EditorDetection): ClassificationResult | null {
    const contentSignals = signals.filter((s) => s.category === 'content');
    const interactionSignals = signals.filter((s) => s.category === 'interaction');

    const totalContentScore = contentSignals.reduce((acc, s) => acc + s.score, 0);

    // Case A: Problem structure + Editor + Controls -> Strong Coding Problem (0.80 - 0.98)
    if (totalContentScore >= 0.5 && (editor.detected || interactionSignals.length > 0)) {
      const confidence = Math.min(0.98, 0.6 + totalContentScore * 0.4 + (editor.confidence > 0.5 ? 0.15 : 0.05));
      return {
        type: 'coding-problem',
        confidence: Number(confidence.toFixed(2)),
      };
    }

    // Case B: Coding problem task description without an embedded code editor (e.g. text problem description)
    if (totalContentScore >= 0.6) {
      const confidence = Math.min(0.78, 0.5 + totalContentScore * 0.35);
      return {
        type: 'coding-problem',
        confidence: Number(confidence.toFixed(2)),
      };
    }

    return null;
  }
}

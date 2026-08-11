import { DetectionSignal, EditorDetection, PageType } from './types';
import { ProblemClassifier } from './classifiers/problem-classifier';
import { CodingClassifier } from './classifiers/coding-classifier';
import { NormalClassifier } from './classifiers/normal-classifier';

export interface ScoreClassification {
  type: PageType;
  confidence: number;
}

export class ScoringEngine {
  public static evaluate(signals: DetectionSignal[], editor: EditorDetection): ScoreClassification {
    // 1. Check for Coding Problem
    const problemRes = ProblemClassifier.classify(signals, editor);
    if (problemRes) {
      return problemRes;
    }

    // 2. Check for Editor / Generic Coding Page
    const codingRes = CodingClassifier.classify(signals, editor);
    if (codingRes) {
      return codingRes;
    }

    // 3. Fallback Normal / Non-coding Page
    return NormalClassifier.classify(signals, editor);
  }
}

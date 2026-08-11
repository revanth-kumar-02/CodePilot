import { ExtractionFieldResult } from './types';

export class ConfidenceCalculator {
  public static calculateOverall(fieldResults: ExtractionFieldResult[]): number {
    if (!fieldResults || fieldResults.length === 0) return 0.0;

    // Weights for overall confidence
    const weights: Record<string, number> = {
      title: 0.25,
      statement: 0.35,
      input: 0.1,
      output: 0.1,
      constraints: 0.05,
      examples: 0.1,
      notes: 0.02,
      language: 0.03,
    };

    let totalWeight = 0;
    let weightedSum = 0;

    fieldResults.forEach((res) => {
      const w = weights[res.field] || 0.05;
      totalWeight += w;
      weightedSum += res.confidence * w;
    });

    if (totalWeight === 0) return 0.0;

    const confidence = weightedSum / totalWeight;
    return Number(confidence.toFixed(2));
  }
}

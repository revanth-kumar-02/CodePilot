import { ProblemAnalysis, ProblemAnalysisSchema } from './schemas.js';
import { AIError } from './ai-provider.js';
import { JsonCleaner } from '../utils/json-cleaner.js';

export class ResponseParser {
  public static parse(rawResponse: string, providerName: string, modelName: string): ProblemAnalysis {
    const cleanText = JsonCleaner.extractAndRepairJson(rawResponse);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(cleanText);
    } catch (err) {
      throw new AIError(
        'AI_INVALID_RESPONSE',
        `AI provider returned malformed JSON: ${err instanceof Error ? err.message : String(err)}`,
        502
      );
    }

    if (typeof parsedJson === 'object' && parsedJson !== null) {
      const obj = parsedJson as Record<string, unknown>;
      // Inject metadata fields
      obj.model = modelName;
      obj.provider = providerName;
      obj.generatedAt = Date.now();

      // Ensure code fields are omitted if present
      delete obj.code;
      delete obj.solution;

      const validation = ProblemAnalysisSchema.safeParse(obj);
      if (!validation.success) {
        throw new AIError(
          'AI_VALIDATION_ERROR',
          `AI response failed schema validation: ${validation.error.issues.map((i: { message: string }) => i.message).join(', ')}`,
          502
        );
      }

      return validation.data;
    }

    throw new AIError(
      'AI_INVALID_RESPONSE',
      'AI provider response is not a valid object.',
      502
    );
  }
}

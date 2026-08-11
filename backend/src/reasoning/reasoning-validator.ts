import { SolutionPlan, SolutionPlanSchema, ReasoningValidation } from './schemas.js';
import { ProblemInput } from '../ai/schemas.js';
import { AIError } from '../ai/ai-provider.js';
import { ConsistencyChecker } from './consistency-checker.js';
import { JsonCleaner } from '../utils/json-cleaner.js';

export interface ReasoningParseResult {
  plan: SolutionPlan;
  validation: ReasoningValidation;
  diagnostics: {
    parserMethod: 'DIRECT_JSON' | 'MARKDOWN_NORMALIZED' | 'OBJECT_EXTRACTED';
    schemaPass: boolean;
    consistencyPass: boolean;
  };
}

export class ReasoningValidator {
  public static parseAndValidate(
    rawResponse: string,
    problem: ProblemInput,
    providerName: string,
    modelName: string
  ): ReasoningParseResult {
    // 1. Safe extraction and JSON parsing
    const { data: parsedJson, parserMethod } = JsonCleaner.parseJsonSafely(rawResponse);

    if (typeof parsedJson !== 'object' || parsedJson === null || Array.isArray(parsedJson)) {
      throw new AIError(
        'AI_RESPONSE_NOT_JSON',
        'Reasoning engine response is not a valid JSON object.',
        502,
        true
      );
    }

    const obj = parsedJson as Record<string, unknown>;
    obj.model = modelName;
    obj.provider = providerName;
    obj.generatedAt = Date.now();

    // Ensure forbidden source code fields are strictly omitted if present
    delete obj.code;
    delete obj.solutionCode;
    delete obj.sourceCode;

    // 2. Zod Schema Validation
    const schemaValidation = SolutionPlanSchema.safeParse(obj);
    if (!schemaValidation.success) {
      const issueSummary = schemaValidation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new AIError(
        'AI_RESPONSE_SCHEMA_INVALID',
        `Solution plan failed schema validation: ${issueSummary}`,
        502,
        true
      );
    }

    let plan = schemaValidation.data;

    // 3. Reasoning Consistency Validation
    const validation = ConsistencyChecker.check(plan, problem);
    const consistencyPass = validation.valid;

    if (!consistencyPass) {
      const isContradictionOrInsufficient = validation.issues.some(
        (i) => i.message.includes('inconsistent') || i.message.includes('contradictory') || i.message.includes('lacks sufficient')
      );

      if (isContradictionOrInsufficient) {
        plan = {
          ...plan,
          status: 'needs-clarification',
        };
      } else {
        plan = {
          ...plan,
          status: 'failed',
        };
      }
    }

    return {
      plan,
      validation,
      diagnostics: {
        parserMethod,
        schemaPass: true,
        consistencyPass,
      },
    };
  }
}

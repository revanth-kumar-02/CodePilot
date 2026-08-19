import { ProblemInput, ProblemSchema, AIError, AIProviderRouter, ProblemAnalysis, AIProvider } from '../ai/index.js';

export class AIService {
  private router?: AIProviderRouter;
  private legacyProvider?: AIProvider;

  constructor(providerOrRouter?: AIProvider | AIProviderRouter) {
    if (providerOrRouter instanceof AIProviderRouter) {
      this.router = providerOrRouter;
    } else if (providerOrRouter) {
      this.legacyProvider = providerOrRouter;
    } else {
      this.router = new AIProviderRouter();
    }
  }

  public async analyzeProblem(
    rawProblem: unknown,
    overrideApiKeyOrProvider?: string | AIProvider,
    overrideProviderName?: string
  ): Promise<ProblemAnalysis> {
    const startTime = performance.now();
    console.log('[CodePilot][AI] Analysis request started');

    const validation = ProblemSchema.safeParse(rawProblem);
    if (!validation.success) {
      console.warn('[CodePilot][AI] Validation failed for incoming problem');
      throw new AIError(
        'AI_VALIDATION_ERROR',
        `Invalid problem payload: ${validation.error.issues.map((i: { message: string }) => i.message).join(', ')}`,
        400
      );
    }

    const problem: ProblemInput = validation.data;

    const serializedSize = JSON.stringify(problem).length;
    if (problem.title.length > 500 || problem.statement.length > 25000 || serializedSize > 60000) {
      console.warn('[CodePilot][AI] Problem payload size limits exceeded');
      throw new AIError(
        'AI_REQUEST_TOO_LARGE',
        'Problem payload exceeds maximum size limits allowed for AI processing.',
        400
      );
    }

    try {
      let result: ProblemAnalysis;
      if (typeof overrideApiKeyOrProvider === 'object' && overrideApiKeyOrProvider !== null) {
        result = await overrideApiKeyOrProvider.analyzeProblem(problem);
      } else if (this.legacyProvider) {
        result = await this.legacyProvider.analyzeProblem(problem);
      } else {
        const apiKey = typeof overrideApiKeyOrProvider === 'string' ? overrideApiKeyOrProvider : undefined;
        result = await (this.router || new AIProviderRouter()).analyzeProblem(problem, apiKey, overrideProviderName);
      }

      const durationMs = Math.round(performance.now() - startTime);
      console.log('[CodePilot][AI] Analysis request completed in', durationMs, 'ms');
      return result;
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      console.error(`[CodePilot][AI] Analysis request failed after ${durationMs}ms:`, err instanceof Error ? err.message : err);
      throw err;
    }
  }
}

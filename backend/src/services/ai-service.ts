import { AIProvider, OpenRouterProvider, GroqProvider, MockAIProvider, ProblemInput, ProblemAnalysis, ProblemSchema, AIError } from '../ai/index.js';
import { getAIConfig } from '../ai/model-config.js';

export class AIService {
  private provider: AIProvider;

  constructor(provider?: AIProvider) {
    if (provider) {
      this.provider = provider;
    } else if (process.env.NODE_ENV === 'test' || process.env.USE_MOCK_AI === 'true') {
      this.provider = new MockAIProvider();
    } else {
      const config = getAIConfig();
      if (config.provider === 'groq' || config.groqApiKey) {
        this.provider = new GroqProvider();
      } else {
        this.provider = new OpenRouterProvider();
      }
    }
  }

  public async analyzeProblem(rawProblem: unknown): Promise<ProblemAnalysis> {
    const startTime = performance.now();
    console.log('[CodePilot][AI] Request started');

    // 1. Schema Validation
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

    // 2. Payload Size Limit Checks
    const serializedSize = JSON.stringify(problem).length;
    if (problem.title.length > 500 || problem.statement.length > 25000 || serializedSize > 60000) {
      console.warn('[CodePilot][AI] Problem payload size limits exceeded');
      throw new AIError(
        'AI_REQUEST_TOO_LARGE',
        'Problem payload exceeds maximum size limits allowed for AI processing.',
        400
      );
    }

    const config = getAIConfig();
    console.log(`[CodePilot][AI] Provider: ${this.provider.name}`);
    console.log(`[CodePilot][AI] Model: ${this.provider.name === 'groq' ? config.groqModel : config.model}`);

    // 3. AI Analysis Request
    try {
      const result = await this.provider.analyzeProblem(problem);
      const durationMs = Math.round(performance.now() - startTime);

      console.log('[CodePilot][AI] Request completed');
      console.log(`[CodePilot][AI] Duration: ${durationMs}ms`);
      console.log('[CodePilot][AI] Validation: PASS');

      return result;
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      console.error(`[CodePilot][AI] Request failed after ${durationMs}ms:`, err instanceof Error ? err.message : err);
      throw err;
    }
  }
}

import { AIProvider, OpenRouterProvider, GroqProvider, MockAIProvider, ProblemInput, ProblemSchema, AIError } from '../ai/index.js';
import { SolutionPlan, ReasoningValidation } from './schemas.js';
import { getAIConfig } from '../ai/model-config.js';
import { ConsistencyChecker } from './consistency-checker.js';

export interface ReasoningExecutionResult {
  plan: SolutionPlan;
  validation: ReasoningValidation;
  reasoningDurationMs: number;
  attemptsUsed: number;
  requestId: string;
}

export class ReasoningService {
  private provider: AIProvider;
  private currentRequestId: number = 0;

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

  public async reasonProblem(rawProblem: unknown, overrideProvider?: AIProvider): Promise<ReasoningExecutionResult> {
    const activeProvider = overrideProvider || this.provider;
    const startTime = performance.now();
    const requestId = `req_${++this.currentRequestId}_${Date.now()}`;
    const capturedRequestId = this.currentRequestId;

    console.log(`[CodePilot][Reasoning][${requestId}] Reasoning request started`);

    // 1. Schema Validation
    const validationResult = ProblemSchema.safeParse(rawProblem);
    if (!validationResult.success) {
      console.warn(`[CodePilot][Reasoning][${requestId}] Validation failed for incoming problem`);
      throw new AIError(
        'AI_VALIDATION_ERROR',
        `Invalid problem payload: ${validationResult.error.issues.map((i) => i.message).join(', ')}`,
        400,
        false
      );
    }

    const problem: ProblemInput = validationResult.data;

    // 2. Payload Size Checks
    const serializedSize = JSON.stringify(problem).length;
    if (problem.title.length > 500 || problem.statement.length > 25000 || serializedSize > 60000) {
      console.warn(`[CodePilot][Reasoning][${requestId}] Problem payload size limits exceeded`);
      throw new AIError(
        'AI_REQUEST_TOO_LARGE',
        'Problem payload exceeds maximum size limits allowed for reasoning processing.',
        400,
        false
      );
    }

    const config = getAIConfig();
    const modelName = this.provider.name === 'groq' ? config.groqModel : config.model;
    console.log(`[CodePilot][Reasoning][${requestId}] Provider: ${this.provider.name}`);
    console.log(`[CodePilot][Reasoning][${requestId}] Model: ${modelName}`);

    const maxAttempts = 2;
    let lastError: AIError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Deduplication check: if a new request was issued while this attempt was running, abandon stale request
      if (this.currentRequestId !== capturedRequestId) {
        console.warn(`[CodePilot][Reasoning][${requestId}] Stale request abandoned (newer request active)`);
        throw new AIError('AI_UNKNOWN_ERROR', 'Reasoning request superseded by newer request.', 409, false);
      }

      const isRecoveryAttempt = attempt > 1;
      console.log(`[CodePilot][Reasoning][${requestId}] Attempt ${attempt}/${maxAttempts} (Recovery: ${isRecoveryAttempt})`);

      try {
        const plan = await activeProvider.reasonProblem(problem, isRecoveryAttempt);

        // Perform final self-consistency check
        const validation = ConsistencyChecker.check(plan, problem);

        if (!validation.valid && plan.status === 'ready') {
          const isContradictionOrInsufficient = validation.issues.some(
            (i) => i.message.includes('inconsistent') || i.message.includes('contradictory') || i.message.includes('lacks sufficient')
          );
          plan.status = isContradictionOrInsufficient ? 'needs-clarification' : 'failed';
        }

        const reasoningDurationMs = Math.round(performance.now() - startTime);

        console.log(`[CodePilot][Reasoning][${requestId}] Reasoning completed on attempt ${attempt}`);
        console.log(`[CodePilot][Reasoning][${requestId}] Duration: ${reasoningDurationMs}ms`);
        console.log(`[CodePilot][Reasoning][${requestId}] Plan Status: ${plan.status}`);

        return {
          plan,
          validation,
          reasoningDurationMs,
          attemptsUsed: attempt,
          requestId,
        };
      } catch (err: unknown) {
        const aiErr = err instanceof AIError
          ? err
          : new AIError('AI_UNKNOWN_ERROR', err instanceof Error ? err.message : String(err), 500, false);

        console.warn(`[CodePilot][Reasoning][${requestId}] Attempt ${attempt} failed with [${aiErr.code}]: ${aiErr.message}`);

        lastError = aiErr;

        // If error is permanent (non-retryable) or attempt limit reached, stop immediately
        if (!aiErr.retryable || attempt >= maxAttempts) {
          break;
        }

        if (aiErr.code === 'AI_RATE_LIMITED') {
          console.log(`[CodePilot][Reasoning][${requestId}] Rate limited. Waiting 3s before attempt ${attempt + 1}...`);
          await new Promise((res) => setTimeout(res, 3000));
        } else {
          console.log(`[CodePilot][Reasoning][${requestId}] Preparing controlled recovery attempt ${attempt + 1}...`);
        }
      }
    }

    const reasoningDurationMs = Math.round(performance.now() - startTime);
    console.error(`[CodePilot][Reasoning][${requestId}] Request failed permanently after ${reasoningDurationMs}ms with [${lastError?.code}]:`, lastError?.message);

    throw lastError || new AIError('AI_UNKNOWN_ERROR', 'Failed to generate solution plan after 2 attempts.', 500, false);
  }
}

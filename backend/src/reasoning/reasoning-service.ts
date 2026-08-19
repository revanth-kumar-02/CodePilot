import { ProblemInput, ProblemSchema, AIError, AIProviderRouter, AIProvider } from '../ai/index.js';
import { SolutionPlan, ReasoningValidation } from './schemas.js';
import { ConsistencyChecker } from './consistency-checker.js';

export interface ReasoningExecutionResult {
  plan: SolutionPlan;
  validation: ReasoningValidation;
  reasoningDurationMs: number;
  attemptsUsed: number;
  requestId: string;
}

export class ReasoningService {
  private router?: AIProviderRouter;
  private legacyProvider?: AIProvider;
  private currentRequestId: number = 0;

  constructor(providerOrRouter?: AIProvider | AIProviderRouter) {
    if (providerOrRouter instanceof AIProviderRouter) {
      this.router = providerOrRouter;
    } else if (providerOrRouter) {
      this.legacyProvider = providerOrRouter;
    } else {
      this.router = new AIProviderRouter();
    }
  }

  public async reasonProblem(
    rawProblem: unknown,
    overrideApiKeyOrProvider?: string | AIProvider,
    overrideProviderName?: string
  ): Promise<ReasoningExecutionResult> {
    const startTime = performance.now();
    const requestId = `req_${++this.currentRequestId}_${Date.now()}`;
    const capturedRequestId = this.currentRequestId;

    console.log(`[CodePilot][Reasoning][${requestId}] Reasoning request started`);

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

    const maxAttempts = 2;
    let lastError: AIError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (this.currentRequestId !== capturedRequestId) {
        console.warn(`[CodePilot][Reasoning][${requestId}] Stale request abandoned (newer request active)`);
        throw new AIError('AI_UNKNOWN_ERROR', 'Reasoning request superseded by newer request.', 409, false);
      }

      const isRecoveryAttempt = attempt > 1;
      console.log(`[CodePilot][Reasoning][${requestId}] Attempt ${attempt}/${maxAttempts} (Recovery: ${isRecoveryAttempt})`);

      try {
        let plan: SolutionPlan;
        if (typeof overrideApiKeyOrProvider === 'object' && overrideApiKeyOrProvider !== null) {
          plan = await overrideApiKeyOrProvider.reasonProblem(problem, isRecoveryAttempt);
        } else if (this.legacyProvider) {
          plan = await this.legacyProvider.reasonProblem(problem, isRecoveryAttempt);
        } else {
          const apiKey = typeof overrideApiKeyOrProvider === 'string' ? overrideApiKeyOrProvider : undefined;
          plan = await (this.router || new AIProviderRouter()).generateSolutionPlan(problem, isRecoveryAttempt, apiKey, overrideProviderName);
        }

        const validation = ConsistencyChecker.check(plan, problem);

        if (!validation.valid && plan.status === 'ready') {
          const isContradictionOrInsufficient = validation.issues.some(
            (i) => i.message.includes('inconsistent') || i.message.includes('contradictory') || i.message.includes('lacks sufficient')
          );
          plan.status = isContradictionOrInsufficient ? 'needs-clarification' : 'failed';
        }

        const reasoningDurationMs = Math.round(performance.now() - startTime);

        console.log(`[CodePilot][Reasoning][${requestId}] Reasoning completed on attempt ${attempt}`);
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

        if (!aiErr.retryable || attempt >= maxAttempts) {
          break;
        }

        if (aiErr.code === 'AI_RATE_LIMITED') {
          break;
        }
      }
    }

    const reasoningDurationMs = Math.round(performance.now() - startTime);
    console.error(`[CodePilot][Reasoning][${requestId}] Request failed permanently after ${reasoningDurationMs}ms:`, lastError?.message);

    throw lastError || new AIError('AI_UNKNOWN_ERROR', 'Failed to generate solution plan.', 500, false);
  }
}

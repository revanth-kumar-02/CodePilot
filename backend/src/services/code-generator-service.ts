import { AIProvider, OpenRouterProvider, GroqProvider, MockAIProvider, ProblemInput, ProblemSchema, AIError } from '../ai/index.js';
import { SolutionPlan, SolutionPlanSchema } from '../reasoning/schemas.js';
import { GeneratedCode, SupportedLanguage, SupportedLanguageSchema } from '../ai/code-schemas.js';
import { CodeValidator } from './code-validator.js';
import { getAIConfig } from '../ai/model-config.js';

export class CodeGeneratorService {
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

  public resolveLanguage(problemLang?: string | null, targetLang?: string): SupportedLanguage {
    if (targetLang) {
      const parsed = SupportedLanguageSchema.safeParse(targetLang.toLowerCase());
      if (parsed.success) return parsed.data;
    }

    if (problemLang) {
      const normalized = problemLang.toLowerCase();
      if (normalized.includes('c++') || normalized.includes('cpp') || normalized.includes('g++')) return 'cpp';
      if (normalized.includes('gcc') || normalized === 'c') return 'c';
      if (normalized.includes('java')) return 'java';
      if (normalized.includes('py')) return 'python';
      if (normalized.includes('js') || normalized.includes('javascript')) return 'javascript';
      if (normalized.includes('ts') || normalized.includes('typescript')) return 'typescript';
    }

    return 'java'; // Java is the default language
  }

  public async generateCode(
    rawProblem: unknown,
    rawPlan: unknown,
    requestedLanguage?: string,
    requestedVersion?: string
  ): Promise<{ generatedCode: GeneratedCode; durationMs: number }> {
    const startTime = performance.now();
    console.log('[CodePilot][CodeGenerator] Code generation request started');

    // 1. Schema Validation
    const probVal = ProblemSchema.safeParse(rawProblem);
    if (!probVal.success) {
      console.warn('[CodePilot][CodeGenerator] Problem validation failed');
      throw new AIError(
        'AI_VALIDATION_ERROR',
        `Invalid problem payload: ${probVal.error.issues.map((i: { message: string }) => i.message).join(', ')}`,
        400
      );
    }

    const planVal = SolutionPlanSchema.safeParse(rawPlan);
    if (!planVal.success) {
      console.warn('[CodePilot][CodeGenerator] Solution plan validation failed');
      throw new AIError(
        'AI_VALIDATION_ERROR',
        `Invalid solution plan payload: ${planVal.error.issues.map((i: { message: string }) => i.message).join(', ')}`,
        400
      );
    }

    const problem: ProblemInput = probVal.data;
    const plan: SolutionPlan = planVal.data;

    // 2. Payload size limits
    const serializedSize = JSON.stringify(problem).length + JSON.stringify(plan).length;
    if (serializedSize > 60000) {
      console.warn('[CodePilot][CodeGenerator] Payload size limits exceeded');
      throw new AIError(
        'AI_REQUEST_TOO_LARGE',
        'Payload size exceeds maximum allowed limit for code generation.',
        400
      );
    }

    // 3. Resolve Target Language
    const targetLanguage = this.resolveLanguage(problem.language, requestedLanguage);

    console.log(`[CodePilot][CodeGenerator] Target language: ${targetLanguage}`);
    console.log(`[CodePilot][CodeGenerator] Provider: ${this.provider.name}`);

    // 4. Bounded Generation Attempts (max 2 attempts)
    let attempt = 0;
    const maxAttempts = 2;

    while (attempt < maxAttempts) {
      attempt++;
      console.log(`[CodePilot][CodeGenerator] Code generation attempt ${attempt}/${maxAttempts}`);

      try {
        let currentPlan = plan;
        if (attempt > 1) {
          // Bounded regeneration attempt prompt modification
          const retryInstruction = `Return the same solution as source code only.
Remove ALL comments.
Do not add any comments.
Do not add explanations or Markdown.`;
          currentPlan = {
            ...plan,
            algorithm: {
              ...plan.algorithm,
              steps: [...plan.algorithm.steps, retryInstruction],
            },
          };
        }

        const result = await this.provider.generateCode(problem, currentPlan, targetLanguage);
        const validation = CodeValidator.parseAndValidate(result.code, targetLanguage);

        if (validation.hasComments) {
          console.warn(`[CodePilot][CodeGenerator] Attempt ${attempt} failed: CODE_COMMENT_VIOLATION detected.`);
          if (attempt < maxAttempts) {
            console.log('[CodePilot][CodeGenerator] Retrying generation with explicit no-comment constraint...');
            continue;
          } else {
            throw new AIError(
              'CODE_COMMENT_VIOLATION',
              'Generated code contains comments after 2 attempts.',
              400
            );
          }
        }

        if (!validation.valid) {
          throw new AIError(
            'CODE_VALIDATION_ERROR',
            `Generated code structural validation failed: ${validation.issues.join('; ')}`,
            400
          );
        }

        const finalResult: GeneratedCode = {
          ...result,
          code: validation.code,
          version: requestedVersion,
          completeness: validation.completeness && result.completeness,
        };

        const durationMs = Math.round(performance.now() - startTime);
        console.log(`[CodePilot][CodeGenerator] Code generated successfully on attempt ${attempt} in ${durationMs}ms`);

        return {
          generatedCode: finalResult,
          durationMs,
        };
      } catch (err) {
        if (err instanceof AIError && err.code === 'CODE_COMMENT_VIOLATION') {
          if (attempt < maxAttempts) {
            continue;
          }
          const durationMs = Math.round(performance.now() - startTime);
          console.error(`[CodePilot][CodeGenerator] Generation failed after ${durationMs}ms:`, err.message);
          throw err;
        }
        if (attempt >= maxAttempts) {
          const durationMs = Math.round(performance.now() - startTime);
          console.error(`[CodePilot][CodeGenerator] Generation failed after ${durationMs}ms:`, err instanceof Error ? err.message : err);
          throw err;
        }
      }
    }

    throw new AIError('CODE_COMMENT_VIOLATION', 'Generated code contains comments after 2 attempts.', 400);
  }
}

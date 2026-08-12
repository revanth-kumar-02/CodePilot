import { AIProvider, OpenRouterProvider, GroqProvider, MockAIProvider, ProblemInput, ProblemSchema, AIError } from '../ai/index.js';
import { SolutionPlan, SolutionPlanSchema } from '../reasoning/schemas.js';
import { GeneratedCode, SupportedLanguage, SupportedLanguageSchema } from '../ai/code-schemas.js';
import { CodeValidator } from './code-validator.js';
import { getAIConfig } from '../ai/model-config.js';
import { PlatformRules } from '../config/platform-rules.js';

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

    // 3. Resolve Target Language & Platform Rules
    const targetLanguage = this.resolveLanguage(problem.language, requestedLanguage);
    const platformRule = PlatformRules.getRule(
      problem.source?.hostname || problem.source?.url,
      problem.source?.platform
    );

    console.log(`[CodePilot][CodeGenerator] Target language: ${targetLanguage}`);
    console.log(`[CodePilot][CodeGenerator] Platform: ${platformRule.platform} (Required class: ${platformRule.className})`);
    console.log(`[CodePilot][CodeGenerator] Provider: ${this.provider.name}`);

    // 4. Bounded Generation Attempts (max 2 attempts)
    let attempt = 0;
    const maxAttempts = 2;
    let lastIssues: string[] = [];

    while (attempt < maxAttempts) {
      attempt++;
      console.log(`[CodePilot][CodeGenerator] Code generation attempt ${attempt}/${maxAttempts}`);

      try {
        let retryInstruction: string | undefined;
        if (attempt > 1) {
          retryInstruction = `Regenerate the solution using the required platform structure.
Use exactly one public class named ${platformRule.className}.
Ensure all braces are balanced.
Do not add any extra closing braces.
Return source code only.`;
        }

        const result = await this.provider.generateCode(
          problem,
          plan,
          targetLanguage,
          platformRule,
          retryInstruction
        );
        const validation = CodeValidator.parseAndValidate(result.code, targetLanguage, platformRule);
        lastIssues = validation.issues;

        if (validation.diagnostics) {
          console.log(`[CodePilot][Diagnostics]
Platform: ${validation.diagnostics.platform}
Language: ${validation.diagnostics.language}
Required class: ${validation.diagnostics.requiredClass}
Detected class: ${validation.diagnostics.detectedClass}
Public classes: ${validation.diagnostics.publicClassesCount}
Brace validation: ${validation.diagnostics.braceValidation}
Comment validation: ${validation.diagnostics.commentValidation}
Structure: ${validation.diagnostics.structureValidation}
Final status: ${validation.diagnostics.finalStatus}`);
        }

        if (validation.hasComments) {
          console.warn(`[CodePilot][CodeGenerator] Attempt ${attempt} failed: CODE_COMMENT_VIOLATION detected.`);
          if (attempt < maxAttempts) {
            console.log('[CodePilot][CodeGenerator] Retrying generation with explicit repair instruction...');
            continue;
          } else {
            throw new AIError('CODE_COMMENT_VIOLATION', 'Generated code contains comments after 2 attempts.', 400);
          }
        }

        if (!validation.valid) {
          console.warn(`[CodePilot][CodeGenerator] Attempt ${attempt} failed: CODE_STRUCTURE_INVALID detected.`);
          if (attempt < maxAttempts) {
            console.log('[CodePilot][CodeGenerator] Retrying generation with explicit structural repair prompt...');
            continue;
          } else {
            throw new AIError(
              'CODE_STRUCTURE_INVALID',
              `CODE_STRUCTURE_INVALID: Generated code structural validation failed after ${maxAttempts} attempts. Issues: ${validation.issues.join('; ')}`,
              400
            );
          }
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
        if (err instanceof AIError && (err.code === 'CODE_COMMENT_VIOLATION' || err.code === 'CODE_STRUCTURE_INVALID')) {
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

    throw new AIError(
      'CODE_STRUCTURE_INVALID',
      `CODE_STRUCTURE_INVALID: Generated code structural validation failed after 2 attempts. Issues: ${lastIssues.join('; ')}`,
      400
    );
  }
}

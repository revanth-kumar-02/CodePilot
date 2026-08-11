import { AIProvider, AIError } from './ai-provider.js';
import { ProblemInput, ProblemAnalysis } from './schemas.js';
import { SolutionPlan } from '../reasoning/schemas.js';
import { GeneratedCode, SupportedLanguage } from './code-schemas.js';
import { getAIConfig } from './model-config.js';
import { PromptBuilder } from './prompt-builder.js';
import { ResponseParser } from './response-parser.js';
import { ReasoningPromptBuilder } from '../reasoning/reasoning-prompt-builder.js';
import { ReasoningValidator } from '../reasoning/reasoning-validator.js';
import { CodePromptBuilder } from '../services/code-prompt-builder.js';
import { CodeValidator } from '../services/code-validator.js';

export class GroqProvider implements AIProvider {
  public readonly name = 'groq';

  public async analyzeProblem(problem: ProblemInput): Promise<ProblemAnalysis> {
    const config = getAIConfig();
    const apiKey = config.groqApiKey;
    const model = config.groqModel;

    if (!apiKey) {
      throw new AIError(
        'AI_CONFIGURATION_ERROR',
        'GROQ_API_KEY is not configured on the backend environment.',
        500,
        false
      );
    }

    const systemPrompt = PromptBuilder.buildSystemPrompt();
    const userPrompt = PromptBuilder.buildUserPrompt(problem);

    const payload = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    };

    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    return this.executeRequest(url, headers, payload, (rawContent) =>
      ResponseParser.parse(rawContent, this.name, model)
    );
  }

  public async reasonProblem(problem: ProblemInput, isRecoveryAttempt: boolean = false): Promise<SolutionPlan> {
    const config = getAIConfig();
    const apiKey = config.groqApiKey;
    const model = config.groqModel;

    if (!apiKey) {
      throw new AIError(
        'AI_CONFIGURATION_ERROR',
        'GROQ_API_KEY is not configured on the backend environment.',
        500,
        false
      );
    }

    const systemPrompt = ReasoningPromptBuilder.buildSystemPrompt(isRecoveryAttempt);
    const userPrompt = ReasoningPromptBuilder.buildUserPrompt(problem);

    const payload = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    };

    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    return this.executeRequest(url, headers, payload, (rawContent) => {
      const { plan } = ReasoningValidator.parseAndValidate(rawContent, problem, this.name, model);
      return plan;
    });
  }

  public async generateCode(
    problem: ProblemInput,
    plan: SolutionPlan,
    targetLanguage: SupportedLanguage
  ): Promise<GeneratedCode> {
    const startTime = Date.now();
    const config = getAIConfig();
    const apiKey = config.groqApiKey;
    const model = config.groqModel;

    if (!apiKey) {
      throw new AIError(
        'AI_CONFIGURATION_ERROR',
        'GROQ_API_KEY is not configured on the backend environment.',
        500,
        false
      );
    }

    const systemPrompt = CodePromptBuilder.buildSystemPrompt(targetLanguage);
    const userPrompt = CodePromptBuilder.buildUserPrompt(problem, plan, targetLanguage);

    const payload = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    };

    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    return this.executeRequest(url, headers, payload, (rawContent) => {
      const validation = CodeValidator.parseAndValidate(rawContent, targetLanguage);
      return {
        code: validation.code,
        language: targetLanguage,
        explanation: [
          `Implemented ${plan.algorithm.name} (${plan.algorithm.category}) using Groq (${model}).`,
          `Time complexity ${plan.complexity.time}, Space complexity ${plan.complexity.space}.`,
        ],
        completeness: validation.completeness,
        model,
        provider: this.name,
        generatedAt: Date.now(),
        durationMs: Date.now() - startTime,
      };
    });
  }

  private async executeRequest<T>(
    url: string,
    headers: Record<string, string>,
    payload: any,
    parseFn: (content: string) => T
  ): Promise<T> {
    const config = getAIConfig();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();

        if (response.status === 401 || response.status === 403) {
          throw new AIError('AI_AUTHENTICATION_ERROR', 'Invalid or unauthorized Groq API Key.', 401, false);
        }

        if (response.status === 429) {
          throw new AIError('AI_RATE_LIMITED', 'Groq rate limit exceeded.', 429, true);
        }

        if (response.status >= 500) {
          throw new AIError('AI_UPSTREAM_ERROR', `Groq upstream server error (${response.status}): ${errText}`, 502, true);
        }

        throw new AIError('AI_UPSTREAM_ERROR', `Groq request failed (${response.status}): ${errText}`, response.status, true);
      }

      const responseData = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const rawContent = responseData?.choices?.[0]?.message?.content;

      if (!rawContent || rawContent.trim().length === 0) {
        throw new AIError('AI_EMPTY_RESPONSE', 'No usable content received from Groq.', 502, true);
      }

      return parseFn(rawContent);
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof AIError) {
        throw err;
      } else if (err instanceof Error && err.name === 'AbortError') {
        throw new AIError('AI_TIMEOUT', `Groq request timed out after ${config.timeoutMs}ms.`, 504, true);
      } else {
        throw new AIError('AI_UNKNOWN_ERROR', `Unexpected network error: ${err instanceof Error ? err.message : String(err)}`, 500, true);
      }
    }
  }
}

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
import { PlatformRule, PlatformRules } from '../config/platform-rules.js';

export class OpenRouterProvider implements AIProvider {
  public readonly name = 'openrouter';
  private customApiKey?: string;

  constructor(customApiKey?: string) {
    this.customApiKey = customApiKey;
  }

  public async analyzeProblem(problem: ProblemInput): Promise<ProblemAnalysis> {
    const config = getAIConfig();
    const apiKey = this.customApiKey || config.openRouterApiKey;

    if (!apiKey) {
      throw new AIError(
        'AI_CONFIGURATION_ERROR',
        'OpenRouter API key is not provided or configured.',
        500
      );
    }

    const systemPrompt = PromptBuilder.buildSystemPrompt();
    const userPrompt = PromptBuilder.buildUserPrompt(problem);

    const payload = {
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 2048,
    };

    const url = 'https://openrouter.ai/api/v1/chat/completions';
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': config.siteUrl,
      'X-Title': config.appName,
      'Content-Type': 'application/json',
    };

    const maxAttempts = 2;
    let lastError: AIError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
            throw new AIError('AI_AUTHENTICATION_ERROR', 'Invalid or unauthorized OpenRouter API Key.', 401);
          }

          if (response.status === 429) {
            const err = new AIError('AI_RATE_LIMITED', 'OpenRouter rate limit exceeded.', 429);
            if (attempt < maxAttempts) {
              lastError = err;
              await new Promise((res) => setTimeout(res, 1500));
              continue;
            }
            throw err;
          }

          if (response.status >= 500) {
            const err = new AIError('AI_UPSTREAM_ERROR', `OpenRouter upstream server error (${response.status}): ${errText}`, 502);
            if (attempt < maxAttempts) {
              lastError = err;
              await new Promise((res) => setTimeout(res, 1000));
              continue;
            }
            throw err;
          }

          throw new AIError('AI_UPSTREAM_ERROR', `OpenRouter request failed (${response.status}): ${errText}`, response.status);
        }

        const responseData = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const rawContent = responseData?.choices?.[0]?.message?.content;

        if (!rawContent) {
          throw new AIError('AI_INVALID_RESPONSE', 'Empty response content received from OpenRouter.', 502);
        }

        return ResponseParser.parse(rawContent, this.name, config.model);
      } catch (err: unknown) {
        clearTimeout(timeoutId);

        if (err instanceof AIError) {
          if (attempt === maxAttempts || (err.code !== 'AI_RATE_LIMITED' && err.code !== 'AI_UPSTREAM_ERROR')) {
            throw err;
          }
          lastError = err;
        } else if (err instanceof Error && err.name === 'AbortError') {
          throw new AIError('AI_TIMEOUT', `OpenRouter request timed out after ${config.timeoutMs}ms.`, 504);
        } else {
          throw new AIError('AI_UNKNOWN_ERROR', `Unexpected network error: ${err instanceof Error ? err.message : String(err)}`, 500);
        }
      }
    }

    throw lastError || new AIError('AI_UNKNOWN_ERROR', 'Failed to communicate with OpenRouter after retries.', 500);
  }

  public async reasonProblem(problem: ProblemInput, isRecoveryAttempt: boolean = false): Promise<SolutionPlan> {
    const config = getAIConfig();
    const apiKey = this.customApiKey || config.openRouterApiKey;

    if (!apiKey) {
      throw new AIError(
        'AI_CONFIGURATION_ERROR',
        'OpenRouter API key is not provided or configured.',
        500,
        false
      );
    }

    const systemPrompt = ReasoningPromptBuilder.buildSystemPrompt(isRecoveryAttempt);
    const userPrompt = ReasoningPromptBuilder.buildUserPrompt(problem);

    const payload = {
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 4096,
    };

    const url = 'https://openrouter.ai/api/v1/chat/completions';
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': config.siteUrl,
      'X-Title': config.appName,
      'Content-Type': 'application/json',
    };

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
          throw new AIError('AI_AUTHENTICATION_ERROR', 'Invalid or unauthorized OpenRouter API Key.', 401, false);
        }

        if (response.status === 429) {
          throw new AIError('AI_RATE_LIMITED', 'OpenRouter rate limit exceeded.', 429, true);
        }

        if (response.status >= 500) {
          throw new AIError('AI_UPSTREAM_ERROR', `OpenRouter upstream server error (${response.status}): ${errText}`, 502, true);
        }

        throw new AIError('AI_UPSTREAM_ERROR', `OpenRouter request failed (${response.status}): ${errText}`, response.status, true);
      }

      const responseData = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const rawContent = responseData?.choices?.[0]?.message?.content;

      if (!rawContent || rawContent.trim().length === 0) {
        throw new AIError('AI_EMPTY_RESPONSE', 'No usable content received from OpenRouter.', 502, true);
      }

      const { plan } = ReasoningValidator.parseAndValidate(rawContent, problem, this.name, config.model);
      return plan;
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof AIError) {
        throw err;
      } else if (err instanceof Error && err.name === 'AbortError') {
        throw new AIError('AI_TIMEOUT', `OpenRouter request timed out after ${config.timeoutMs}ms.`, 504, true);
      } else {
        throw new AIError('AI_UNKNOWN_ERROR', `Unexpected network error: ${err instanceof Error ? err.message : String(err)}`, 500, true);
      }
    }
  }

  public async generateCode(
    problem: ProblemInput,
    plan: SolutionPlan,
    targetLanguage: SupportedLanguage,
    rule?: PlatformRule,
    retryInstruction?: string
  ): Promise<GeneratedCode> {
    const startTime = Date.now();
    const config = getAIConfig();
    const apiKey = this.customApiKey || config.openRouterApiKey;
    const activeRule = rule || PlatformRules.getRule(problem.source?.hostname || problem.source?.url || problem.source?.platform);

    if (!apiKey) {
      throw new AIError(
        'AI_CONFIGURATION_ERROR',
        'OpenRouter API key is not provided or configured.',
        500
      );
    }

    const systemPrompt = CodePromptBuilder.buildSystemPrompt(targetLanguage, activeRule);
    let userPrompt = CodePromptBuilder.buildUserPrompt(problem, plan, targetLanguage);
    if (retryInstruction) {
      userPrompt += `\n\nREGENERATION INSTRUCTION:\n${retryInstruction}`;
    }

    const payload = {
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    };

    const url = 'https://openrouter.ai/api/v1/chat/completions';
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': config.siteUrl,
      'X-Title': config.appName,
      'Content-Type': 'application/json',
    };

    const maxAttempts = 2;
    let lastError: AIError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
            throw new AIError('AI_AUTHENTICATION_ERROR', 'Invalid or unauthorized OpenRouter API Key.', 401);
          }

          if (response.status === 429) {
            const err = new AIError('AI_RATE_LIMITED', 'OpenRouter rate limit exceeded.', 429);
            if (attempt < maxAttempts) {
              lastError = err;
              await new Promise((res) => setTimeout(res, 1500));
              continue;
            }
            throw err;
          }

          if (response.status >= 500) {
            const err = new AIError('AI_UPSTREAM_ERROR', `OpenRouter upstream server error (${response.status}): ${errText}`, 502);
            if (attempt < maxAttempts) {
              lastError = err;
              await new Promise((res) => setTimeout(res, 1000));
              continue;
            }
            throw err;
          }

          throw new AIError('AI_UPSTREAM_ERROR', `OpenRouter request failed (${response.status}): ${errText}`, response.status);
        }

        const responseData = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const rawContent = responseData?.choices?.[0]?.message?.content;

        if (!rawContent) {
          throw new AIError('AI_INVALID_RESPONSE', 'Empty response content received from OpenRouter.', 502);
        }

        const validation = CodeValidator.parseAndValidate(rawContent, targetLanguage);

        return {
          code: validation.code,
          language: targetLanguage,
          explanation: [
            `Implemented ${plan.algorithm.name} (${plan.algorithm.category}).`,
            `Time complexity ${plan.complexity.time}, Space complexity ${plan.complexity.space}.`,
          ],
          completeness: validation.completeness,
          model: config.model,
          provider: this.name,
          generatedAt: Date.now(),
          durationMs: Date.now() - startTime,
        };
      } catch (err: unknown) {
        clearTimeout(timeoutId);

        if (err instanceof AIError) {
          if (attempt === maxAttempts || (err.code !== 'AI_RATE_LIMITED' && err.code !== 'AI_UPSTREAM_ERROR')) {
            throw err;
          }
          lastError = err;
        } else if (err instanceof Error && err.name === 'AbortError') {
          throw new AIError('AI_TIMEOUT', `OpenRouter request timed out after ${config.timeoutMs}ms.`, 504);
        } else {
          throw new AIError('AI_UNKNOWN_ERROR', `Unexpected network error: ${err instanceof Error ? err.message : String(err)}`, 500);
        }
      }
    }

    throw lastError || new AIError('AI_UNKNOWN_ERROR', 'Failed to communicate with OpenRouter after retries.', 500);
  }
}

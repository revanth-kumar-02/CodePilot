import { AIProvider, AIError } from './ai-provider.js';
import { ProblemInput, ProblemAnalysis } from './schemas.js';
import { SolutionPlan } from '../reasoning/schemas.js';
import { GeneratedCode, SupportedLanguage } from './code-schemas.js';
import { PromptBuilder } from './prompt-builder.js';
import { ResponseParser } from './response-parser.js';
import { ReasoningPromptBuilder } from '../reasoning/reasoning-prompt-builder.js';
import { ReasoningValidator } from '../reasoning/reasoning-validator.js';
import { CodePromptBuilder } from '../services/code-prompt-builder.js';
import { CodeValidator } from '../services/code-validator.js';
import { PlatformRule, PlatformRules } from '../config/platform-rules.js';

export class GroqProvider implements AIProvider {
  public readonly name = 'groq';
  private customApiKey?: string;
  private customModel?: string;
  private workflowName: 'analysis' | 'code';

  constructor(customApiKey?: string, customModel?: string, workflowName: 'analysis' | 'code' = 'analysis') {
    this.customApiKey = customApiKey;
    this.customModel = customModel;
    this.workflowName = workflowName;
  }

  private getEnvApiKey(): string {
    if (this.workflowName === 'analysis') {
      return process.env.GROQ_ANALYSIS_KEY || process.env.GROQ_API_KEY || '';
    } else {
      return process.env.GROQ_CODE_KEY || process.env.GROQ_API_KEY || '';
    }
  }

  private getApiKey(): string {
    if (this.customApiKey) return this.customApiKey;
    return this.getEnvApiKey();
  }

  public async analyzeProblem(problem: ProblemInput): Promise<ProblemAnalysis> {
    const apiKey = this.getApiKey();
    const model = this.customModel || process.env.GROQ_ANALYSIS_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

    if (!apiKey) {
      throw new AIError(
        'AI_CONFIGURATION_ERROR',
        'GROQ_ANALYSIS_KEY is not configured on the environment.',
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
    const apiKey = this.getApiKey();
    const model = this.customModel || process.env.GROQ_ANALYSIS_MODEL || process.env.GROQ_REASONING_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

    if (!apiKey) {
      throw new AIError(
        'AI_CONFIGURATION_ERROR',
        'GROQ_ANALYSIS_KEY is not configured on the environment.',
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
    targetLanguage: SupportedLanguage,
    rule?: PlatformRule,
    retryInstruction?: string
  ): Promise<GeneratedCode> {
    const startTime = Date.now();
    const apiKey = this.getApiKey();
    const model = this.customModel || process.env.GROQ_CODE_MODEL || process.env.GROQ_REASONING_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    const activeRule = rule || PlatformRules.getRule(problem.source?.hostname || problem.source?.url || problem.source?.platform);

    if (!apiKey) {
      throw new AIError(
        'AI_CONFIGURATION_ERROR',
        'GROQ_CODE_KEY is not configured on the environment.',
        500,
        false
      );
    }

    const systemPrompt = CodePromptBuilder.buildSystemPrompt(targetLanguage, activeRule);
    let userPrompt = CodePromptBuilder.buildUserPrompt(problem, plan, targetLanguage);
    if (retryInstruction) {
      userPrompt += `\n\nREGENERATION INSTRUCTION:\n${retryInstruction}`;
    }

    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const payload = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 4096,
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
    parseFn: (content: string) => T,
    attempt: number = 1
  ): Promise<T> {
    const timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 45000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
          const envKey = this.getEnvApiKey();
          if (this.customApiKey && envKey && envKey !== this.customApiKey) {
            console.warn(`[GroqProvider] Custom header API key was unauthorized (${response.status}). Retrying request using backend environment key...`);
            this.customApiKey = undefined;
            const fallbackHeaders = { ...headers, Authorization: `Bearer ${envKey}` };
            return this.executeRequest(url, fallbackHeaders, payload, parseFn, attempt);
          }
          throw new AIError('AI_AUTHENTICATION_ERROR', `Invalid or unauthorized Groq ${this.workflowName} API Key.`, 401, false);
        }

        if (response.status === 429 || response.status === 413 || errText.includes('rate_limit_exceeded') || errText.includes('TPM')) {
          const retryAfterHeader = response.headers.get('retry-after');
          let retryAfterTime = retryAfterHeader ? `${retryAfterHeader}s` : undefined;
          if (!retryAfterTime) {
            const match = errText.match(/try again in ([^.]+)/i);
            if (match) retryAfterTime = match[1].trim();
          }

          const workflowLabel = this.workflowName === 'code' ? 'Code Generation' : 'Analysis';
          const msg = `AI RATE LIMIT REACHED\nWorkflow: ${workflowLabel}${retryAfterTime ? `\nRetry available after: ${retryAfterTime}` : ''}`;

          throw new AIError('AI_RATE_LIMITED', msg, 429, false);
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
        throw new AIError('AI_TIMEOUT', `Groq request timed out after ${timeoutMs}ms.`, 504, true);
      } else {
        // Auto-retry once for transient network fetch errors
        if (attempt === 1) {
          console.warn(`[GroqProvider] Groq fetch network error on attempt 1 (${err instanceof Error ? err.message : String(err)}). Retrying in 300ms...`);
          await new Promise((resolve) => setTimeout(resolve, 300));
          return this.executeRequest(url, headers, payload, parseFn, 2);
        }

        const cause = (err as any)?.cause ? ` (Cause: ${(err as any).cause})` : '';
        throw new AIError('AI_UNKNOWN_ERROR', `Unexpected network error: ${err instanceof Error ? err.message : String(err)}${cause}`, 500, true);
      }
    }
  }
}

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

export class OpenAIProvider implements AIProvider {
  public readonly name = 'openai';
  private apiKey?: string;
  private model: string;

  constructor(apiKey?: string, model: string = 'gpt-4o-mini') {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY;
    this.model = model;
  }

  public async analyzeProblem(problem: ProblemInput): Promise<ProblemAnalysis> {
    if (!this.apiKey) {
      throw new AIError('AI_CONFIGURATION_ERROR', 'OpenAI API key is not provided or configured.', 401);
    }

    const systemPrompt = PromptBuilder.buildSystemPrompt();
    const userPrompt = PromptBuilder.buildUserPrompt(problem);

    const payload = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
    };

    const rawContent = await this.executeChatCompletion(payload);
    const analysis = ResponseParser.parse(rawContent, this.name, this.model);
    return analysis;
  }

  public async reasonProblem(problem: ProblemInput, isRecoveryAttempt: boolean = false): Promise<SolutionPlan> {
    if (!this.apiKey) {
      throw new AIError('AI_CONFIGURATION_ERROR', 'OpenAI API key is not provided or configured.', 401);
    }

    const systemPrompt = ReasoningPromptBuilder.buildSystemPrompt(isRecoveryAttempt);
    const userPrompt = ReasoningPromptBuilder.buildUserPrompt(problem);

    const payload = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    };

    const rawContent = await this.executeChatCompletion(payload);
    const { plan } = ReasoningValidator.parseAndValidate(rawContent, problem, this.name, this.model);
    return plan;
  }

  public async generateCode(
    problem: ProblemInput,
    plan: SolutionPlan,
    targetLanguage: SupportedLanguage,
    rule?: PlatformRule,
    retryInstruction?: string
  ): Promise<GeneratedCode> {
    const startTime = Date.now();
    if (!this.apiKey) {
      throw new AIError('AI_CONFIGURATION_ERROR', 'OpenAI API key is not provided or configured.', 401);
    }

    const activeRule = rule || PlatformRules.getRule(problem.source?.hostname || problem.source?.url || problem.source?.platform);
    const systemPrompt = CodePromptBuilder.buildSystemPrompt(targetLanguage, activeRule);
    let userPrompt = CodePromptBuilder.buildUserPrompt(problem, plan, targetLanguage);

    if (retryInstruction) {
      userPrompt += `\n\nREGENERATION INSTRUCTION:\n${retryInstruction}`;
    }

    const payload = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
    };

    const rawContent = await this.executeChatCompletion(payload);
    const cleanCode = CodeValidator.stripFences(rawContent);

    return {
      code: cleanCode,
      language: targetLanguage,
      explanation: [`OpenAI (${this.model}) generated verified algorithm implementation.`],
      completeness: true,
      model: this.model,
      provider: this.name,
      generatedAt: Date.now(),
      durationMs: Date.now() - startTime,
    };
  }

  private async executeChatCompletion(payload: any): Promise<string> {
    const url = 'https://api.openai.com/v1/chat/completions';
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

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
          throw new AIError('AI_AUTHENTICATION_ERROR', 'Invalid OpenAI API Key.', 401);
        }
        if (response.status === 429) {
          throw new AIError('AI_RATE_LIMITED', 'OpenAI Rate limit exceeded.', 429);
        }
        throw new AIError('AI_UPSTREAM_ERROR', `OpenAI API error (${response.status}): ${errText}`, response.status);
      }

      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new AIError('AI_EMPTY_RESPONSE', 'Empty response received from OpenAI.', 502);
      }
      return content;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof AIError) throw err;
      if ((err as Error)?.name === 'AbortError') {
        throw new AIError('AI_TIMEOUT', 'OpenAI request timed out.', 504);
      }
      throw new AIError('AI_UPSTREAM_ERROR', err instanceof Error ? err.message : 'Unknown OpenAI connection error', 500);
    }
  }
}

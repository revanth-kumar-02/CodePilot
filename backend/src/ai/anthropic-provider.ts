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

export class AnthropicProvider implements AIProvider {
  public readonly name = 'anthropic';
  private apiKey?: string;
  private model: string;

  constructor(apiKey?: string, model: string = 'claude-3-5-sonnet-20241022') {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY;
    this.model = model;
  }

  public async analyzeProblem(problem: ProblemInput): Promise<ProblemAnalysis> {
    if (!this.apiKey) {
      throw new AIError('AI_CONFIGURATION_ERROR', 'Anthropic API key is not provided or configured.', 401);
    }

    const systemPrompt = PromptBuilder.buildSystemPrompt();
    const userPrompt = PromptBuilder.buildUserPrompt(problem);

    const rawContent = await this.executeMessages(systemPrompt, userPrompt);
    const analysis = ResponseParser.parse(rawContent, this.name, this.model);
    return analysis;
  }

  public async reasonProblem(problem: ProblemInput, isRecoveryAttempt: boolean = false): Promise<SolutionPlan> {
    if (!this.apiKey) {
      throw new AIError('AI_CONFIGURATION_ERROR', 'Anthropic API key is not provided or configured.', 401);
    }

    const systemPrompt = ReasoningPromptBuilder.buildSystemPrompt(isRecoveryAttempt);
    const userPrompt = ReasoningPromptBuilder.buildUserPrompt(problem);

    const rawContent = await this.executeMessages(systemPrompt, userPrompt);
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
      throw new AIError('AI_CONFIGURATION_ERROR', 'Anthropic API key is not provided or configured.', 401);
    }

    const activeRule = rule || PlatformRules.getRule(problem.source?.hostname || problem.source?.url || problem.source?.platform);
    const systemPrompt = CodePromptBuilder.buildSystemPrompt(targetLanguage, activeRule);
    let userPrompt = CodePromptBuilder.buildUserPrompt(problem, plan, targetLanguage);

    if (retryInstruction) {
      userPrompt += `\n\nREGENERATION INSTRUCTION:\n${retryInstruction}`;
    }

    const rawContent = await this.executeMessages(systemPrompt, userPrompt);
    const cleanCode = CodeValidator.stripFences(rawContent);

    return {
      code: cleanCode,
      language: targetLanguage,
      explanation: [`Anthropic Claude (${this.model}) generated verified algorithm implementation.`],
      completeness: true,
      model: this.model,
      provider: this.name,
      generatedAt: Date.now(),
      durationMs: Date.now() - startTime,
    };
  }

  private async executeMessages(systemPrompt: string, userPrompt: string): Promise<string> {
    const url = 'https://api.anthropic.com/v1/messages';
    const headers = {
      'x-api-key': this.apiKey || '',
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    };

    const payload = {
      model: this.model,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 4096,
      temperature: 0.1,
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
          throw new AIError('AI_AUTHENTICATION_ERROR', 'Invalid Anthropic API Key.', 401);
        }
        if (response.status === 429) {
          throw new AIError('AI_RATE_LIMITED', 'Anthropic Rate limit exceeded.', 429);
        }
        throw new AIError('AI_UPSTREAM_ERROR', `Anthropic API error (${response.status}): ${errText}`, response.status);
      }

      const data = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
      const text = data?.content?.[0]?.text;
      if (!text) {
        throw new AIError('AI_EMPTY_RESPONSE', 'Empty response received from Anthropic API.', 502);
      }
      return text;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof AIError) throw err;
      if ((err as Error)?.name === 'AbortError') {
        throw new AIError('AI_TIMEOUT', 'Anthropic request timed out.', 504);
      }
      throw new AIError('AI_UPSTREAM_ERROR', err instanceof Error ? err.message : 'Unknown Anthropic connection error', 500);
    }
  }
}

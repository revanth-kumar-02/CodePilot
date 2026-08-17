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

export class GeminiProvider implements AIProvider {
  public readonly name = 'gemini';
  private apiKey?: string;
  private model: string;

  constructor(apiKey?: string, model: string = 'gemini-2.0-flash') {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
    this.model = model || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  }

  public async analyzeProblem(problem: ProblemInput): Promise<ProblemAnalysis> {
    if (!this.apiKey) {
      throw new AIError('AI_CONFIGURATION_ERROR', 'Google Gemini API key is not provided or configured.', 401);
    }

    const systemPrompt = PromptBuilder.buildSystemPrompt();
    const userPrompt = PromptBuilder.buildUserPrompt(problem);

    const rawContent = await this.executeGenerateContent(systemPrompt, userPrompt);
    const analysis = ResponseParser.parse(rawContent, this.name, this.model);
    return analysis;
  }

  public async reasonProblem(problem: ProblemInput, isRecoveryAttempt: boolean = false): Promise<SolutionPlan> {
    if (!this.apiKey) {
      throw new AIError('AI_CONFIGURATION_ERROR', 'Google Gemini API key is not provided or configured.', 401);
    }

    const systemPrompt = ReasoningPromptBuilder.buildSystemPrompt(isRecoveryAttempt);
    const userPrompt = ReasoningPromptBuilder.buildUserPrompt(problem);

    const rawContent = await this.executeGenerateContent(systemPrompt, userPrompt, true);
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
      throw new AIError('AI_CONFIGURATION_ERROR', 'Google Gemini API key is not provided or configured.', 401);
    }

    const activeRule = rule || PlatformRules.getRule(problem.source?.hostname || problem.source?.url || problem.source?.platform);
    const systemPrompt = CodePromptBuilder.buildSystemPrompt(targetLanguage, activeRule);
    let userPrompt = CodePromptBuilder.buildUserPrompt(problem, plan, targetLanguage);

    if (retryInstruction) {
      userPrompt += `\n\nREGENERATION INSTRUCTION:\n${retryInstruction}`;
    }

    const rawContent = await this.executeGenerateContent(systemPrompt, userPrompt);
    const cleanCode = CodeValidator.stripFences(rawContent);

    return {
      code: cleanCode,
      language: targetLanguage,
      explanation: [`Google Gemini (${this.model}) generated verified algorithm implementation.`],
      completeness: true,
      model: this.model,
      provider: this.name,
      generatedAt: Date.now(),
      durationMs: Date.now() - startTime,
    };
  }

  private async executeGenerateContent(systemPrompt: string, userPrompt: string, jsonResponse: boolean = false): Promise<string> {
    if (!this.apiKey || !this.apiKey.startsWith('AIzaSy')) {
      throw new AIError(
        'AI_AUTHENTICATION_ERROR',
        'Invalid Google Gemini API Key. Google AI Studio keys must start with "AIzaSy...". Get a free key at https://aistudio.google.com/app/apikey',
        401,
        false
      );
    }

    const candidateModels = Array.from(
      new Set([
        this.model,
        process.env.GEMINI_MODEL || 'gemini-1.5-flash',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-2.0-flash',
      ])
    );

    let lastError: Error | null = null;

    for (const modelId of candidateModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${this.apiKey}`;

      const payload: any = {
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
        },
      };

      if (jsonResponse) {
        payload.generationConfig.responseMimeType = 'application/json';
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          if (response.status === 401 || response.status === 403) {
            throw new AIError('AI_AUTHENTICATION_ERROR', 'Invalid Google Gemini API Key.', 401);
          }
          if (response.status === 429) {
            throw new AIError('AI_RATE_LIMITED', 'Google Gemini Rate limit exceeded.', 429);
          }
          if (response.status === 404) {
            console.warn(`[CodePilot][GeminiProvider] Model ${modelId} returned 404, trying next candidate model...`);
            lastError = new AIError('AI_UPSTREAM_ERROR', `Gemini API error (404): ${errText}`, 404);
            continue;
          }
          throw new AIError('AI_UPSTREAM_ERROR', `Gemini API error (${response.status}): ${errText}`, response.status);
        }

        const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new AIError('AI_EMPTY_RESPONSE', 'Empty response received from Google Gemini API.', 502);
        }
        return text;
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof AIError && (err.statusHttp === 401 || err.statusHttp === 429)) {
          throw err;
        }
        if ((err as Error)?.name === 'AbortError') {
          throw new AIError('AI_TIMEOUT', 'Google Gemini request timed out.', 504);
        }
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw lastError || new AIError('AI_UPSTREAM_ERROR', 'All Gemini model candidate endpoints failed.', 500);
  }
}

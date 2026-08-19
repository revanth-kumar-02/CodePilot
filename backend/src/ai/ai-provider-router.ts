import { AIProvider } from './ai-provider.js';
import { ProviderFactory } from './provider-factory.js';
import { GroqProvider } from './groq-provider.js';
import { OpenRouterProvider } from './openrouter-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { MockAIProvider } from './mock-provider.js';
import { ProblemInput, ProblemAnalysis } from './schemas.js';
import { SolutionPlan } from '../reasoning/schemas.js';
import { GeneratedCode, SupportedLanguage } from './code-schemas.js';
import { PlatformRule } from '../config/platform-rules.js';

export interface WorkflowConfig {
  provider: 'groq' | 'openrouter' | 'gemini' | 'mock' | string;
  apiKey: string;
  model: string;
}

export interface CentralizedAIConfig {
  analysis: WorkflowConfig;
  reasoning: WorkflowConfig;
  code: WorkflowConfig;
}

export class AIProviderRouter {
  private config: CentralizedAIConfig;
  private analysisProvider: AIProvider;
  private reasoningProvider: AIProvider;
  private codeProvider: AIProvider;
  private inFlightRequests: Map<string, Promise<any>> = new Map();

  constructor(customConfig?: Partial<CentralizedAIConfig>) {
    this.config = this.loadConfig(customConfig);
    this.analysisProvider = this.createProvider(this.config.analysis, 'analysis');
    this.reasoningProvider = this.createProvider(this.config.reasoning, 'analysis');
    this.codeProvider = this.createProvider(this.config.code, 'code');
  }

  public getConfig(): CentralizedAIConfig {
    return {
      analysis: {
        provider: this.config.analysis.provider,
        apiKey: this.config.analysis.apiKey ? '***PROTECTED***' : '',
        model: this.config.analysis.model,
      },
      reasoning: {
        provider: this.config.reasoning.provider,
        apiKey: this.config.reasoning.apiKey ? '***PROTECTED***' : '',
        model: this.config.reasoning.model,
      },
      code: {
        provider: this.config.code.provider,
        apiKey: this.config.code.apiKey ? '***PROTECTED***' : '',
        model: this.config.code.model,
      },
    };
  }

  private loadConfig(override?: Partial<CentralizedAIConfig>): CentralizedAIConfig {
    const groqAnalysisKey = process.env.GROQ_ANALYSIS_KEY || process.env.ANALYSIS_API_KEY || process.env.GROQ_API_KEY || '';
    const groqReasoningKey = process.env.GROQ_REASONING_KEY || process.env.REASONING_API_KEY || groqAnalysisKey || process.env.GROQ_API_KEY || '';
    const groqCodeKey = process.env.GROQ_CODE_KEY || process.env.CODE_API_KEY || process.env.GROQ_API_KEY || '';

    // Auto-detect active provider if not explicitly configured
    let defaultProvider = process.env.AI_PROVIDER || 'groq';
    if (!process.env.AI_PROVIDER && !groqAnalysisKey && !groqCodeKey && !groqReasoningKey) {
      if (process.env.GEMINI_API_KEY) {
        defaultProvider = 'gemini';
      } else if (process.env.OPENROUTER_API_KEY) {
        defaultProvider = 'openrouter';
      }
    }

    const analysisProvider = override?.analysis?.provider || process.env.AI_ANALYSIS_PROVIDER || defaultProvider;
    const reasoningProvider = override?.reasoning?.provider || process.env.AI_REASONING_PROVIDER || defaultProvider;
    const codeProvider = override?.code?.provider || process.env.AI_CODE_PROVIDER || defaultProvider;

    const getApiKey = (provider: string, groqKey: string) => {
      if (provider === 'gemini') return process.env.GEMINI_API_KEY || '';
      if (provider === 'openrouter') return process.env.OPENROUTER_API_KEY || '';
      return groqKey;
    };

    const getModel = (provider: string, stage: 'analysis' | 'reasoning' | 'code') => {
      if (provider === 'gemini') return process.env.GEMINI_MODEL || 'gemini-2.0-flash';
      if (provider === 'openrouter') return process.env.OPENROUTER_MODEL || 'qwen/qwen-2.5-coder-32b-instruct';
      if (stage === 'analysis') {
        return process.env.GROQ_ANALYSIS_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
      }
      return process.env.GROQ_CODE_MODEL || process.env.GROQ_REASONING_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    };

    return {
      analysis: {
        provider: analysisProvider,
        apiKey: override?.analysis?.apiKey || getApiKey(analysisProvider, groqAnalysisKey),
        model: override?.analysis?.model || getModel(analysisProvider, 'analysis'),
      },
      reasoning: {
        provider: reasoningProvider,
        apiKey: override?.reasoning?.apiKey || getApiKey(reasoningProvider, groqReasoningKey),
        model: override?.reasoning?.model || getModel(reasoningProvider, 'reasoning'),
      },
      code: {
        provider: codeProvider,
        apiKey: override?.code?.apiKey || getApiKey(codeProvider, groqCodeKey),
        model: override?.code?.model || getModel(codeProvider, 'code'),
      },
    };
  }

  private createProvider(wfConfig: WorkflowConfig, workflowName: 'analysis' | 'code'): AIProvider {
    if (process.env.NODE_ENV === 'test' && process.env.USE_MOCK_AI !== 'false') {
      return new MockAIProvider();
    }

    if (wfConfig.provider === 'groq') {
      return new GroqProvider(wfConfig.apiKey, wfConfig.model, workflowName);
    }
    if (wfConfig.provider === 'openrouter') {
      return new OpenRouterProvider(wfConfig.apiKey, wfConfig.model);
    }
    if (wfConfig.provider === 'gemini') {
      return new GeminiProvider(wfConfig.apiKey, wfConfig.model);
    }
    return new MockAIProvider();
  }

  public async analyzeProblem(problem: ProblemInput, overrideApiKey?: string, providerName?: string): Promise<ProblemAnalysis> {
    const provider = (overrideApiKey || providerName)
      ? ProviderFactory.getProvider(providerName || this.config.analysis.provider, overrideApiKey, 'analysis')
      : this.analysisProvider;

    const probId = problem.id || problem.title || 'problem';
    const requestKey = `analysis:${probId}:${this.config.analysis.model}`;

    const fallbacks: Array<() => Promise<ProblemAnalysis>> = [];
    if (process.env.OPENROUTER_API_KEY) {
      fallbacks.push(() => new OpenRouterProvider(process.env.OPENROUTER_API_KEY).analyzeProblem(problem));
    }
    if (process.env.GEMINI_API_KEY) {
      fallbacks.push(() => new GeminiProvider(process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL || 'gemini-2.0-flash').analyzeProblem(problem));
    }

    return this.deduplicateRequest(requestKey, () =>
      this.executeWithFallback(
        () => provider.analyzeProblem(problem),
        fallbacks,
        'analyzeProblem'
      )
    );
  }

  public async generateSolutionPlan(
    problem: ProblemInput,
    isRecoveryAttempt: boolean = false,
    overrideApiKey?: string,
    providerName?: string
  ): Promise<SolutionPlan> {
    const provider = (overrideApiKey || providerName)
      ? ProviderFactory.getProvider(providerName || this.config.reasoning.provider, overrideApiKey, 'analysis')
      : this.reasoningProvider;

    const probId = problem.id || problem.title || 'problem';
    const requestKey = `plan:${probId}:${this.config.reasoning.model}:${isRecoveryAttempt}`;

    const fallbacks: Array<() => Promise<SolutionPlan>> = [];
    if (process.env.OPENROUTER_API_KEY) {
      fallbacks.push(() => new OpenRouterProvider(process.env.OPENROUTER_API_KEY).reasonProblem(problem, isRecoveryAttempt));
    }
    if (process.env.GEMINI_API_KEY) {
      fallbacks.push(() => new GeminiProvider(process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL || 'gemini-2.0-flash').reasonProblem(problem, isRecoveryAttempt));
    }

    return this.deduplicateRequest(requestKey, () =>
      this.executeWithFallback(
        () => provider.reasonProblem(problem, isRecoveryAttempt),
        fallbacks,
        'generateSolutionPlan'
      )
    );
  }

  public async generateCode(
    problem: ProblemInput,
    plan: SolutionPlan,
    targetLanguage: SupportedLanguage,
    rule?: PlatformRule,
    retryInstruction?: string,
    overrideApiKey?: string,
    providerName?: string
  ): Promise<GeneratedCode> {
    const provider = (overrideApiKey || providerName)
      ? ProviderFactory.getProvider(providerName || this.config.code.provider, overrideApiKey, 'code')
      : this.codeProvider;

    const probId = problem.id || problem.title || 'problem';
    const requestKey = `code:${probId}:${targetLanguage}:${this.config.code.model}`;

    const fallbacks: Array<() => Promise<GeneratedCode>> = [];
    if (process.env.OPENROUTER_API_KEY) {
      fallbacks.push(() => new OpenRouterProvider(process.env.OPENROUTER_API_KEY).generateCode(problem, plan, targetLanguage, rule, retryInstruction));
    }
    if (process.env.GEMINI_API_KEY) {
      fallbacks.push(() => new GeminiProvider(process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL || 'gemini-2.0-flash').generateCode(problem, plan, targetLanguage, rule, retryInstruction));
    }

    return this.deduplicateRequest(requestKey, () =>
      this.executeWithFallback(
        () => provider.generateCode(problem, plan, targetLanguage, rule, retryInstruction),
        fallbacks,
        'generateCode'
      )
    );
  }

  private async executeWithFallback<T>(
    primaryFn: () => Promise<T>,
    fallbacks: Array<() => Promise<T>>,
    operationName: string
  ): Promise<T> {
    try {
      return await primaryFn();
    } catch (primaryError) {
      console.warn(
        `[CodePilot][AIProviderRouter] Primary provider failed during ${operationName} (${primaryError instanceof Error ? primaryError.message : primaryError}). Attempting fallback providers...`
      );

      for (let i = 0; i < fallbacks.length; i++) {
        try {
          return await fallbacks[i]();
        } catch (fallbackError) {
          console.error(
            `[CodePilot][AIProviderRouter] Fallback provider ${i + 1} failed during ${operationName}:`,
            fallbackError instanceof Error ? fallbackError.message : fallbackError
          );
        }
      }

      throw primaryError;
    }
  }

  private async deduplicateRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.inFlightRequests.has(key)) {
      console.log(`[CodePilot][AIProviderRouter] Deduplicating in-flight request: ${key}`);
      return this.inFlightRequests.get(key) as Promise<T>;
    }

    const promise = fn().finally(() => {
      this.inFlightRequests.delete(key);
    });

    this.inFlightRequests.set(key, promise);
    return promise;
  }
}

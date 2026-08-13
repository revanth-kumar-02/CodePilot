import { AIProvider } from './ai-provider.js';
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
  code: WorkflowConfig;
}

export class AIProviderRouter {
  private config: CentralizedAIConfig;
  private analysisProvider: AIProvider;
  private codeProvider: AIProvider;
  private inFlightRequests: Map<string, Promise<any>> = new Map();

  constructor(customConfig?: Partial<CentralizedAIConfig>) {
    this.config = this.loadConfig(customConfig);
    this.analysisProvider = this.createProvider(this.config.analysis, 'analysis');
    this.codeProvider = this.createProvider(this.config.code, 'code');
  }

  public getConfig(): CentralizedAIConfig {
    return {
      analysis: {
        provider: this.config.analysis.provider,
        apiKey: this.config.analysis.apiKey ? '***PROTECTED***' : '',
        model: this.config.analysis.model,
      },
      code: {
        provider: this.config.code.provider,
        apiKey: this.config.code.apiKey ? '***PROTECTED***' : '',
        model: this.config.code.model,
      },
    };
  }

  private loadConfig(override?: Partial<CentralizedAIConfig>): CentralizedAIConfig {
    const groqAnalysisKey = process.env.GROQ_ANALYSIS_KEY || process.env.GROQ_API_KEY || '';
    const groqCodeKey = process.env.GROQ_CODE_KEY || process.env.GROQ_API_KEY || '';

    // Auto-detect active provider if not explicitly configured
    let defaultProvider = process.env.AI_PROVIDER || 'groq';
    if (!process.env.AI_PROVIDER && !groqAnalysisKey && !groqCodeKey) {
      if (process.env.GEMINI_API_KEY) {
        defaultProvider = 'gemini';
      } else if (process.env.OPENROUTER_API_KEY) {
        defaultProvider = 'openrouter';
      }
    }

    const analysisProvider = override?.analysis?.provider || process.env.AI_ANALYSIS_PROVIDER || defaultProvider;
    const codeProvider = override?.code?.provider || process.env.AI_CODE_PROVIDER || defaultProvider;

    const getApiKey = (provider: string, groqKey: string) => {
      if (provider === 'gemini') return process.env.GEMINI_API_KEY || '';
      if (provider === 'openrouter') return process.env.OPENROUTER_API_KEY || '';
      return groqKey;
    };

    const getModel = (provider: string, isCode: boolean) => {
      if (provider === 'gemini') return process.env.GEMINI_MODEL || 'gemini-2.0-flash';
      if (provider === 'openrouter') return process.env.OPENROUTER_MODEL || 'qwen/qwen-2.5-coder-32b-instruct';
      return isCode
        ? process.env.GROQ_CODE_MODEL || process.env.GROQ_REASONING_MODEL || 'llama-3.3-70b-versatile'
        : process.env.GROQ_ANALYSIS_MODEL || process.env.GROQ_FAST_MODEL || 'llama-3.1-8b-instant';
    };

    return {
      analysis: {
        provider: analysisProvider,
        apiKey: override?.analysis?.apiKey || getApiKey(analysisProvider, groqAnalysisKey),
        model: override?.analysis?.model || getModel(analysisProvider, false),
      },
      code: {
        provider: codeProvider,
        apiKey: override?.code?.apiKey || getApiKey(codeProvider, groqCodeKey),
        model: override?.code?.model || getModel(codeProvider, true),
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

  public async analyzeProblem(problem: ProblemInput, overrideApiKey?: string): Promise<ProblemAnalysis> {
    const provider = overrideApiKey
      ? new GroqProvider(overrideApiKey, this.config.analysis.model, 'analysis')
      : this.analysisProvider;

    const probId = problem.id || problem.title || 'problem';
    const requestKey = `analysis:${probId}:${this.config.analysis.model}`;

    return this.deduplicateRequest(requestKey, () =>
      this.executeWithFallback(
        () => provider.analyzeProblem(problem),
        () => {
          const gemini = new GeminiProvider(process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL || 'gemini-2.0-flash');
          return gemini.analyzeProblem(problem);
        },
        'analyzeProblem'
      )
    );
  }

  public async generateSolutionPlan(problem: ProblemInput, isRecoveryAttempt: boolean = false, overrideApiKey?: string): Promise<SolutionPlan> {
    const provider = overrideApiKey
      ? new GroqProvider(overrideApiKey, this.config.analysis.model, 'analysis')
      : this.analysisProvider;

    const probId = problem.id || problem.title || 'problem';
    const requestKey = `plan:${probId}:${this.config.analysis.model}:${isRecoveryAttempt}`;

    return this.deduplicateRequest(requestKey, () =>
      this.executeWithFallback(
        () => provider.reasonProblem(problem, isRecoveryAttempt),
        () => {
          const gemini = new GeminiProvider(process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL || 'gemini-2.0-flash');
          return gemini.reasonProblem(problem, isRecoveryAttempt);
        },
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
    overrideApiKey?: string
  ): Promise<GeneratedCode> {
    const provider = overrideApiKey
      ? new GroqProvider(overrideApiKey, this.config.code.model, 'code')
      : this.codeProvider;

    const probId = problem.id || problem.title || 'problem';
    const requestKey = `code:${probId}:${targetLanguage}:${this.config.code.model}`;

    return this.deduplicateRequest(requestKey, () =>
      this.executeWithFallback(
        () => provider.generateCode(problem, plan, targetLanguage, rule, retryInstruction),
        () => {
          const gemini = new GeminiProvider(process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL || 'gemini-2.0-flash');
          return gemini.generateCode(problem, plan, targetLanguage, rule, retryInstruction);
        },
        'generateCode'
      )
    );
  }

  private async executeWithFallback<T>(
    primaryFn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      return await primaryFn();
    } catch (primaryError) {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        console.warn(
          `[CodePilot][AIProviderRouter] Primary provider failed during ${operationName} (${primaryError instanceof Error ? primaryError.message : primaryError}). Falling back to Gemini...`
        );
        try {
          return await fallbackFn();
        } catch (fallbackError) {
          console.error(
            `[CodePilot][AIProviderRouter] Gemini fallback provider also failed during ${operationName}:`,
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

import { AIProvider } from './ai-provider.js';
import { GroqProvider } from './groq-provider.js';
import { OpenRouterProvider } from './openrouter-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { MockAIProvider } from './mock-provider.js';
import { getAIConfig } from './model-config.js';

export class ProviderFactory {
  public static getProvider(
    providerName?: string,
    apiKey?: string,
    workflowName: 'analysis' | 'code' = 'analysis'
  ): AIProvider {
    if (process.env.NODE_ENV === 'test' && process.env.USE_MOCK_AI !== 'false') {
      return new MockAIProvider();
    }

    const config = getAIConfig();
    const effectiveProvider = (providerName || process.env.AI_PROVIDER || config.provider || 'groq').toLowerCase();
    const cleanApiKey = apiKey && apiKey.trim().length > 0 ? apiKey.trim() : undefined;

    switch (effectiveProvider) {
      case 'groq': {
        const hasGroqKey = Boolean(
          cleanApiKey ||
          process.env.GROQ_API_KEY ||
          process.env.GROQ_ANALYSIS_KEY ||
          process.env.GROQ_CODE_KEY
        );
        if (!hasGroqKey) {
          if (process.env.OPENROUTER_API_KEY) {
            return new OpenRouterProvider(process.env.OPENROUTER_API_KEY);
          }
          if (process.env.GEMINI_API_KEY) {
            return new GeminiProvider(process.env.GEMINI_API_KEY);
          }
        }
        return new GroqProvider(cleanApiKey, undefined, workflowName);
      }
      case 'openrouter': {
        const hasOpenRouterKey = Boolean(cleanApiKey || process.env.OPENROUTER_API_KEY);
        if (!hasOpenRouterKey) {
          if (process.env.GROQ_API_KEY || process.env.GROQ_ANALYSIS_KEY) {
            return new GroqProvider(undefined, undefined, workflowName);
          }
          if (process.env.GEMINI_API_KEY) {
            return new GeminiProvider(process.env.GEMINI_API_KEY);
          }
        }
        return new OpenRouterProvider(cleanApiKey);
      }
      case 'openai':
        return new OpenAIProvider(cleanApiKey);
      case 'gemini': {
        const hasGeminiKey = Boolean(cleanApiKey || process.env.GEMINI_API_KEY);
        if (!hasGeminiKey) {
          if (process.env.GROQ_API_KEY || process.env.GROQ_ANALYSIS_KEY) {
            return new GroqProvider(undefined, undefined, workflowName);
          }
          if (process.env.OPENROUTER_API_KEY) {
            return new OpenRouterProvider(process.env.OPENROUTER_API_KEY);
          }
        }
        return new GeminiProvider(cleanApiKey);
      }
      case 'anthropic':
        return new AnthropicProvider(cleanApiKey);
      case 'mock':
        return new MockAIProvider();
      default:
        if (cleanApiKey || process.env.GROQ_API_KEY || process.env.GROQ_ANALYSIS_KEY) {
          return new GroqProvider(cleanApiKey, undefined, workflowName);
        }
        if (process.env.OPENROUTER_API_KEY) {
          return new OpenRouterProvider(process.env.OPENROUTER_API_KEY);
        }
        if (process.env.GEMINI_API_KEY) {
          return new GeminiProvider(process.env.GEMINI_API_KEY);
        }
        return new MockAIProvider();
    }
  }
}

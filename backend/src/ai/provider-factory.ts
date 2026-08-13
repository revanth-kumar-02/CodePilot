import { AIProvider } from './ai-provider.js';
import { GroqProvider } from './groq-provider.js';
import { OpenRouterProvider } from './openrouter-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { MockAIProvider } from './mock-provider.js';
import { getAIConfig } from './model-config.js';

export class ProviderFactory {
  public static getProvider(providerName?: string, apiKey?: string): AIProvider {
    if (process.env.NODE_ENV === 'test' && process.env.USE_MOCK_AI !== 'false') {
      return new MockAIProvider();
    }

    const config = getAIConfig();
    const effectiveProvider = (providerName || process.env.AI_PROVIDER || config.provider || 'groq').toLowerCase();

    switch (effectiveProvider) {
      case 'groq':
        return new GroqProvider(apiKey);
      case 'openrouter':
        return new OpenRouterProvider(apiKey);
      case 'openai':
        return new OpenAIProvider(apiKey);
      case 'gemini':
        return new GeminiProvider(apiKey);
      case 'anthropic':
        return new AnthropicProvider(apiKey);
      case 'mock':
        return new MockAIProvider();
      default:
        // Default fallback to Groq if key present, else OpenRouter
        if (apiKey || process.env.GROQ_API_KEY) {
          return new GroqProvider(apiKey);
        }
        return new OpenRouterProvider(apiKey);
    }
  }
}

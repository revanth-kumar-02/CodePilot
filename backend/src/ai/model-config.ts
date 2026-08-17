import dotenv from 'dotenv';
dotenv.config();

export interface AIConfig {
  provider: 'groq' | 'openrouter' | 'mock';
  groqApiKey: string;
  groqModel: string;
  groqFastModel: string;
  groqReasoningModel: string;
  openRouterApiKey: string;
  model: string;
  siteUrl: string;
  appName: string;
  timeoutMs: number;
}

export function getAIConfig(): AIConfig {
  const provider = (process.env.AI_PROVIDER as 'groq' | 'openrouter' | 'mock') || (process.env.GROQ_API_KEY ? 'groq' : 'openrouter');
  const groqApiKey = process.env.GROQ_API_KEY || '';
  const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  const groqFastModel = process.env.GROQ_FAST_MODEL || 'openai/gpt-oss-120b';
  const groqReasoningModel = process.env.GROQ_REASONING_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  const openRouterApiKey = process.env.OPENROUTER_API_KEY || '';
  const model = process.env.OPENROUTER_MODEL || 'qwen/qwen-2.5-coder-32b-instruct';
  const siteUrl = process.env.OPENROUTER_SITE_URL || 'http://localhost:3000';
  const appName = process.env.OPENROUTER_APP_NAME || 'CodePilot';

  return {
    provider,
    groqApiKey,
    groqModel,
    groqFastModel,
    groqReasoningModel,
    openRouterApiKey,
    model,
    siteUrl,
    appName,
    timeoutMs: 45000,
  };
}

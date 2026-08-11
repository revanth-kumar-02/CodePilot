import { getAIConfig } from '../ai/model-config.js';

export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  uptime: number;
  ai: {
    provider: string;
    configured: boolean;
    modelConfigured: boolean;
  };
}

export class HealthService {
  public getHealthStatus(): HealthResponse {
    const aiConfig = getAIConfig();
    const isConfigured = Boolean(aiConfig.openRouterApiKey && aiConfig.openRouterApiKey.length > 0);

    return {
      status: 'ok',
      service: 'codepilot-backend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      ai: {
        provider: 'openrouter',
        configured: isConfigured,
        modelConfigured: Boolean(aiConfig.model && aiConfig.model.length > 0),
      },
    };
  }
}

export const healthService = new HealthService();

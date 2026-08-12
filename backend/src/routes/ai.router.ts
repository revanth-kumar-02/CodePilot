import { Router, Request, Response } from 'express';
import { AIService } from '../services/ai-service.js';
import { ReasoningService } from '../reasoning/reasoning-service.js';
import { CodeGeneratorService } from '../services/code-generator-service.js';
import { AIError, ProviderFactory } from '../ai/index.js';

const router = Router();
const aiService = new AIService();
const reasoningService = new ReasoningService();
const codeGeneratorService = new CodeGeneratorService();

function resolveRequestProvider(req: Request) {
  const providerHeader = (req.headers['x-ai-provider'] as string) || req.body?.provider;
  const apiKeyHeader = (req.headers['x-ai-api-key'] as string) || req.body?.apiKey;
  if (providerHeader || apiKeyHeader) {
    return ProviderFactory.getProvider(providerHeader, apiKeyHeader);
  }
  return undefined;
}

router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const problemPayload = req.body?.problem || req.body;
    const dynamicProvider = resolveRequestProvider(req);
    const analysis = await aiService.analyzeProblem(problemPayload, dynamicProvider);
    return res.status(200).json({
      status: 'success',
      analysis,
    });
  } catch (error: unknown) {
    if (error instanceof AIError) {
      return res.status(error.statusHttp).json({
        status: 'failed',
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    return res.status(500).json({
      status: 'failed',
      error: {
        code: 'AI_UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'An unexpected server error occurred.',
      },
    });
  }
});

router.post('/reason', async (req: Request, res: Response) => {
  try {
    const problemPayload = req.body?.problem || req.body;
    const dynamicProvider = resolveRequestProvider(req);
    const { plan, validation, reasoningDurationMs } = await reasoningService.reasonProblem(problemPayload, dynamicProvider);
    return res.status(200).json({
      status: 'success',
      plan,
      validation,
      durationMs: reasoningDurationMs,
    });
  } catch (error: unknown) {
    if (error instanceof AIError) {
      return res.status(error.statusHttp).json({
        status: 'failed',
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    return res.status(500).json({
      status: 'failed',
      error: {
        code: 'AI_UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'An unexpected server error occurred.',
      },
    });
  }
});

router.post('/generate-code', async (req: Request, res: Response) => {
  try {
    const problemPayload = req.body?.problem;
    const planPayload = req.body?.plan;
    const targetLanguage = req.body?.targetLanguage;
    const targetVersion = req.body?.targetVersion;
    const dynamicProvider = resolveRequestProvider(req);

    const { generatedCode, durationMs } = await codeGeneratorService.generateCode(
      problemPayload,
      planPayload,
      targetLanguage,
      targetVersion,
      dynamicProvider
    );

    return res.status(200).json({
      status: 'success',
      generatedCode,
      durationMs,
    });
  } catch (error: unknown) {
    if (error instanceof AIError) {
      return res.status(error.statusHttp).json({
        status: 'failed',
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    return res.status(500).json({
      status: 'failed',
      error: {
        code: 'AI_UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'An unexpected server error occurred.',
      },
    });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { AIService } from '../services/ai-service.js';
import { ReasoningService } from '../reasoning/reasoning-service.js';
import { CodeGeneratorService } from '../services/code-generator-service.js';
import { CodeRepairService } from '../services/code-repair-service.js';
import { AIError, ProviderFactory } from '../ai/index.js';

const router = Router();
const aiService = new AIService();
const reasoningService = new ReasoningService();
const codeGeneratorService = new CodeGeneratorService();
const codeRepairService = new CodeRepairService();

function resolveApiKey(req: Request, keyType: 'analysis' | 'reasoning' | 'code'): string | undefined {
  const getClean = (val: any): string | undefined => {
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
    return undefined;
  };

  const analysisHeader = getClean(req.headers['x-ai-analysis-key']);
  const reasoningHeader = getClean(req.headers['x-ai-reasoning-key']);
  const codeHeader = getClean(req.headers['x-ai-code-key']);
  const mainHeader = getClean(req.headers['x-ai-api-key']);
  const bodyKey = getClean(req.body?.apiKey);

  if (keyType === 'analysis') {
    return analysisHeader || reasoningHeader || codeHeader || mainHeader || getClean(req.body?.analysisApiKey) || bodyKey;
  } else if (keyType === 'reasoning') {
    return reasoningHeader || analysisHeader || codeHeader || mainHeader || getClean(req.body?.reasoningApiKey) || bodyKey;
  } else {
    return codeHeader || analysisHeader || reasoningHeader || mainHeader || getClean(req.body?.codeApiKey) || bodyKey;
  }
}

function resolveProvider(req: Request): string | undefined {
  const getClean = (val: any): string | undefined => {
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim().toLowerCase();
    }
    return undefined;
  };
  return getClean(req.headers['x-ai-provider']) || getClean(req.body?.aiProvider) || getClean(req.body?.provider);
}

router.post('/solve-pipeline', async (req: Request, res: Response) => {
  try {
    const problemPayload = req.body?.problem || req.body;
    const targetLanguage = req.body?.targetLanguage || 'cpp';
    const targetVersion = req.body?.targetVersion;

    const analysisKey = resolveApiKey(req, 'analysis');
    const reasoningKey = resolveApiKey(req, 'reasoning');
    const codeKey = resolveApiKey(req, 'code');
    const providerName = resolveProvider(req);

    // Agent 1: Analysis Agent
    const analysis = await aiService.analyzeProblem(problemPayload, analysisKey, providerName);

    // Agent 2: Solution Reasoning Agent
    const { plan, validation } = await reasoningService.reasonProblem(problemPayload, reasoningKey, providerName);

    // Agent 3: Code Generation Agent
    const { generatedCode, durationMs } = await codeGeneratorService.generateCode(
      problemPayload,
      plan,
      targetLanguage,
      targetVersion,
      codeKey,
      providerName
    );

    return res.status(200).json({
      status: 'success',
      pipeline: {
        analysis,
        plan,
        validation,
        generatedCode,
        durationMs,
      },
    });
  } catch (error: unknown) {
    if (error instanceof AIError) {
      return res.status(error.statusHttp).json({
        status: 'failed',
        error: {
          code: error.code,
          message: error.code === 'AI_RATE_LIMITED'
            ? 'API key limit reached. Please switch keys or wait for rate limit reset.'
            : error.message,
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

router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const problemPayload = req.body?.problem || req.body;
    const apiKey = resolveApiKey(req, 'analysis');
    const providerName = resolveProvider(req);
    const analysis = await aiService.analyzeProblem(problemPayload, apiKey, providerName);
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
          message: error.code === 'AI_RATE_LIMITED'
            ? 'Agent 1 (Analysis) API key limit reached. Please switch keys or wait for rate limit reset.'
            : error.message,
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
    const apiKey = resolveApiKey(req, 'reasoning');
    const providerName = resolveProvider(req);
    const { plan, validation, reasoningDurationMs } = await reasoningService.reasonProblem(problemPayload, apiKey, providerName);
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
    const apiKey = resolveApiKey(req, 'code');
    const providerName = resolveProvider(req);

    const { generatedCode, durationMs } = await codeGeneratorService.generateCode(
      problemPayload,
      planPayload,
      targetLanguage,
      targetVersion,
      apiKey,
      providerName
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

router.post('/analyze-error', async (req: Request, res: Response) => {
  try {
    const { problem, currentCode, errorMessage, testOutput, plan, analysis, platform, language, version } = req.body;
    const apiKey = resolveApiKey(req, 'analysis');
    const providerName = resolveProvider(req);
    const overrideProvider = (apiKey || providerName) ? ProviderFactory.getProvider(providerName, apiKey, 'analysis') : undefined;

    const result = await codeRepairService.analyzeError(
      problem,
      currentCode,
      errorMessage,
      testOutput,
      overrideProvider,
      plan,
      analysis,
      platform,
      language,
      version
    );

    return res.status(200).json({
      status: 'success',
      analysis: result,
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

router.post('/repair-code', async (req: Request, res: Response) => {
  try {
    const { problem, plan, analysis, currentCode, language, errorMessage, testOutput, classification, platform, version } = req.body;
    const apiKey = resolveApiKey(req, 'code');
    const providerName = resolveProvider(req);
    const overrideProvider = (apiKey || providerName) ? ProviderFactory.getProvider(providerName, apiKey, 'code') : undefined;

    const result = await codeRepairService.generateRepair(
      problem,
      plan,
      analysis,
      currentCode,
      language,
      errorMessage,
      testOutput,
      classification,
      platform,
      version,
      overrideProvider
    );

    return res.status(200).json({
      status: 'success',
      repairedCode: result.repairedCode,
      durationMs: result.durationMs,
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

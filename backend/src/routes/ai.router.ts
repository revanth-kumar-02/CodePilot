import { Router, Request, Response } from 'express';
import { AIService } from '../services/ai-service.js';
import { ReasoningService } from '../reasoning/reasoning-service.js';
import { CodeGeneratorService } from '../services/code-generator-service.js';
import { CodeRepairService } from '../services/code-repair-service.js';
import { AIError } from '../ai/index.js';

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

  if (keyType === 'analysis') {
    return getClean(req.headers['x-ai-analysis-key']) || getClean(req.headers['x-ai-api-key']) || getClean(req.body?.analysisApiKey) || getClean(req.body?.apiKey);
  } else if (keyType === 'reasoning') {
    return getClean(req.headers['x-ai-reasoning-key']) || getClean(req.headers['x-ai-analysis-key']) || getClean(req.headers['x-ai-api-key']) || getClean(req.body?.reasoningApiKey) || getClean(req.body?.apiKey);
  } else {
    return getClean(req.headers['x-ai-code-key']) || getClean(req.headers['x-ai-api-key']) || getClean(req.body?.codeApiKey) || getClean(req.body?.apiKey);
  }
}

router.post('/solve-pipeline', async (req: Request, res: Response) => {
  try {
    const problemPayload = req.body?.problem || req.body;
    const targetLanguage = req.body?.targetLanguage || 'cpp';
    const targetVersion = req.body?.targetVersion;

    const analysisKey = resolveApiKey(req, 'analysis');
    const reasoningKey = resolveApiKey(req, 'reasoning');
    const codeKey = resolveApiKey(req, 'code');

    // Agent 1: Analysis Agent
    const analysis = await aiService.analyzeProblem(problemPayload, analysisKey);

    // Agent 2: Solution Reasoning Agent
    const { plan, validation } = await reasoningService.reasonProblem(problemPayload, reasoningKey);

    // Agent 3: Code Generation Agent
    const { generatedCode, durationMs } = await codeGeneratorService.generateCode(
      problemPayload,
      plan,
      targetLanguage,
      targetVersion,
      codeKey
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
    const analysis = await aiService.analyzeProblem(problemPayload, apiKey);
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
    const { plan, validation, reasoningDurationMs } = await reasoningService.reasonProblem(problemPayload, apiKey);
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

    const { generatedCode, durationMs } = await codeGeneratorService.generateCode(
      problemPayload,
      planPayload,
      targetLanguage,
      targetVersion,
      apiKey
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
    const { problem, currentCode, errorMessage, testOutput } = req.body;
    const apiKey = resolveApiKey(req, 'analysis');

    const result = await codeRepairService.analyzeError(
      problem,
      currentCode,
      errorMessage,
      testOutput,
      undefined
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
    const { problem, plan, currentCode, language, errorMessage, testOutput, classification } = req.body;
    const apiKey = resolveApiKey(req, 'code');

    const result = await codeRepairService.generateRepair(
      problem,
      plan,
      currentCode,
      language,
      errorMessage,
      testOutput,
      classification,
      undefined
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

import { Router, Request, Response } from 'express';
import { AIService } from '../services/ai-service.js';
import { ReasoningService } from '../reasoning/reasoning-service.js';
import { CodeGeneratorService } from '../services/code-generator-service.js';
import { AIError } from '../ai/index.js';

const router = Router();
const aiService = new AIService();
const reasoningService = new ReasoningService();
const codeGeneratorService = new CodeGeneratorService();

router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const problemPayload = req.body?.problem || req.body;
    const analysis = await aiService.analyzeProblem(problemPayload);
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
    const { plan, validation, reasoningDurationMs } = await reasoningService.reasonProblem(problemPayload);
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

    const { generatedCode, durationMs } = await codeGeneratorService.generateCode(
      problemPayload,
      planPayload,
      targetLanguage
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

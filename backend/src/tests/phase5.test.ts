import assert from 'node:assert';
import { test, describe, beforeEach } from 'node:test';
import { ReasoningService } from '../reasoning/reasoning-service.js';
import { MockAIProvider } from '../ai/mock-provider.js';
import { ReasoningPromptBuilder } from '../reasoning/reasoning-prompt-builder.js';
import { ConsistencyChecker } from '../reasoning/consistency-checker.js';
import { ReasoningValidator } from '../reasoning/reasoning-validator.js';
import { AIError, ProblemInput } from '../ai/index.js';
import { createApp } from '../server.js';
import http from 'node:http';

const sampleProblem: ProblemInput = {
  id: 'prob-p5-test',
  title: 'Find Maximum Element',
  statement: 'Given an array of N integers, return the maximum element in the array.',
  inputFormat: 'Integer N followed by N integers',
  outputFormat: 'Single maximum integer',
  constraints: '1 <= N <= 10^5',
  examples: [
    { input: '5\n1 5 3 9 2', output: '9', explanation: '9 is the largest element' },
  ],
  notes: null,
  language: 'c++',
  source: {
    url: 'https://example.com/prob1',
    hostname: 'example.com',
    platform: null,
    detectedAt: Date.now(),
  },
  metadata: {
    extractedAt: Date.now(),
    extractionMethod: 'universal-heuristic-extractor',
    confidence: 0.95,
    characterCount: 250,
  },
};

describe('Phase 5: Coding Reasoning & Solution Planning Engine Tests', () => {
  describe('1. PromptBuilder & Prompt Safety Isolation', () => {
    test('System prompt includes strict no-code rules and JSON output schema requirements', () => {
      const sysPrompt = ReasoningPromptBuilder.buildSystemPrompt();
      assert.ok(sysPrompt.includes('You must NOT generate or include source code'));
      assert.ok(sysPrompt.includes('Output ONLY a single raw valid JSON object'));
      assert.ok(sysPrompt.includes('"status": "ready"'));
    });

    test('User prompt isolates problem data in XML tags', () => {
      const userPrompt = ReasoningPromptBuilder.buildUserPrompt(sampleProblem);
      assert.ok(userPrompt.includes('<PROBLEM_DATA>'));
      assert.ok(userPrompt.includes('<TITLE>Find Maximum Element</TITLE>'));
      assert.ok(userPrompt.includes('<CONSTRAINTS>\n1 <= N <= 10^5\n</CONSTRAINTS>'));
    });
  });

  describe('2. ReasoningService & Solution Plan Generation', () => {
    const reasoningService = new ReasoningService(new MockAIProvider());

    test('Generates a valid structured solution plan for valid problem', async () => {
      const result = await reasoningService.reasonProblem(sampleProblem);

      assert.ok(result.plan);
      assert.strictEqual(result.plan.status, 'ready');
      assert.ok(result.plan.problemUnderstanding);
      assert.ok(result.plan.algorithm.name);
      assert.ok(result.plan.algorithm.category);
      assert.ok(result.plan.algorithm.steps.length > 0);
      assert.strictEqual(result.plan.complexity.time, 'O(N)');
      assert.strictEqual(result.plan.complexity.space, 'O(1)');
      assert.strictEqual(result.validation.valid, true);

      // Verify strict no-code guarantee
      assert.strictEqual((result.plan as unknown as Record<string, unknown>).code, undefined);
      assert.strictEqual((result.plan as unknown as Record<string, unknown>).solutionCode, undefined);
    });

    test('Rejects invalid problem payload with 400 validation error', async () => {
      await assert.rejects(async () => {
        await reasoningService.reasonProblem({ title: '' });
      }, (err: unknown) => err instanceof AIError && err.code === 'AI_VALIDATION_ERROR');
    });

    test('Rejects oversized problem payloads with 400 error', async () => {
      const hugeProblem = {
        ...sampleProblem,
        statement: 'A'.repeat(30000),
      };
      await assert.rejects(async () => {
        await reasoningService.reasonProblem(hugeProblem);
      }, (err: unknown) => err instanceof AIError && err.code === 'AI_REQUEST_TOO_LARGE');
    });
  });

  describe('3. Multi-pass Consistency & Contradiction Checker', () => {
    const reasoningService = new ReasoningService(new MockAIProvider());

    test('Detects algorithm vs complexity mismatch and marks validation as invalid', async () => {
      const inconsistentProblem = {
        ...sampleProblem,
        statement: 'Find maximum element trigger_inconsistent_complexity',
      };
      const result = await reasoningService.reasonProblem(inconsistentProblem);
      assert.strictEqual(result.validation.valid, false);
      assert.ok(result.validation.issues.some((i) => i.field === 'complexity.time'));
    });

    test('Detects explicit contradiction and sets status to needs-clarification', async () => {
      const contradictoryProblem = {
        ...sampleProblem,
        statement: 'Find maximum element trigger_contradiction',
      };
      const result = await reasoningService.reasonProblem(contradictoryProblem);
      assert.strictEqual(result.plan.status, 'needs-clarification');
      assert.strictEqual(result.validation.valid, false);
    });

    test('Detects insufficient problem information and sets status to needs-clarification', async () => {
      const incompleteProblem = {
        ...sampleProblem,
        statement: 'Problem trigger_insufficient',
      };
      const result = await reasoningService.reasonProblem(incompleteProblem);
      assert.strictEqual(result.plan.status, 'needs-clarification');
    });

    test('Flags brute force algorithm when N = 10^5', async () => {
      const bruteForceProblem = {
        ...sampleProblem,
        statement: 'Check all pairs trigger_brute_force_large',
      };
      const result = await reasoningService.reasonProblem(bruteForceProblem);
      assert.strictEqual(result.validation.valid, false);
      assert.ok(result.validation.issues.some((i) => i.field === 'algorithm'));
    });
  });

  describe('4. ReasoningValidator JSON Parsing & Cleaning', () => {
    test('Strips markdown code fences from JSON output', () => {
      const rawText = '```json\n{"status":"ready","problemUnderstanding":"Test","keyInsights":[],"constraintsAnalysis":{"constraints":[],"inputScale":"N","requiredComplexity":"O(N)","numericRange":null,"dataStructureImplications":[],"risks":[]},"algorithm":{"name":"TestAlg","category":"other","description":"desc","steps":["step1"],"alternatives":[],"selectedBecause":"why"},"correctnessReasoning":{"invariant":null,"argument":"arg","keyCases":[],"conclusion":"conc"},"complexity":{"time":"O(N)","space":"O(1)","explanation":"exp"},"edgeCases":[],"implementationRequirements":[],"assumptions":[],"confidence":0.9}\n```';

      const { plan } = ReasoningValidator.parseAndValidate(rawText, sampleProblem, 'mock-provider', 'mock-model');
      assert.strictEqual(plan.status, 'ready');
      assert.strictEqual(plan.algorithm.name, 'TestAlg');
    });
  });

  describe('5. AI Provider Error Handling', () => {
    const reasoningService = new ReasoningService(new MockAIProvider());

    test('Handles AI provider timeout with AI_TIMEOUT (504)', async () => {
      const problem = { ...sampleProblem, statement: 'trigger_timeout' };
      await assert.rejects(async () => {
        await reasoningService.reasonProblem(problem);
      }, (err: unknown) => err instanceof AIError && err.code === 'AI_TIMEOUT' && err.statusHttp === 504);
    });

    test('Handles AI rate limiting with AI_RATE_LIMITED (429)', async () => {
      const problem = { ...sampleProblem, statement: 'trigger_rate_limit' };
      await assert.rejects(async () => {
        await reasoningService.reasonProblem(problem);
      }, (err: unknown) => err instanceof AIError && err.code === 'AI_RATE_LIMITED' && err.statusHttp === 429);
    });

    test('Handles AI upstream error with AI_UPSTREAM_ERROR (502)', async () => {
      const problem = { ...sampleProblem, statement: 'trigger_upstream_error' };
      await assert.rejects(async () => {
        await reasoningService.reasonProblem(problem);
      }, (err: unknown) => err instanceof AIError && err.code === 'AI_UPSTREAM_ERROR' && err.statusHttp === 502);
    });

    test('Handles malformed JSON from AI with AI_RESPONSE_NOT_JSON or AI_INVALID_RESPONSE (502)', async () => {
      const problem = { ...sampleProblem, statement: 'trigger_invalid_json' };
      await assert.rejects(async () => {
        await reasoningService.reasonProblem(problem);
      }, (err: unknown) => err instanceof AIError && (err.code === 'AI_RESPONSE_NOT_JSON' || err.code === 'AI_INVALID_RESPONSE') && err.statusHttp === 502);
    });
  });

  describe('6. Express Backend Routes API Tests: POST /api/ai/reason', () => {
    test('POST /api/ai/reason returns 200 with solution plan and validation telemetry', async () => {
      const app = createApp();
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      try {
        const response = await fetch(`http://localhost:${port}/api/ai/reason`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-AI-Provider': 'mock' },
          body: JSON.stringify({ problem: sampleProblem }),
        });

        assert.strictEqual(response.status, 200);
        const data = (await response.json()) as { status: string; plan?: unknown; validation?: unknown; durationMs?: number };
        assert.strictEqual(data.status, 'success');
        assert.ok(data.plan);
        assert.ok(data.validation);
        assert.ok(typeof data.durationMs === 'number');
      } finally {
        server.close();
      }
    });

    test('POST /api/ai/reason returns 400 when problem payload is invalid', async () => {
      const app = createApp();
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      try {
        const response = await fetch(`http://localhost:${port}/api/ai/reason`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ problem: { title: '' } }),
        });

        assert.strictEqual(response.status, 400);
        const data = (await response.json()) as { status: string; error?: { code: string } };
        assert.strictEqual(data.status, 'failed');
        assert.strictEqual(data.error?.code, 'AI_VALIDATION_ERROR');
      } finally {
        server.close();
      }
    });
  });
});

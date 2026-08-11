import assert from 'node:assert';
import { test, describe } from 'node:test';
import { ReasoningService } from '../reasoning/reasoning-service.js';
import { MockAIProvider } from '../ai/mock-provider.js';
import { ProblemInput } from '../ai/schemas.js';
import { AIError } from '../ai/ai-provider.js';

const mockProblem: ProblemInput = {
  id: 'test-prob-1',
  title: 'Spiral Matrix',
  statement: 'Given an m x n matrix, return all elements of the matrix in spiral order.',
  inputFormat: 'm x n matrix',
  outputFormat: 'Array in spiral order',
  constraints: '1 <= m, n <= 10',
  examples: [{ input: '[[1,2,3],[4,5,6],[7,8,9]]', output: '[1,2,3,6,9,8,7,4,5]', explanation: 'Spiral order' }],
  notes: null,
  language: 'cpp',
  source: { url: 'https://leetcode.com/problems/spiral-matrix/', hostname: 'leetcode.com', platform: 'leetcode', detectedAt: Date.now() },
  metadata: { extractedAt: Date.now(), extractionMethod: 'heuristic', confidence: 0.95, characterCount: 150 },
};

describe('ReasoningService Controlled Retry & Deduplication', () => {
  test('1. Valid reasoning request -> SUCCESS (1 attempt)', async () => {
    const service = new ReasoningService(new MockAIProvider());
    const res = await service.reasonProblem(mockProblem);
    assert.strictEqual(res.plan.status, 'ready');
    assert.strictEqual(res.attemptsUsed, 1);
    assert.strictEqual(res.validation.valid, true);
  });

  test('2. Truncated JSON on attempt 1, recovery succeeds on attempt 2 -> SUCCESS (2 attempts)', async () => {
    const service = new ReasoningService(new MockAIProvider());
    const probWithRetry: ProblemInput = {
      ...mockProblem,
      statement: 'Spiral matrix problem trigger_retry_success',
    };
    const res = await service.reasonProblem(probWithRetry);
    assert.strictEqual(res.plan.status, 'ready');
    assert.strictEqual(res.attemptsUsed, 2);
  });

  test('3. Retries fail twice -> FAILED after 2 attempts', async () => {
    const service = new ReasoningService(new MockAIProvider());
    const probWithFailure: ProblemInput = {
      ...mockProblem,
      statement: 'Spiral matrix problem trigger_retry_failure',
    };
    await assert.rejects(async () => {
      await service.reasonProblem(probWithFailure);
    }, (err: unknown) => err instanceof AIError);
  });

  test('4. Permanent error (401 invalid key) -> Fails immediately on attempt 1 without retrying', async () => {
    const service = new ReasoningService(new MockAIProvider());
    const probWithPermanent: ProblemInput = {
      ...mockProblem,
      statement: 'Spiral matrix problem trigger_permanent_error',
    };
    await assert.rejects(async () => {
      await service.reasonProblem(probWithPermanent);
    }, (err: unknown) => err instanceof AIError && err.code === 'AI_AUTHENTICATION_ERROR' && err.retryable === false);
  });

  test('5. Manual Spiral Matrix reasoning evaluation -> Valid boundary traversal plan', async () => {
    const service = new ReasoningService(new MockAIProvider());
    const res = await service.reasonProblem(mockProblem);
    assert.ok(res.plan.algorithm.name);
    assert.strictEqual(res.plan.complexity.time, 'O(N)');
    assert.strictEqual(res.plan.complexity.space, 'O(N)');
    assert.ok(res.plan.correctnessReasoning.argument);
  });
});

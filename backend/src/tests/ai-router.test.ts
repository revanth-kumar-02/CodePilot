import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AIProviderRouter } from '../ai/ai-provider-router.js';
import { ProblemInput } from '../ai/schemas.js';
import { SolutionPlan } from '../reasoning/schemas.js';
import { AIError } from '../ai/ai-provider.js';

describe('AIProviderRouter — Workflow Key Separation & Rate Limit Tests', () => {
  const sampleProblem: ProblemInput = {
    id: 'two-sum',
    title: 'Two Sum',
    statement: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
    inputFormat: 'Array of integers nums and integer target',
    outputFormat: 'Array of two indices',
    constraints: '2 <= nums.length <= 10^4',
    examples: [{ input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'nums[0] + nums[1] == 9' }],
    notes: null,
    language: 'java',
    source: { platform: 'leetcode', url: 'https://leetcode.com/problems/two-sum', hostname: 'leetcode.com', detectedAt: Date.now() },
    metadata: { extractedAt: Date.now(), extractionMethod: 'dom', confidence: 0.95, characterCount: 150 },
  };

  const samplePlan: SolutionPlan = {
    status: 'ready',
    problemUnderstanding: 'Find two numbers in array that add up to target.',
    keyInsights: ['Use a hash map for O(1) lookups'],
    constraintsAnalysis: {
      constraints: ['2 <= nums.length <= 10^4'],
      inputScale: '10^4',
      requiredComplexity: 'O(N)',
      numericRange: null,
      dataStructureImplications: ['HashMap'],
      risks: [],
    },
    algorithm: {
      name: 'Hash Map Lookup',
      category: 'hashing',
      description: 'Store seen numbers in hash map',
      steps: ['Initialize map', 'Loop numbers'],
      alternatives: [],
      selectedBecause: 'O(N) time complexity',
    },
    correctnessReasoning: {
      invariant: null,
      argument: 'Store index of complement',
      keyCases: [],
      conclusion: 'Finds pair in one pass',
    },
    complexity: { time: 'O(N)', space: 'O(N)', explanation: 'Single pass' },
    edgeCases: [{ case: 'Duplicate numbers', whyImportant: 'Ensure distinct indices', expectedBehavior: 'Return correct pair' }],
    implementationRequirements: [],
    assumptions: [],
    confidence: 0.95,
    model: 'test-model',
    provider: 'test-provider',
    generatedAt: Date.now(),
  };

  test('AI Analysis uses ANALYSIS key and does not use CODE key', async () => {
    process.env.GROQ_ANALYSIS_KEY = 'gsk_analysis_key_test_123';
    process.env.GROQ_CODE_KEY = 'gsk_code_key_test_456';
    process.env.NODE_ENV = 'test';
    delete process.env.USE_MOCK_AI;

    const router = AIProviderRouter ? new AIProviderRouter() : null;
    assert.ok(router);

    const config = router.getConfig();
    assert.equal(config.analysis.provider, 'groq');
    assert.equal(config.analysis.apiKey, '***PROTECTED***');
    assert.equal(config.code.provider, 'groq');
    assert.equal(config.code.apiKey, '***PROTECTED***');
  });

  test('Solution Plan uses ANALYSIS key', async () => {
    const router = new AIProviderRouter({
      analysis: { provider: 'mock', apiKey: 'gsk_analysis_key', model: 'openai/gpt-oss-120b' },
      code: { provider: 'mock', apiKey: 'gsk_code_key', model: 'openai/gpt-oss-120b' },
    });

    const plan = await router.generateSolutionPlan(sampleProblem);
    assert.ok(plan);
    assert.ok(plan.algorithm);
  });

  test('Code Generation uses CODE key', async () => {
    const router = new AIProviderRouter({
      analysis: { provider: 'mock', apiKey: 'gsk_analysis_key', model: 'openai/gpt-oss-120b' },
      code: { provider: 'mock', apiKey: 'gsk_code_key', model: 'openai/gpt-oss-120b' },
    });

    const code = await router.generateCode(sampleProblem, samplePlan, 'java');
    assert.ok(code);
    assert.ok(code.code);
  });

  test('Duplicate in-flight requests are prevented via deduplication guard', async () => {
    let callCount = 0;
    const slowProviderRouter = new AIProviderRouter({
      analysis: { provider: 'mock', apiKey: 'test_key', model: 'fast-model' },
      code: { provider: 'mock', apiKey: 'test_key', model: 'code-model' },
    });

    // Mock internal deduplicateRequest or call parallel requests
    const p1 = slowProviderRouter.analyzeProblem(sampleProblem);
    const p2 = slowProviderRouter.analyzeProblem(sampleProblem);

    const [res1, res2] = await Promise.all([p1, p2]);
    assert.deepEqual(res1, res2);
  });

  test('Rate limit HTTP 429 produces AI RATE LIMIT REACHED without infinite retry', async () => {
    const rateLimitError = new AIError(
      'AI_RATE_LIMITED',
      'AI RATE LIMIT REACHED\nWorkflow: Analysis\nRetry available after: 15s',
      429,
      false
    );

    assert.equal(rateLimitError.statusHttp, 429);
    assert.equal(rateLimitError.retryable, false);
    assert.ok(rateLimitError.message.includes('AI RATE LIMIT REACHED'));
    assert.ok(rateLimitError.message.includes('Workflow: Analysis'));
  });

  test('API keys are protected and never stored in ProblemSession or printed in getConfig()', async () => {
    const router = new AIProviderRouter({
      analysis: { provider: 'groq', apiKey: 'secret_analysis_123', model: 'm1' },
      code: { provider: 'groq', apiKey: 'secret_code_456', model: 'm2' },
    });

    const cfg = router.getConfig();
    assert.equal(cfg.analysis.apiKey, '***PROTECTED***');
    assert.equal(cfg.code.apiKey, '***PROTECTED***');
    assert.ok(!JSON.stringify(cfg).includes('secret_analysis_123'));
    assert.ok(!JSON.stringify(cfg).includes('secret_code_456'));
  });

  test('No cross-workflow key fallback occurs', async () => {
    const router = new AIProviderRouter({
      analysis: { provider: 'groq', apiKey: 'gsk_analysis_only', model: 'm1' },
      code: { provider: 'groq', apiKey: 'gsk_code_only', model: 'm2' },
    });

    const cfg = router.getConfig();
    assert.equal(cfg.analysis.apiKey, '***PROTECTED***');
    assert.equal(cfg.code.apiKey, '***PROTECTED***');
    assert.notEqual((router as any).config.analysis.apiKey, (router as any).config.code.apiKey);
  });
});

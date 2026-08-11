import assert from 'node:assert';
import { test, describe, beforeEach } from 'node:test';
import http from 'node:http';
import { CodePromptBuilder } from '../services/code-prompt-builder.js';
import { CodeValidator } from '../services/code-validator.js';
import { CodeGeneratorService } from '../services/code-generator-service.js';
import { MockAIProvider } from '../ai/mock-provider.js';
import { ProblemInput } from '../ai/schemas.js';
import { SolutionPlan } from '../reasoning/schemas.js';
import { createApp } from '../server.js';

describe('Phase 6: Code Generation & Safe Editor Automation Engine Tests', () => {
  const sampleProblem: ProblemInput = {
    id: 'prob-p6-01',
    title: 'Find Maximum Element',
    statement: 'Given an array of N integers, return the maximum element in the array.',
    inputFormat: 'First line integer N, second line N space-separated integers.',
    outputFormat: 'Single integer max value.',
    constraints: '1 <= N <= 10^5',
    examples: [{ input: '3\n1 5 3', output: '5', explanation: '5 is the largest element.' }],
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

  const samplePlan: SolutionPlan = {
    status: 'ready',
    problemUnderstanding: 'Iterate once through N elements keeping track of maximum element.',
    keyInsights: ['Single linear pass O(N) time with O(1) space.'],
    constraintsAnalysis: {
      constraints: ['1 <= N <= 10^5'],
      inputScale: 'Up to N = 10^5',
      requiredComplexity: 'O(N)',
      numericRange: null,
      dataStructureImplications: [],
      risks: [],
    },
    algorithm: {
      name: 'Single-Pass Max Scan',
      category: 'other',
      description: 'Linear scan to track maximum value.',
      steps: ['Set maxTracker = arr[0]', 'Iterate arr[1...N-1]', 'If arr[i] > maxTracker, maxTracker = arr[i]', 'Return maxTracker'],
      alternatives: [],
      selectedBecause: 'Optimal time and space.',
    },
    correctnessReasoning: {
      invariant: 'maxTracker is max of arr[0...i]',
      argument: 'Inductive step preserves invariant.',
      keyCases: ['Single element'],
      conclusion: 'Complete.',
    },
    complexity: {
      time: 'O(N)',
      space: 'O(1)',
      explanation: 'Linear scan.',
    },
    edgeCases: [{ case: 'N=1', whyImportant: 'Base case', expectedBehavior: 'Return element' }],
    implementationRequirements: [{ requirement: 'Use 64-bit int', priority: 'required', reason: 'Large input' }],
    assumptions: [],
    confidence: 0.95,
    model: 'mock-qwen-model',
    provider: 'mock-provider',
    generatedAt: Date.now(),
  };

  describe('1. CodePromptBuilder', () => {
    test('System prompt enforces complete code and no placeholders', () => {
      const systemPrompt = CodePromptBuilder.buildSystemPrompt('cpp');
      assert.ok(systemPrompt.includes('CPP'));
      assert.ok(systemPrompt.includes('NO dummy placeholders'));
      assert.ok(systemPrompt.includes('TODO'));
    });

    test('User prompt isolates problem and plan data inside XML tags', () => {
      const userPrompt = CodePromptBuilder.buildUserPrompt(sampleProblem, samplePlan, 'cpp');
      assert.ok(userPrompt.includes('<PROBLEM_DATA>'));
      assert.ok(userPrompt.includes('<SOLUTION_PLAN>'));
      assert.ok(userPrompt.includes('<TITLE>Find Maximum Element</TITLE>'));
      assert.ok(userPrompt.includes('<ALGORITHM_NAME>Single-Pass Max Scan</ALGORITHM_NAME>'));
    });
  });

  describe('2. CodeValidator', () => {
    test('Strips markdown code fences cleanly', () => {
      const rawCpp = '```cpp\n#include <iostream>\nint main() { return 0; }\n```';
      const stripped = CodeValidator.stripFences(rawCpp);
      assert.strictEqual(stripped, '#include <iostream>\nint main() { return 0; }');
    });

    test('Detects incomplete placeholder comments', () => {
      const codeWithTodo = '#include <iostream>\n// TODO: write main logic here\nint main() {}';
      const completeness = CodeValidator.checkCompleteness(codeWithTodo);
      assert.strictEqual(completeness.complete, false);
      assert.ok(completeness.issues[0].includes('incomplete placeholder'));
    });

    test('Validates language structural markers', () => {
      const validCpp = '#include <vector>\nint main() { return 0; }';
      const invalidCpp = 'print("hello world")';

      assert.strictEqual(CodeValidator.validateStructure(validCpp, 'cpp').valid, true);
      assert.strictEqual(CodeValidator.validateStructure(invalidCpp, 'cpp').valid, false);
    });

    test('Validates comment detection across Java, C++, C, Python, JavaScript, and TypeScript', () => {
      assert.strictEqual(CodeValidator.checkForComments('class Sol { // comment \n }', 'java'), true);
      assert.strictEqual(CodeValidator.checkForComments('/* block */ int x = 0;', 'cpp'), true);
      assert.strictEqual(CodeValidator.checkForComments('int x = 0; // line comment', 'c'), true);
      assert.strictEqual(CodeValidator.checkForComments('# Python comment\nx = 10', 'python'), true);
      assert.strictEqual(CodeValidator.checkForComments('"""Docstring"""\ndef foo(): pass', 'python'), true);
      assert.strictEqual(CodeValidator.checkForComments('const x = 1; // js comment', 'javascript'), true);
      assert.strictEqual(CodeValidator.checkForComments('let x: number = 1; /* ts comment */', 'typescript'), true);

      // Clean code without comments
      assert.strictEqual(CodeValidator.checkForComments('class Sol { public static void main(String[] args){} }', 'java'), false);
      assert.strictEqual(CodeValidator.checkForComments('#include <iostream>\nint main() { return 0; }', 'cpp'), false);
      assert.strictEqual(CodeValidator.checkForComments('#include <stdio.h>\nint main() { return 0; }', 'c'), false);
      assert.strictEqual(CodeValidator.checkForComments('def solve(arr):\n    return max(arr)', 'python'), false);
      assert.strictEqual(CodeValidator.checkForComments('function solve(x) { return x * 2; }', 'javascript'), false);
      assert.strictEqual(CodeValidator.checkForComments('function solve(x: number): number { return x * 2; }', 'typescript'), false);
    });
  });

  describe('3. CodeGeneratorService & MockAIProvider', () => {
    let service: CodeGeneratorService;

    beforeEach(() => {
      service = new CodeGeneratorService(new MockAIProvider());
    });

    test('Resolves language from problem metadata or explicit requested target', () => {
      assert.strictEqual(service.resolveLanguage('C++', undefined), 'cpp');
      assert.strictEqual(service.resolveLanguage('Python 3', undefined), 'python');
      assert.strictEqual(service.resolveLanguage(undefined, 'java'), 'java');
      assert.strictEqual(service.resolveLanguage(undefined, undefined), 'java');
    });

    test('Generates valid code for C++', async () => {
      const result = await service.generateCode(sampleProblem, samplePlan, 'cpp');
      assert.strictEqual(result.generatedCode.language, 'cpp');
      assert.ok(result.generatedCode.code.includes('#include <iostream>'));
      assert.strictEqual(result.generatedCode.completeness, true);
    });

    test('Generates valid code for Python', async () => {
      const result = await service.generateCode(sampleProblem, samplePlan, 'python');
      assert.strictEqual(result.generatedCode.language, 'python');
      assert.ok(result.generatedCode.code.includes('def solve():'));
      assert.strictEqual(result.generatedCode.completeness, true);
    });

    test('Flags incomplete code if provider returns placeholders', async () => {
      const incompleteProblem: ProblemInput = {
        ...sampleProblem,
        statement: 'trigger_incomplete_code',
      };

      const result = await service.generateCode(incompleteProblem, samplePlan, 'python');
      assert.strictEqual(result.generatedCode.completeness, false);
    });
  });

  describe('4. Express Backend Routes API Tests: POST /api/ai/generate-code', () => {
    test('POST /api/ai/generate-code returns 200 and generated code payload on valid request', async () => {
      const app = createApp();
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      try {
        const response = await fetch(`http://localhost:${port}/api/ai/generate-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            problem: sampleProblem,
            plan: samplePlan,
            targetLanguage: 'cpp',
          }),
        });

        assert.strictEqual(response.status, 200);
        const data = (await response.json()) as { status: string; generatedCode?: { language: string; code: string } };
        assert.strictEqual(data.status, 'success');
        assert.ok(data.generatedCode);
        assert.strictEqual(data.generatedCode.language, 'cpp');
        assert.ok(data.generatedCode.code.includes('#include <iostream>'));
      } finally {
        server.close();
      }
    });

    test('POST /api/ai/generate-code returns 400 when problem payload is invalid', async () => {
      const app = createApp();
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      try {
        const response = await fetch(`http://localhost:${port}/api/ai/generate-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            problem: { title: '' },
            plan: samplePlan,
          }),
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

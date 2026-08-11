import assert from 'node:assert';
import { test, describe } from 'node:test';
import { JsonCleaner } from '../utils/json-cleaner.js';
import { ReasoningValidator } from '../reasoning/reasoning-validator.js';
import { AIError } from '../ai/ai-provider.js';
import { ProblemInput } from '../ai/schemas.js';

const mockProblem: ProblemInput = {
  id: 'test-prob-1',
  title: 'Test Problem',
  statement: 'Test statement for unit testing.',
  inputFormat: 'Test input format',
  outputFormat: 'Test output format',
  constraints: '1 <= N <= 10^5',
  examples: [],
  notes: null,
  language: 'cpp',
  source: { url: 'https://example.com', hostname: 'example.com', platform: null, detectedAt: Date.now() },
  metadata: { extractedAt: Date.now(), extractionMethod: 'heuristic', confidence: 0.9, characterCount: 100 },
};

const validJsonPayload = JSON.stringify({
  status: 'ready',
  problemUnderstanding: 'Test understanding',
  keyInsights: ['Insight 1'],
  constraintsAnalysis: {
    constraints: ['1 <= N <= 10^5'],
    inputScale: 'N=10^5',
    requiredComplexity: 'O(N)',
    numericRange: null,
    dataStructureImplications: [],
    risks: [],
  },
  algorithm: {
    name: 'Linear Scan',
    category: 'other',
    description: 'Scan linearly',
    steps: ['Step 1'],
    alternatives: [],
    selectedBecause: 'Fastest',
  },
  correctnessReasoning: {
    invariant: null,
    argument: 'Correct by scan',
    keyCases: [],
    conclusion: 'Guaranteed',
  },
  complexity: {
    time: 'O(N)',
    space: 'O(1)',
    explanation: 'Linear time',
  },
  edgeCases: [],
  implementationRequirements: [],
  assumptions: [],
  confidence: 0.95,
});

describe('JsonCleaner & JSON Parser Pipeline', () => {
  test('TEST 1: Pure JSON -> PASS', () => {
    const res = JsonCleaner.extractJsonObject(validJsonPayload);
    assert.strictEqual(res.parserMethod, 'DIRECT_JSON');
    assert.strictEqual(res.jsonString, validJsonPayload);
  });

  test('TEST 2: Whitespace around JSON -> PASS', () => {
    const padded = `   \n\t  ${validJsonPayload}  \n  `;
    const res = JsonCleaner.extractJsonObject(padded);
    assert.strictEqual(res.jsonString, validJsonPayload);
  });

  test('TEST 3: JSON inside Markdown code fence -> PASS', () => {
    const fenced = `\`\`\`json\n${validJsonPayload}\n\`\`\``;
    const res = JsonCleaner.extractJsonObject(fenced);
    assert.strictEqual(res.parserMethod, 'MARKDOWN_NORMALIZED');
    assert.strictEqual(res.jsonString, validJsonPayload);
  });

  test('TEST 4: Text before JSON -> PASS', () => {
    const textBefore = `Here is the solution plan:\n${validJsonPayload}`;
    const res = JsonCleaner.extractJsonObject(textBefore);
    assert.strictEqual(res.parserMethod, 'OBJECT_EXTRACTED');
    assert.strictEqual(res.jsonString, validJsonPayload);
  });

  test('TEST 5: Text after JSON -> PASS', () => {
    const textAfter = `${validJsonPayload}\nHope this helps!`;
    const res = JsonCleaner.extractJsonObject(textAfter);
    assert.strictEqual(res.parserMethod, 'OBJECT_EXTRACTED');
    assert.strictEqual(res.jsonString, validJsonPayload);
  });

  test('TEST 6: Braces inside strings -> PASS', () => {
    const withBracesInString = JSON.stringify({
      status: 'ready',
      problemUnderstanding: 'Use {left, right} boundaries for interval computation',
      keyInsights: ['Insight {1}'],
      constraintsAnalysis: {
        constraints: [],
        inputScale: 'N=10^5',
        requiredComplexity: 'O(N)',
        numericRange: null,
        dataStructureImplications: [],
        risks: [],
      },
      algorithm: {
        name: 'Two Pointers',
        category: 'two-pointers',
        description: 'Pointers {l, r}',
        steps: ['Initialize {l, r}'],
        alternatives: [],
        selectedBecause: 'Optimal',
      },
      correctnessReasoning: {
        invariant: null,
        argument: 'Valid',
        keyCases: [],
        conclusion: 'Done',
      },
      complexity: { time: 'O(N)', space: 'O(1)', explanation: 'Linear' },
      edgeCases: [],
      implementationRequirements: [],
      assumptions: [],
      confidence: 0.9,
    });

    const surroundedWithBracesInString = `Pre text\n${withBracesInString}\nPost text`;
    const res = JsonCleaner.extractJsonObject(surroundedWithBracesInString);
    assert.strictEqual(res.jsonString, withBracesInString);
  });

  test('TEST 7: Escaped quotes -> PASS', () => {
    const rawWithEscapedQuotes = `Here is output:\n{\n  "status": "ready",\n  "problemUnderstanding": "Use \\"left\\" and \\"right\\" boundaries",\n  "keyInsights": ["Insight 1"],\n  "constraintsAnalysis": {\n    "constraints": [],\n    "inputScale": "N=10^5",\n    "requiredComplexity": "O(N)",\n    "numericRange": null,\n    "dataStructureImplications": [],\n    "risks": []\n  },\n  "algorithm": {\n    "name": "Scan",\n    "category": "other",\n    "description": "Scan",\n    "steps": ["Step 1"],\n    "alternatives": [],\n    "selectedBecause": "Preferred"\n  },\n  "correctnessReasoning": {\n    "invariant": null,\n    "argument": "Correct",\n    "keyCases": [],\n    "conclusion": "Pass"\n  },\n  "complexity": { "time": "O(N)", "space": "O(1)", "explanation": "O(N)" },\n  "edgeCases": [],\n  "implementationRequirements": [],\n  "assumptions": [],\n  "confidence": 0.95\n}`;

    const res = JsonCleaner.extractJsonObject(rawWithEscapedQuotes);
    assert.strictEqual(res.parserMethod, 'OBJECT_EXTRACTED');
    const parsed = JSON.parse(res.jsonString);
    assert.strictEqual(parsed.problemUnderstanding, 'Use "left" and "right" boundaries');
  });

  test('TEST 8: Malformed JSON -> AI_RESPONSE_NOT_JSON / AI_RESPONSE_TRUNCATED', () => {
    const malformed = `{"status": ready, "keyInsights": "unclosed string`;
    assert.throws(() => JsonCleaner.parseJsonSafely(malformed), (err: unknown) => err instanceof AIError);
  });

  test('TEST 9: Truncated JSON -> AI_RESPONSE_TRUNCATED', () => {
    const truncated = `{"status": "ready", "problemUnderstanding": "Truncated mid-string`;
    assert.throws(() => JsonCleaner.parseJsonSafely(truncated), (err: unknown) => err instanceof AIError && err.code === 'AI_RESPONSE_TRUNCATED');
  });

  test('TEST 10: Valid JSON but wrong schema -> AI_RESPONSE_SCHEMA_INVALID', () => {
    const wrongSchema = JSON.stringify({ wrongField: 123 });
    assert.throws(() => ReasoningValidator.parseAndValidate(wrongSchema, mockProblem, 'mock', 'model'), (err: unknown) => err instanceof AIError && err.code === 'AI_RESPONSE_SCHEMA_INVALID');
  });

  test('TEST 11: Empty response -> AI_EMPTY_RESPONSE', () => {
    assert.throws(() => JsonCleaner.normalizeAIResponse(''), (err: unknown) => err instanceof AIError && err.code === 'AI_EMPTY_RESPONSE');
    assert.throws(() => JsonCleaner.normalizeAIResponse('   \n\t '), (err: unknown) => err instanceof AIError && err.code === 'AI_EMPTY_RESPONSE');
  });
});

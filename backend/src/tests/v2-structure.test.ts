import test from 'node:test';
import assert from 'node:assert';
import { PlatformRules } from '../config/platform-rules.js';
import { JavaStructureValidator } from '../services/java-structure-validator.js';
import { CodeValidator } from '../services/code-validator.js';
import { CodeGeneratorService } from '../services/code-generator-service.js';
import { MockAIProvider } from '../ai/mock-provider.js';
import { ProblemInput } from '../ai/schemas.js';
import { SolutionPlan } from '../reasoning/schemas.js';

const mockPlan: SolutionPlan = {
  status: 'ready',
  problemUnderstanding: 'Test problem',
  keyInsights: [],
  constraintsAnalysis: {
    constraints: [],
    inputScale: 'Small',
    requiredComplexity: 'O(N)',
    numericRange: null,
    dataStructureImplications: [],
    risks: [],
  },
  algorithm: {
    name: 'Test Algorithm',
    category: 'hashing',
    description: 'Test description',
    steps: ['Step 1'],
    alternatives: [],
    selectedBecause: 'Fast',
  },
  correctnessReasoning: {
    invariant: null,
    argument: 'Correct',
    keyCases: [],
    conclusion: 'Passes',
  },
  complexity: { time: 'O(N)', space: 'O(1)', explanation: 'Linear' },
  edgeCases: [],
  implementationRequirements: [],
  assumptions: [],
  confidence: 1.0,
  model: 'mock',
  provider: 'mock',
  generatedAt: Date.now(),
};

test('PlatformRules correctly detects platform class requirements', () => {
  const leetcodeRule = PlatformRules.getRule('leetcode.com');
  assert.strictEqual(leetcodeRule.platform, 'leetcode');
  assert.strictEqual(leetcodeRule.className, 'Solution');
  assert.strictEqual(leetcodeRule.requiresMain, false);

  const hackerrankRule = PlatformRules.getRule('hackerrank.com');
  assert.strictEqual(hackerrankRule.platform, 'generic');
  assert.strictEqual(hackerrankRule.className, 'Main');
  assert.strictEqual(hackerrankRule.requiresMain, true);
});

test('JavaStructureValidator approves valid LeetCode Java code (non-public and public class Solution)', () => {
  const nonPublicCode = `
class Solution {
    public int solve(int[] nums) {
        return nums.length;
    }
}
`;
  const rule = PlatformRules.getRule('leetcode.com');
  const diagnostics1 = JavaStructureValidator.validate(nonPublicCode, rule);

  assert.strictEqual(diagnostics1.finalStatus, 'PASS');
  assert.strictEqual(diagnostics1.detectedClass, 'Solution');
  assert.strictEqual(diagnostics1.issues.length, 0);

  const publicCode = `
public class Solution {
    public int solve(int[] nums) {
        return nums.length;
    }
}
`;
  const diagnostics2 = JavaStructureValidator.validate(publicCode, rule);

  assert.strictEqual(diagnostics2.finalStatus, 'PASS');
  assert.strictEqual(diagnostics2.detectedClass, 'Solution');
  assert.strictEqual(diagnostics2.issues.length, 0);
});

test('JavaStructureValidator rejects LeetCode code using class Main or public class Main', () => {
  const code = `
public class Main {
    public static void main(String[] args) {}
}
`;
  const rule = PlatformRules.getRule('leetcode.com');
  const diagnostics = JavaStructureValidator.validate(code, rule);

  assert.strictEqual(diagnostics.finalStatus, 'FAIL');
});

test('JavaStructureValidator approves valid Generic platform Java code', () => {
  const code = `
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
    }
}
`;
  const rule = PlatformRules.getRule('hackerrank.com');
  const diagnostics = JavaStructureValidator.validate(code, rule);

  assert.strictEqual(diagnostics.finalStatus, 'PASS');
  assert.strictEqual(diagnostics.detectedClass, 'Main');
  assert.strictEqual(diagnostics.braceValidation, 'PASS');
  assert.strictEqual(diagnostics.issues.length, 0);
});

test('JavaStructureValidator rejects extra closing braces', () => {
  const code = `
public class Solution {
    public int solve() {
        return 0;
    }
}
}
`;
  const rule = PlatformRules.getRule('leetcode.com');
  const diagnostics = JavaStructureValidator.validate(code, rule);

  assert.strictEqual(diagnostics.braceValidation, 'FAIL');
  assert.strictEqual(diagnostics.finalStatus, 'FAIL');
  assert.ok(diagnostics.issues.some((i) => i.includes('extra closing brace')));
});

test('JavaStructureValidator rejects unclosed braces', () => {
  const code = `
public class Solution {
    public int solve() {
        return 0;
`;
  const rule = PlatformRules.getRule('leetcode.com');
  const diagnostics = JavaStructureValidator.validate(code, rule);

  assert.strictEqual(diagnostics.braceValidation, 'FAIL');
  assert.strictEqual(diagnostics.finalStatus, 'FAIL');
  assert.ok(diagnostics.issues.some((i) => i.includes('unbalanced braces')));
});

test('JavaStructureValidator rejects multiple public classes', () => {
  const code = `
public class Solution {}
public class Main {}
`;
  const rule = PlatformRules.getRule('leetcode.com');
  const diagnostics = JavaStructureValidator.validate(code, rule);

  assert.strictEqual(diagnostics.structureValidation, 'FAIL');
  assert.ok(diagnostics.issues.some((i) => i.includes('Multiple public classes')));
});

test('JavaStructureValidator rejects nested duplicate class declarations', () => {
  const code = `
public class Solution {
    public class Solution {
    }
}
`;
  const rule = PlatformRules.getRule('leetcode.com');
  const diagnostics = JavaStructureValidator.validate(code, rule);

  assert.strictEqual(diagnostics.finalStatus, 'FAIL');
  assert.ok(diagnostics.issues.some((i) => i.includes('Duplicate or nested class declaration')));
});

test('JavaStructureValidator rejects comments', () => {
  const code = `
public class Solution {
    // Single line comment
    public int solve() {
        return 0;
    }
}
`;
  const rule = PlatformRules.getRule('leetcode.com');
  const diagnostics = JavaStructureValidator.validate(code, rule);

  assert.strictEqual(diagnostics.commentValidation, 'FAIL');
  assert.strictEqual(diagnostics.finalStatus, 'FAIL');
});

const mockValidProblem: ProblemInput = {
  id: 'prob-test-456',
  title: 'Find Maximum Element',
  statement: 'Given an array of N integers, find and return the maximum value element in the array.',
  inputFormat: 'First line contains integer N.',
  outputFormat: 'Print the maximum integer value.',
  constraints: '1 <= N <= 100000',
  examples: [
    { input: '5\n10 20 50 40 30', output: '50', explanation: '50 is the largest integer.' },
  ],
  notes: null,
  language: 'java',
  source: {
    url: 'https://leetcode.com/problems/test',
    hostname: 'leetcode.com',
    platform: 'leetcode',
    detectedAt: Date.now(),
  },
  metadata: {
    extractedAt: Date.now(),
    extractionMethod: 'universal-heuristic-extractor',
    confidence: 0.95,
    characterCount: 300,
  },
};

test('CodeGeneratorService generates valid Java solution for LeetCode', async () => {
  const service = new CodeGeneratorService(new MockAIProvider());
  const problem: ProblemInput = {
    ...mockValidProblem,
    language: 'java',
    source: {
      url: 'https://leetcode.com/problems/test',
      hostname: 'leetcode.com',
      platform: 'leetcode',
      detectedAt: Date.now(),
    },
  };

  const result = await service.generateCode(problem, mockPlan, 'java');
  assert.ok(result.generatedCode.code.includes('class Solution'));
  assert.ok(!result.generatedCode.code.includes('//'));
});

test('CodeGeneratorService generates valid Java solution for Generic Platform', async () => {
  const service = new CodeGeneratorService(new MockAIProvider());
  const problem: ProblemInput = {
    ...mockValidProblem,
    language: 'java',
    source: {
      url: 'https://hackerrank.com/challenges/test',
      hostname: 'hackerrank.com',
      platform: 'hackerrank',
      detectedAt: Date.now(),
    },
  };

  const result = await service.generateCode(problem, mockPlan, 'java');
  assert.ok(result.generatedCode.code.includes('public class Main'));
  assert.ok(result.generatedCode.code.includes('public static void main'));
});

test('CodeGeneratorService throws CODE_STRUCTURE_INVALID when structural errors persist', async () => {
  const service = new CodeGeneratorService(new MockAIProvider());
  const problem: ProblemInput = {
    ...mockValidProblem,
    statement: 'trigger_invalid_class_name problem statement',
    language: 'java',
    source: {
      url: 'https://leetcode.com/problems/test',
      hostname: 'leetcode.com',
      platform: 'leetcode',
      detectedAt: Date.now(),
    },
  };

  await assert.rejects(
    async () => {
      await service.generateCode(problem, mockPlan, 'java');
    },
    (err: any) => {
      return err.code === 'CODE_STRUCTURE_INVALID' && err.statusHttp === 400;
    }
  );
});

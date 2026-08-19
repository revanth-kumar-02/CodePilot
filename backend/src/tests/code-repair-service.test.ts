import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CodeRepairService } from '../services/code-repair-service.js';
import { ProblemInput } from '../ai/schemas.js';
import { CodeValidator } from '../services/code-validator.js';
import { PlatformRules } from '../config/platform-rules.js';

const mockProblem: ProblemInput = {
  id: 'prob_multiply_strings',
  title: 'Multiply Strings',
  statement: 'Given two non-negative integers num1 and num2 represented as strings, return product of num1 and num2 as string.',
  inputFormat: null,
  outputFormat: null,
  constraints: null,
  examples: [],
  notes: null,
  language: 'java',
  source: {
    url: 'https://leetcode.com/problems/multiply-strings/',
    hostname: 'leetcode.com',
    platform: 'leetcode',
    detectedAt: Date.now(),
  },
  metadata: {
    extractedAt: Date.now(),
    extractionMethod: 'dom',
    confidence: 1,
    characterCount: 200,
  },
};

describe('CodeRepairService Diagnostics & Repair Workflow', () => {
  const repairService = new CodeRepairService();

  it('classifies Method Signature mismatch correctly', async () => {
    const faultyCode = `class Solution { public int trap(int[] h) { return 0; } }`;
    const errorMessage = `symbol: method multiply(String,String) location: class Solution`;

    const analysis = await repairService.analyzeError(mockProblem, faultyCode, errorMessage);
    assert.equal(analysis.classification, 'Method Signature');
    assert.ok(analysis.explanation.length > 0);
  });

  it('classifies Compilation Error correctly', async () => {
    const faultyCode = `class Solution { public void solve() { int a = ; } }`;
    const errorMessage = `Line 1: error: illegal start of expression`;

    const analysis = await repairService.analyzeError(mockProblem, faultyCode, errorMessage);
    assert.equal(analysis.classification, 'Compilation Error');
  });

  it('classifies Runtime Error correctly', async () => {
    const faultyCode = `class Solution { public String multiply(String a, String b) { return a.substring(100); } }`;
    const errorMessage = `java.lang.StringIndexOutOfBoundsException: String index out of range: 100`;

    const analysis = await repairService.analyzeError(mockProblem, faultyCode, errorMessage);
    assert.equal(analysis.classification, 'Runtime Error');
  });

  it('classifies Wrong Answer correctly', async () => {
    const faultyCode = `class Solution { public String multiply(String a, String b) { return "0"; } }`;
    const errorMessage = `Wrong Answer. Output: "0", Expected: "6"`;
    const testOutput = `Input: num1 = "2", num2 = "3"\nOutput: "0"\nExpected: "6"`;

    const analysis = await repairService.analyzeError(mockProblem, faultyCode, errorMessage, testOutput);
    assert.equal(analysis.classification, 'Wrong Answer');
  });

  it('classifies Time Limit Exceeded correctly', async () => {
    const faultyCode = `class Solution { public String multiply(String a, String b) { while(true){} } }`;
    const errorMessage = `Time Limit Exceeded (TLE)`;

    const analysis = await repairService.analyzeError(mockProblem, faultyCode, errorMessage);
    assert.equal(analysis.classification, 'Time Limit');
  });

  it('classifies Memory Limit Exceeded correctly', async () => {
    const faultyCode = `class Solution { public String multiply(String a, String b) { int[] arr = new int[100000000]; return ""; } }`;
    const errorMessage = `Memory Limit Exceeded (MLE) - Out of Memory`;

    const analysis = await repairService.analyzeError(mockProblem, faultyCode, errorMessage);
    assert.equal(analysis.classification, 'Memory Limit');
  });

  it('generates valid repaired Java code conforming to LeetCode class Solution rules', async () => {
    const faultyCode = `class Solution { public int trap(int[] height) { return 0; } }`;
    const errorMessage = `symbol: method multiply(String,String) location: class Solution`;

    const result = await repairService.generateRepair(
      mockProblem,
      null,
      null,
      faultyCode,
      'java',
      errorMessage,
      null,
      'Method Signature',
      'leetcode'
    );

    assert.ok(result.repairedCode.includes('class Solution'));
    assert.ok(result.repairedCode.includes('multiply'));
    assert.ok(!result.repairedCode.includes('trap'));

    // Validate structural compliance via CodeValidator
    const rule = PlatformRules.getRule('leetcode.com', 'leetcode');
    const validation = CodeValidator.parseAndValidate(result.repairedCode, 'java', rule);
    assert.equal(validation.valid, true, `Validation failed: ${validation.issues.join('; ')}`);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CodeRepairService } from '../services/code-repair-service.js';
import { ProblemInput } from '../ai/schemas.js';

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

describe('CodeRepairService', () => {
  const repairService = new CodeRepairService();

  it('classifies Java method mismatch error as Method Signature', async () => {
    const faultyCode = `
public class Solution {
    public int trap(int[] height) {
        return 0;
    }
}`;

    const errorMessage = `Line 7: error: cannot find symbol [in __Driver__.java]
    String ret = new Solution().multiply(param_1, param_2);
                               ^
  symbol:   method multiply(String,String)
  location: class Solution`;

    const analysis = await repairService.analyzeError(mockProblem, faultyCode, errorMessage);
    assert.equal(analysis.classification, 'Method Signature');
    assert.ok(analysis.explanation.length > 0);
  });

  it('classifies compile error correctly', async () => {
    const faultyCode = `public class Solution { public void solve() { int a = ; } }`;
    const errorMessage = `Line 1: error: illegal start of expression`;

    const analysis = await repairService.analyzeError(mockProblem, faultyCode, errorMessage);
    assert.equal(analysis.classification, 'Compilation Error');
  });

  it('generates valid repaired Java code conforming to LeetCode class Solution rules', async () => {
    const faultyCode = `
public class Solution {
    public int trap(int[] height) {
        return 0;
    }
}`;

    const errorMessage = `symbol: method multiply(String,String) location: class Solution`;

    const result = await repairService.generateRepair(
      mockProblem,
      null,
      faultyCode,
      'java',
      errorMessage,
      null,
      'Method Signature'
    );

    assert.ok(result.repairedCode.includes('public class Solution'));
    assert.ok(result.repairedCode.includes('multiply'));
    assert.ok(!result.repairedCode.includes('trap'));
  });
});

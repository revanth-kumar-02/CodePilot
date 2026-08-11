import assert from 'node:assert';
import { test, describe } from 'node:test';
import { SessionStore } from '../storage/session-store.ts';

describe('Unified SessionStore Unit & Lifecycle Tests', () => {
  test('1. Create Session initializes default schema and active status', async () => {
    const session = await SessionStore.createSession(101, 'https://leetcode.com/problems/two-sum', 'leetcode', 'Two Sum');
    assert.strictEqual(session.tabId, 101);
    assert.strictEqual(session.schemaVersion, 1);
    assert.strictEqual(session.status, 'active');
    assert.ok(session.sessionId.startsWith('session_101_'));
    assert.ok(session.problemFingerprint);
    assert.strictEqual(session.problem, null);
    assert.strictEqual(session.solutionPlan, null);
  });

  test('2. Get Session retrieves stored session by tabId', async () => {
    const session = await SessionStore.getSession(101);
    assert.ok(session);
    assert.strictEqual(session?.tabId, 101);
    assert.strictEqual(session?.url, 'https://leetcode.com/problems/two-sum');
  });

  test('3. Update Problem, AI Analysis, Solution Plan, and Code while preserving previous fields', async () => {
    const tabId = 102;
    await SessionStore.createSession(tabId, 'https://leetcode.com/problems/group-anagrams', 'leetcode', 'Group Anagrams');

    // Phase 1: Problem Extraction
    const mockProblem: any = {
      id: 'prob-102',
      title: 'Group Anagrams',
      statement: 'Given an array of strings, group the anagrams together.',
      language: 'java',
    };
    let updated = await SessionStore.updateSession(tabId, { problem: mockProblem });
    assert.ok(updated?.problem);
    assert.strictEqual(updated?.problem?.title, 'Group Anagrams');

    // Phase 2: AI Analysis
    const mockAnalysis: any = {
      status: 'success',
      understanding: 'Group strings with identical frequency maps.',
      algorithmApproach: 'Hash Map with Character Frequency Key',
    };
    updated = await SessionStore.updateSession(tabId, { aiAnalysis: mockAnalysis });
    assert.ok(updated?.problem, 'Problem must be preserved after AI Analysis update');
    assert.ok(updated?.aiAnalysis, 'AI Analysis must be saved');
    assert.strictEqual(updated?.aiAnalysis?.algorithmApproach, 'Hash Map with Character Frequency Key');

    // Phase 3: Solution Plan
    const mockPlan: any = {
      status: 'ready',
      problemUnderstanding: 'Group anagrams using frequency key.',
      algorithm: { name: 'Categorize by Count', category: 'hash-table' },
    };
    updated = await SessionStore.updateSession(tabId, { solutionPlan: mockPlan });
    assert.ok(updated?.problem, 'Problem must be preserved after Solution Plan update');
    assert.ok(updated?.aiAnalysis, 'AI Analysis must be preserved after Solution Plan update');
    assert.ok(updated?.solutionPlan, 'Solution Plan must be saved');
    assert.strictEqual(updated?.solutionPlan?.algorithm.name, 'Categorize by Count');

    // Phase 4: Code Generation
    updated = await SessionStore.updateSession(tabId, {
      code: {
        status: 'ready',
        language: 'java',
        version: 'Java 17',
        source: 'class Solution { public List<List<String>> groupAnagrams(String[] strs) {} }',
      },
    });
    assert.ok(updated?.problem, 'Problem preserved');
    assert.ok(updated?.aiAnalysis, 'AI Analysis preserved');
    assert.ok(updated?.solutionPlan, 'Solution Plan preserved');
    assert.strictEqual(updated?.code.status, 'ready');
    assert.strictEqual(updated?.code.language, 'java');
    assert.ok(updated?.code.source?.includes('groupAnagrams'));
  });

  test('4. Tab Isolation: Sessions for separate tabs do not overwrite each other', async () => {
    await SessionStore.createSession(201, 'https://leetcode.com/problems/problem-a', 'leetcode', 'Problem A');
    await SessionStore.createSession(202, 'https://leetcode.com/problems/problem-b', 'leetcode', 'Problem B');

    await SessionStore.updateSession(201, {
      code: { status: 'ready', language: 'cpp', version: 'C++ 20', source: '// Solution A' },
    });

    const sessionA = await SessionStore.getSession(201);
    const sessionB = await SessionStore.getSession(202);

    assert.strictEqual(sessionA?.code.source, '// Solution A');
    assert.strictEqual(sessionB?.code.source, null);
  });

  test('5. Popup Reopen Recovery: session data remains intact when re-querying', async () => {
    const session = await SessionStore.getSession(102);
    assert.ok(session?.problem);
    assert.ok(session?.aiAnalysis);
    assert.ok(session?.solutionPlan);
    assert.ok(session?.code.source);
  });

  test('6. Stale Response Protection: updates with outdated fingerprint are ignored', async () => {
    const tabId = 301;
    const sessionOld = await SessionStore.createSession(tabId, 'https://leetcode.com/problems/old-problem', 'leetcode', 'Old Problem');
    const oldFingerprint = sessionOld.problemFingerprint;

    // User navigates to new problem in same tab
    const sessionNew = await SessionStore.createSession(tabId, 'https://leetcode.com/problems/new-problem', 'leetcode', 'New Problem');
    assert.notStrictEqual(sessionOld.problemFingerprint, sessionNew.problemFingerprint);

    // Late arriving AI response for old problem tries to update session using oldFingerprint
    const result = await SessionStore.updateSession(
      tabId,
      { solutionPlan: { status: 'ready' } as any },
      oldFingerprint
    );

    // Old response should NOT overwrite new session
    assert.strictEqual(result?.solutionPlan, null);
    assert.strictEqual(result?.url, 'https://leetcode.com/problems/new-problem');
  });

  test('7. Session Completion and Safe Cleanup', async () => {
    const tabId = 401;
    await SessionStore.createSession(tabId, 'https://leetcode.com/problems/valid-parentheses', 'leetcode', 'Valid Parentheses');
    await SessionStore.completeSession(tabId);

    const cleared = await SessionStore.getSession(tabId);
    assert.strictEqual(cleared, null, 'Completed active session should be safely cleaned up');
  });

  test('8. Malformed Invalid Session Recovery', async () => {
    const tabId = 501;
    // Write invalid raw object directly
    (SessionStore as any).memoryFallbackStorage?.set(SessionStore.getSessionKey(tabId), { invalidKey: true });

    const session = await SessionStore.getSession(tabId);
    assert.strictEqual(session, null, 'Malformed session schema returns null for recovery');
  });

  test('9. Critical Flow Test: Extraction -> Analysis -> Solution Plan -> Code Tab Check -> Code Generation', async () => {
    const tabId = 601;

    // Step 1: Extraction
    await SessionStore.createSession(tabId, 'https://leetcode.com/problems/spiral-matrix', 'leetcode', 'Spiral Matrix');
    const problemData: any = { id: 'spiral-1', title: 'Spiral Matrix', statement: 'Return elements in spiral order.' };
    await SessionStore.updateSession(tabId, { problem: problemData });

    // Step 2: AI Analysis
    const analysisData: any = { status: 'success', algorithmApproach: 'Layer-by-Layer Traversal' };
    await SessionStore.updateSession(tabId, { aiAnalysis: analysisData });

    // Step 3: Solution Plan
    const planData: any = {
      status: 'ready',
      algorithm: { name: 'Layer-by-Layer Boundary Shrinking', category: 'matrix' },
    };
    await SessionStore.updateSession(tabId, { solutionPlan: planData });

    // Step 4: Switch to Code Tab -> Read session
    const currentSession = await SessionStore.getSession(tabId);
    assert.ok(currentSession?.solutionPlan, 'solutionPlan MUST exist when switching to Code tab');
    assert.strictEqual(currentSession?.solutionPlan?.algorithm.name, 'Layer-by-Layer Boundary Shrinking');

    // Step 5: Code Generation request constructed from currentSession (problem + solutionPlan)
    assert.ok(currentSession?.problem, 'Code generator receives the SAME problem');
    assert.ok(currentSession?.solutionPlan, 'Code generator receives the SAME solutionPlan');
    assert.strictEqual(currentSession?.problem?.title, 'Spiral Matrix');

    // Save generated code
    await SessionStore.updateSession(tabId, {
      code: {
        status: 'ready',
        language: 'java',
        version: 'Java 17',
        source: 'class Solution { public List<Integer> spiralOrder(int[][] matrix) {} }',
      },
    });

    const finalSession = await SessionStore.getSession(tabId);
    assert.strictEqual(finalSession?.code.status, 'ready');
    assert.ok(finalSession?.code.source?.includes('spiralOrder'));
  });
});

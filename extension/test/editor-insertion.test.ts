import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EditorManager } from '../src/content/adapters/editor-manager.ts';
import { EditorAdapter } from '../src/content/adapters/types.js';

class MockAdapter implements EditorAdapter {
  public name = 'Mock Adapter';
  public type = 'codemirror' as const;
  private value = '';
  public detect() { return true; }
  public focus() {}
  public getValue() { return this.value; }
  public setValue(val: string) { this.value = val; return true; }
}

describe('EditorManager Single Insertion & Double Guard Tests', () => {
  it('prevents multiple public class Main in Java code', () => {
    const duplicateJava = `
public class Main {
    public static void main(String[] args) {}
}
public class Main {
    public static void main(String[] args) {}
}`;
    const check = EditorManager.validateJavaStructure(duplicateJava, 'generic');
    assert.equal(check.valid, false);
    assert.ok(check.reason?.includes('Multiple public class') || check.reason?.includes('Duplicate'));
  });

  it('approves single public class Main for generic/CodeChef platform', () => {
    const validJava = `
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello");
    }
}`;
    const check = EditorManager.validateJavaStructure(validJava, 'generic');
    assert.equal(check.valid, true);
  });

  it('approves class Solution and public class Solution for LeetCode platform', () => {
    const validLeetCodeNonPublic = `
class Solution {
    public int[] twoSum(int[] nums, int target) {
        return new int[]{0, 1};
    }
}`;
    const check1 = EditorManager.validateJavaStructure(validLeetCodeNonPublic, 'leetcode');
    assert.equal(check1.valid, true);

    const validLeetCodePublic = `
public class Solution {
    public int solve() {
        return 42;
    }
}`;
    const check2 = EditorManager.validateJavaStructure(validLeetCodePublic, 'leetcode');
    assert.equal(check2.valid, true);
  });

  it('rejects class Main and class OtherName for LeetCode platform', () => {
    const invalidLeetCodeMain = `
class Main {
    public static void main(String[] args) {}
}`;
    const check1 = EditorManager.validateJavaStructure(invalidLeetCodeMain, 'leetcode');
    assert.equal(check1.valid, false);

    const invalidLeetCodeOther = `
class OtherName {
    public int solve() { return 0; }
}`;
    const check2 = EditorManager.validateJavaStructure(invalidLeetCodeOther, 'leetcode');
    assert.equal(check2.valid, false);
  });

  it('rejects double click / concurrent insertion requests with DUPLICATE_INSERTION_BLOCKED', async () => {
    // Register mock adapter
    (EditorManager as any).adapters = [new MockAdapter()];

    const testCode = `public class Main { public static void main(String[] args) {} }`;

    // First insertion completes
    const res1 = await EditorManager.insertCode(testCode, 'java', true, { insertionId: 'test_id_1' });
    assert.equal(res1.success, true);

    // Second insertion with same insertionId is blocked
    const res2 = await EditorManager.insertCode(testCode, 'java', true, { insertionId: 'test_id_1' });
    assert.equal(res2.success, false);
    assert.equal(res2.errorCode, 'DUPLICATE_INSERTION_BLOCKED');
  });

  it('detects ALREADY_INSERTED when editor already contains exact code', async () => {
    const mock = new MockAdapter();
    const testCode = `public class Main { public static void main(String[] args) {} }`;
    mock.setValue(testCode);
    (EditorManager as any).adapters = [mock];

    const res = await EditorManager.insertCode(testCode, 'java', true, { insertionId: 'test_id_2' });
    assert.equal(res.success, true);
    assert.equal(res.errorCode, 'ALREADY_INSERTED');
  });
});

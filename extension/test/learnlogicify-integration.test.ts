import test from 'node:test';
import assert from 'node:assert/strict';
import { LearnLogicifyProblemExtractor } from '../src/extraction/extractors/learnlogicify-extractor.ts';
import { LearnLogicifyAdapter } from '../src/content/adapters/learnlogicify-adapter.ts';
import { EditorManager } from '../src/content/adapters/editor-manager.ts';
import { TypingEngine } from '../src/content/adapters/typing-engine.ts';
import { PlatformRules } from '../../backend/src/config/platform-rules.ts';

function createMockElement(tagName: string, text: string, classList: string[] = [], children: any[] = []): any {
  const element = {
    tagName: tagName.toUpperCase(),
    textContent: text,
    classList: {
      contains: (cls: string) => classList.includes(cls),
    },
    className: classList.join(' '),
    closest: (sel: string) => {
      if (sel.includes('editor') && classList.some((c) => c.includes('editor'))) return element;
      return null;
    },
    querySelector: (sel: string) => {
      for (const child of children) {
        if (child.tagName && matchesSelector(child, sel)) return child;
        const sub = child.querySelector ? child.querySelector(sel) : null;
        if (sub) return sub;
      }
      return null;
    },
    querySelectorAll: (sel: string) => {
      const results: any[] = [];
      for (const child of children) {
        if (child.tagName && matchesSelector(child, sel)) results.push(child);
        if (child.querySelectorAll) {
          results.push(...child.querySelectorAll(sel));
        }
      }
      return results;
    },
    cloneNode: () => element,
    remove: () => {},
  };
  return element;
}

function matchesSelector(el: any, sel: string): boolean {
  if (!el || !el.tagName) return false;
  if (sel.startsWith('.') && el.className.includes(sel.slice(1))) return true;
  if (sel.startsWith('#') && el.className.includes(sel.slice(1))) return true;
  if (sel.includes('problem-statement') && el.className.includes('problem-statement')) return true;
  if (sel.includes('problem-title') && el.className.includes('problem-title')) return true;
  if (sel === 'h1' && el.tagName === 'H1') return true;
  if (sel === 'p' && el.tagName === 'P') return true;
  return false;
}

function createMockDocument(url: string, title: string, bodyChildren: any[]): any {
  const body = createMockElement('body', bodyChildren.map((c) => c.textContent).join('\n'), [], bodyChildren);
  const doc = {
    location: { href: url, hostname: 'app.learnlogicify.com' },
    title,
    body,
    querySelector: (sel: string) => body.querySelector(sel),
    querySelectorAll: (sel: string) => body.querySelectorAll(sel),
  };
  return doc;
}

test('1. LearnLogicify Problem Extraction - Valid Assessment Page', () => {
  const pTitle = createMockElement('h1', 'Reverse Linked List', ['problem-title']);
  const stmt = createMockElement(
    'p',
    'Given the head of a singly linked list, reverse the list, and return the reversed list. Ensure your solution runs in O(N) time complexity.'
  );
  const inTitle = createMockElement('h3', 'Input Format');
  const inBody = createMockElement('p', 'First line contains integer N denoting number of nodes.');
  const outTitle = createMockElement('h3', 'Output Format');
  const outBody = createMockElement('p', 'Print space separated values of reversed list.');

  const container = createMockElement('div', 'Full statement content text for LearnLogicify linked list problem', ['problem-statement'], [
    pTitle,
    stmt,
    inTitle,
    inBody,
    outTitle,
    outBody,
  ]);

  const doc = createMockDocument(
    'https://app.learnlogicify.com/assessment/problem-101',
    'Reverse Linked List - LearnLogicify',
    [container]
  );

  const isLL = LearnLogicifyProblemExtractor.isLearnLogicify(doc);
  assert.equal(isLL, true);

  const result = LearnLogicifyProblemExtractor.extract(doc);
  assert.equal(result.status, 'success');
  assert.ok(result.problem);
  assert.equal(result.problem?.title, 'Reverse Linked List');
  assert.equal(result.problem?.source.platform, 'LearnLogicify');
});

test('2. LearnLogicify Java Format Enforcement (public class Main)', () => {
  const rule = PlatformRules.getRule('app.learnlogicify.com', 'learnlogicify');
  assert.equal(rule.platform, 'learnlogicify');
  assert.equal(rule.className, 'Main');
  assert.equal(rule.requiresMain, true);

  const validJava = `
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello Logicify");
    }
}`;

  const check = EditorManager.validateJavaStructure(validJava, 'learnlogicify');
  assert.equal(check.valid, true);

  const solutionJava = `
public class Solution {
    public static void main(String[] args) {}
}`;

  const checkInvalid = EditorManager.validateJavaStructure(solutionJava, 'learnlogicify');
  assert.equal(checkInvalid.valid, false);
});

test('3. LeetCode and CodeChef Non-Regression', () => {
  const leetCodeRule = PlatformRules.getRule('leetcode.com', 'leetcode');
  assert.equal(leetCodeRule.className, 'Solution');
  assert.equal(leetCodeRule.requiresMain, false);

  const validLeetCode = `
class Solution {
    public int[] twoSum(int[] nums, int target) {
        return new int[]{};
    }
}`;
  const lcCheck = EditorManager.validateJavaStructure(validLeetCode, 'leetcode');
  assert.equal(lcCheck.valid, true);

  const ccRule = PlatformRules.getRule('codechef.com', 'codechef');
  assert.equal(ccRule.className, 'Main');
  assert.equal(ccRule.requiresMain, true);
});

test('4. Centralized TypingEngine Speed Delays', () => {
  TypingEngine.configure({ minDelay: 40, maxDelay: 70, enabled: true });
  const delayChar = TypingEngine.getCharacterDelay('a');
  assert.ok(delayChar >= 40 && delayChar <= 70);

  const delayNewline = TypingEngine.getCharacterDelay('\n');
  assert.ok(delayNewline > delayChar);

  TypingEngine.configure({ enabled: false });
  assert.equal(TypingEngine.getCharacterDelay('a'), 0);
  TypingEngine.configure({ minDelay: 40, maxDelay: 70, enabled: true });
});

test('5. LearnLogicify Adapter Verification and Readback Failure Handling', async () => {
  class MockLearnLogicifyAdapter extends LearnLogicifyAdapter {
    public mockContent = '';
    public simulateReadbackFail = false;

    public override getValue(): string {
      if (this.simulateReadbackFail) return 'mismatched code';
      return this.mockContent;
    }

    public override setValue(code: string): boolean {
      this.mockContent = code;
      return true;
    }

    public override detect(): boolean {
      return true;
    }
  }

  const adapter = new MockLearnLogicifyAdapter();
  adapter.setValue('public class Main {}');
  assert.equal(adapter.getValue(), 'public class Main {}');

  adapter.simulateReadbackFail = true;
  const res = await adapter.insertCode('public class Main {}', 'java', { mode: 'instant' });
  assert.equal(res.success, false);
  assert.equal(res.errorCode, 'EDITOR_READBACK_FAILED');
});

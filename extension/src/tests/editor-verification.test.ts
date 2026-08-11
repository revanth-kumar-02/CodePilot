import assert from 'node:assert';
import { test, describe } from 'node:test';
import { LanguageRegistry } from '../shared/language-registry.ts';
import { EditorManager } from '../content/adapters/editor-manager.ts';

describe('Extension Editor Manager & Language Registry Unit Tests', () => {
  describe('1. Centralized Language Registry', () => {
    test('Supports ONLY Java, C++, C, Python, JavaScript, TypeScript', () => {
      assert.strictEqual(LanguageRegistry.isSupported('java'), true);
      assert.strictEqual(LanguageRegistry.isSupported('cpp'), true);
      assert.strictEqual(LanguageRegistry.isSupported('c'), true);
      assert.strictEqual(LanguageRegistry.isSupported('python'), true);
      assert.strictEqual(LanguageRegistry.isSupported('javascript'), true);
      assert.strictEqual(LanguageRegistry.isSupported('typescript'), true);

      // Unsupported languages MUST be rejected
      assert.strictEqual(LanguageRegistry.isSupported('go'), false);
      assert.strictEqual(LanguageRegistry.isSupported('rust'), false);
      assert.strictEqual(LanguageRegistry.isSupported('kotlin'), false);
      assert.strictEqual(LanguageRegistry.isSupported('csharp'), false);
      assert.strictEqual(LanguageRegistry.isSupported('swift'), false);
    });

    test('Defaults to Java when language is empty or unrecognized', () => {
      assert.strictEqual(LanguageRegistry.normalize(''), 'java');
      assert.strictEqual(LanguageRegistry.normalize(null), 'java');
      assert.strictEqual(LanguageRegistry.normalize('unsupported_lang'), 'java');
    });

    test('Formats version display cleanly or returns Version unavailable', () => {
      assert.strictEqual(
        LanguageRegistry.resolveVersionDisplay('java', null),
        'Java (Version unavailable)'
      );
      assert.strictEqual(
        LanguageRegistry.resolveVersionDisplay('java', ''),
        'Java (Version unavailable)'
      );
      assert.strictEqual(
        LanguageRegistry.resolveVersionDisplay('java', 'Java 17'),
        'Java 17'
      );
      assert.strictEqual(
        LanguageRegistry.resolveVersionDisplay('cpp', 'g++20'),
        'C++ g++20'
      );
    });
  });

  describe('2. Editor Verification & Readback Logic', () => {
    test('verifyReadback returns true for matching code after normalizing line endings', () => {
      const code = 'public class Solution {\n  public static void main() {}\n}';
      const readback = 'public class Solution {\r\n  public static void main() {}\r\n}';

      assert.strictEqual(EditorManager.verifyReadback(code, readback), true);
    });

    test('verifyReadback returns false when readback is empty or mismatched', () => {
      const code = 'int main() { return 0; }';
      assert.strictEqual(EditorManager.verifyReadback(code, ''), false);
      assert.strictEqual(EditorManager.verifyReadback(code, 'some completely different code'), false);
    });
  });

  describe('3. Insertion Results when no DOM Editor Present', () => {
    test('insertCode returns EDITOR_NOT_FOUND when no editor exists in DOM environment', async () => {
      const result = await EditorManager.insertCode('System.out.println("Hello");', 'java');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.errorCode, 'EDITOR_NOT_FOUND');
    });
  });
});

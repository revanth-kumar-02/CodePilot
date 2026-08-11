import assert from 'node:assert';
import { test, describe } from 'node:test';
import { initMonacoPageBridge } from '../content/page-bridge.ts';

describe('Monaco Page Context Bridge & Verification Tests', () => {
  test('1. Bridge Unavailable when window.monaco is missing', () => {
    let resultResponse: any = null;
    const mockWindow: any = {
      addEventListener: (type: string, fn: Function) => {
        if (type === 'message') mockWindow._listener = fn;
      },
      postMessage: (data: any) => {
        if (data.source === 'CODEPILOT_PAGE_BRIDGE') {
          resultResponse = data;
        } else if (data.source === 'CODEPILOT_CONTENT' && mockWindow._listener) {
          mockWindow._listener({ source: mockWindow, data });
        }
      },
    };

    (global as any).window = mockWindow;
    (global as any).document = { querySelectorAll: () => [] };
    delete (mockWindow as any)['codepilot-monaco-page-bridge-active'];
    initMonacoPageBridge();

    mockWindow.postMessage({
      source: 'CODEPILOT_CONTENT',
      type: 'CODEPILOT_MONACO_SET',
      id: 'test-req-1',
      payload: { code: 'class Solution {}' },
    });

    assert.ok(resultResponse);
    assert.strictEqual(resultResponse.success, false);
    assert.strictEqual(resultResponse.errorCode, 'MONACO_BRIDGE_UNAVAILABLE');
    assert.strictEqual(resultResponse.diagnostics.monacoRuntime, 'NOT FOUND');
  });

  test('2. Model Unavailable when monaco runtime has no active model', () => {
    let bridgeResult: any = null;
    const mockWindow: any = {
      monaco: {
        editor: {
          getEditors: () => [],
          getModels: () => [],
        },
      },
      addEventListener: (type: string, fn: Function) => {
        if (type === 'message') {
          mockWindow._listener = fn;
        }
      },
      postMessage: (data: any) => {
        if (data.source === 'CODEPILOT_PAGE_BRIDGE') {
          bridgeResult = data;
        } else if (data.source === 'CODEPILOT_CONTENT' && mockWindow._listener) {
          mockWindow._listener({ source: mockWindow, data });
        }
      },
    };

    (global as any).window = mockWindow;
    delete (mockWindow as any)['codepilot-monaco-page-bridge-active'];
    initMonacoPageBridge();

    mockWindow.postMessage({
      source: 'CODEPILOT_CONTENT',
      type: 'CODEPILOT_MONACO_SET',
      id: 'test-req-2',
      payload: { code: 'class Solution {}' },
    });

    assert.ok(bridgeResult);
    assert.strictEqual(bridgeResult.success, false);
    assert.strictEqual(bridgeResult.errorCode, 'MONACO_MODEL_NOT_FOUND');
    assert.strictEqual(bridgeResult.diagnostics.monacoRuntime, 'FOUND');
    assert.strictEqual(bridgeResult.diagnostics.model, 'NOT FOUND');
  });

  test('3. Model Write, Readback & Verification Success', () => {
    let storedValue = 'initial code';
    const mockModel = {
      uri: 'inmemory://model/test-1',
      getValue: () => storedValue,
      setValue: (val: string) => {
        storedValue = val;
      },
      getLanguageId: () => 'java',
    };

    const mockEditor = {
      hasTextFocus: () => true,
      getModel: () => mockModel,
      focus: () => {},
    };

    let bridgeResult: any = null;
    const mockWindow: any = {
      monaco: {
        editor: {
          getEditors: () => [mockEditor],
          getModels: () => [mockModel],
        },
      },
      addEventListener: (type: string, fn: Function) => {
        if (type === 'message') mockWindow._listener = fn;
      },
      postMessage: (data: any) => {
        if (data.source === 'CODEPILOT_PAGE_BRIDGE') {
          bridgeResult = data;
        } else if (data.source === 'CODEPILOT_CONTENT' && mockWindow._listener) {
          mockWindow._listener({ source: mockWindow, data });
        }
      },
    };

    (global as any).window = mockWindow;
    delete (mockWindow as any)['codepilot-monaco-page-bridge-active'];
    initMonacoPageBridge();

    const targetCode = 'class Solution {\n  public int minOperations() { return 0; }\n}';
    mockWindow.postMessage({
      source: 'CODEPILOT_CONTENT',
      type: 'CODEPILOT_MONACO_SET',
      id: 'test-req-3',
      payload: { code: targetCode },
    });

    assert.ok(bridgeResult);
    assert.strictEqual(bridgeResult.success, true);
    assert.strictEqual(bridgeResult.message, '✓ Successfully inserted into Monaco Editor');
    assert.strictEqual(bridgeResult.diagnostics.monacoRuntime, 'FOUND');
    assert.strictEqual(bridgeResult.diagnostics.activeEditor, 'FOUND');
    assert.strictEqual(bridgeResult.diagnostics.model, 'FOUND');
    assert.strictEqual(bridgeResult.diagnostics.write, 'PASS');
    assert.strictEqual(bridgeResult.diagnostics.readback, 'PASS');
    assert.strictEqual(bridgeResult.diagnostics.verification, 'PASS');
    assert.strictEqual(storedValue, targetCode);
  });

  test('4. Verification Mismatch when readback does not match written code', () => {
    let storedValue = 'initial code';
    const mockModel = {
      uri: 'inmemory://model/test-2',
      getValue: () => storedValue,
      setValue: (_val: string) => {
        // Read-only model simulation or failing write
        storedValue = 'completely corrupted readback';
      },
    };

    const mockEditor = {
      hasTextFocus: () => true,
      getModel: () => mockModel,
      focus: () => {},
    };

    let bridgeResult: any = null;
    const mockWindow: any = {
      monaco: {
        editor: {
          getEditors: () => [mockEditor],
          getModels: () => [mockModel],
        },
      },
      addEventListener: (type: string, fn: Function) => {
        if (type === 'message') mockWindow._listener = fn;
      },
      postMessage: (data: any) => {
        if (data.source === 'CODEPILOT_PAGE_BRIDGE') {
          bridgeResult = data;
        } else if (data.source === 'CODEPILOT_CONTENT' && mockWindow._listener) {
          mockWindow._listener({ source: mockWindow, data });
        }
      },
    };

    (global as any).window = mockWindow;
    delete (mockWindow as any)['codepilot-monaco-page-bridge-active'];
    initMonacoPageBridge();

    mockWindow.postMessage({
      source: 'CODEPILOT_CONTENT',
      type: 'CODEPILOT_MONACO_SET',
      id: 'test-req-4',
      payload: { code: 'int main() { return 0; }' },
    });

    assert.ok(bridgeResult);
    assert.strictEqual(bridgeResult.success, false);
    assert.strictEqual(bridgeResult.errorCode, 'INSERTION_VERIFICATION_FAILED');
    assert.strictEqual(bridgeResult.diagnostics.verification, 'FAIL');
  });
});

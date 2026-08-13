import { ExecutionStatus } from '../storage/session-store';

export interface ExecutionExtractionResult {
  detected: boolean;
  status: ExecutionStatus;
  errorMessage: string | null;
  testOutput: string | null;
}

export class ExecutionExtractor {
  public static extract(doc: Document): ExecutionExtractionResult {
    const textContent = doc.body ? doc.body.innerText : '';

    // 1. LeetCode / Generic Console Result Detection
    const headerSelectors = [
      '[data-e2e-locator="console-result"]',
      '.text-sd-accent-red',
      '.text-red-500',
      'div[class*="compile-error"]',
      'div[class*="result-state"]',
      'div[class*="test-result"]',
      'div[class*="console-result"]',
      'h4',
      'h3',
      'span',
    ];

    let foundStatus: ExecutionStatus = null;
    let foundErrorMsg: string | null = null;
    let foundTestOutput: string | null = null;

    // Search headers and text nodes for explicit status keywords
    for (const sel of headerSelectors) {
      const els = doc.querySelectorAll(sel);
      for (const el of Array.from(els)) {
        const text = (el.textContent || '').trim();
        if (/compile\s*error/i.test(text)) {
          foundStatus = 'COMPILE_ERROR';
          break;
        } else if (/runtime\s*error/i.test(text)) {
          foundStatus = 'RUNTIME_ERROR';
          break;
        } else if (/wrong\s*answer/i.test(text)) {
          foundStatus = 'WRONG_ANSWER';
          break;
        } else if (/time\s*limit\s*exceeded/i.test(text)) {
          foundStatus = 'TIME_LIMIT_EXCEEDED';
          break;
        } else if (/memory\s*limit\s*exceeded/i.test(text)) {
          foundStatus = 'MEMORY_LIMIT_EXCEEDED';
          break;
        } else if (/accepted|passed|success/i.test(text) && !/submit|run/i.test(text)) {
          foundStatus = 'ACCEPTED';
          break;
        }
      }
      if (foundStatus) break;
    }

    // Fallback search directly in textContent
    if (!foundStatus) {
      if (/Compile Error/i.test(textContent)) foundStatus = 'COMPILE_ERROR';
      else if (/Runtime Error/i.test(textContent)) foundStatus = 'RUNTIME_ERROR';
      else if (/Wrong Answer/i.test(textContent)) foundStatus = 'WRONG_ANSWER';
      else if (/Time Limit Exceeded/i.test(textContent)) foundStatus = 'TIME_LIMIT_EXCEEDED';
      else if (/Memory Limit Exceeded/i.test(textContent)) foundStatus = 'MEMORY_LIMIT_EXCEEDED';
      else if (/\b(Accepted|Code Passed)\b/i.test(textContent)) foundStatus = 'ACCEPTED';
    }

    if (!foundStatus) {
      return {
        detected: false,
        status: null,
        errorMessage: null,
        testOutput: null,
      };
    }

    if (foundStatus === 'ACCEPTED') {
      return {
        detected: true,
        status: 'ACCEPTED',
        errorMessage: null,
        testOutput: null,
      };
    }

    // Extract Error Message text body (e.g., from code/pre/console blocks or red text containers)
    const detailSelectors = [
      'pre',
      'code',
      '[class*="error"]',
      '[class*="console"]',
      '.bg-red-50',
      '.text-red-600',
      '.font-mono',
    ];

    const errorLines: string[] = [];
    for (const sel of detailSelectors) {
      const els = doc.querySelectorAll(sel);
      for (const el of Array.from(els)) {
        const text = (el.textContent || '').trim();
        if (
          text &&
          (text.includes('error:') ||
            text.includes('symbol:') ||
            text.includes('Exception') ||
            text.includes('cannot find symbol') ||
            text.includes('Line ') ||
            text.includes('at '))
        ) {
          errorLines.push(text);
        }
      }
    }

    if (errorLines.length > 0) {
      foundErrorMsg = Array.from(new Set(errorLines)).join('\n');
    } else {
      // Grab snippet of page containing the error keyword
      const errorIdx = textContent.search(/Compile Error|Runtime Error|Wrong Answer|Time Limit Exceeded/i);
      if (errorIdx !== -1) {
        foundErrorMsg = textContent.substring(errorIdx, errorIdx + 600).trim();
      }
    }

    return {
      detected: true,
      status: foundStatus,
      errorMessage: foundErrorMsg || `${foundStatus}: Platform reported execution failure.`,
      testOutput: foundTestOutput,
    };
  }
}

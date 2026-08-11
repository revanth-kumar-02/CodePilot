import { ProblemExample, ExtractionFieldResult } from '../types';
import { TextNormalizer } from '../text-normalizer';

export class ExamplesExtractor {
  public static extract(container: Element, doc?: Document): { examples: ProblemExample[]; fieldResult: ExtractionFieldResult } {
    let examples = this.extractFromElement(container);

    // Fallback: If searching inside container yielded 0 examples, search doc.body
    if (examples.length === 0 && doc && doc.body && container !== doc.body) {
      examples = this.extractFromElement(doc.body);
    }

    if (examples.length > 0) {
      return {
        examples,
        fieldResult: {
          field: 'examples',
          status: 'found',
          confidence: Math.min(0.95, 0.7 + examples.length * 0.1),
          method: 'structured-example-blocks',
        },
      };
    }

    return {
      examples: [],
      fieldResult: {
        field: 'examples',
        status: 'missing',
        confidence: 0.0,
        method: 'none',
      },
    };
  }

  private static extractFromElement(root: Element): ProblemExample[] {
    const examples: ProblemExample[] = [];
    const seen = new Set<string>();

    const addExample = (input: string | null, output: string | null, explanation: string | null) => {
      const normInput = input ? TextNormalizer.normalize(input) : null;
      const normOutput = output ? TextNormalizer.normalize(output) : null;
      const normExp = explanation ? TextNormalizer.normalize(explanation) : null;

      if (normInput || normOutput) {
        const key = `${normInput || ''}||${normOutput || ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          examples.push({ input: normInput, output: normOutput, explanation: normExp });
        }
      }
    };

    // 1. Check all elements (pre, div, p, section) whose text contains both "Input:" and "Output:"
    const candidates = Array.from(root.querySelectorAll('pre, div, p, blockquote, section')).filter(
      (el) => !el.closest('.monaco-editor, .CodeMirror, .ace_editor')
    );

    for (const el of candidates) {
      const text = (el.textContent || '').trim();
      if (text.includes('Input:') && text.includes('Output:')) {
        // Prevent matching huge outer wrapper divs if a child element also has Input: and Output:
        const childMatch = Array.from(el.children).some(
          (child) => child.textContent?.includes('Input:') && child.textContent?.includes('Output:')
        );
        if (childMatch && el.tagName !== 'PRE') continue;

        const inputMatch = text.match(/Input:\s*([\s\S]*?)(?=\s*Output:|\s*Explanation:|$)/i);
        const outputMatch = text.match(/Output:\s*([\s\S]*?)(?=\s*Explanation:|\s*Constraints:|\s*Example|$)/i);
        const expMatch = text.match(/Explanation:\s*([\s\S]*?)(?=\s*Example|\s*Constraints:|$)/i);

        const inputVal = inputMatch ? inputMatch[1] : null;
        const outputVal = outputMatch ? outputMatch[1] : null;
        const expVal = expMatch ? expMatch[1] : null;

        addExample(inputVal, outputVal, expVal);
      }
    }

    if (examples.length > 0) return examples;

    // 2. DOM Label-Value Traversal (strong/b/span labels for Input: and Output:)
    const allEls = Array.from(root.querySelectorAll('div, label, span, p, h4, h5, strong, b'));
    const inputLabels = allEls.filter((el) => {
      const txt = (el.textContent || '').trim().toLowerCase();
      return txt.startsWith('input:') || txt.startsWith('sample input:') || txt === 'input' || txt === 'sample input';
    });

    inputLabels.forEach((labelEl) => {
      const inputVal = this.findValueNearElement(labelEl);
      const parent = labelEl.parentElement?.parentElement || labelEl.parentElement || root;
      const outputLabels = Array.from(parent.querySelectorAll('div, label, span, p, h4, h5, strong, b')).filter((el) => {
        const txt = (el.textContent || '').trim().toLowerCase();
        return txt.startsWith('output:') || txt.startsWith('sample output:') || txt.startsWith('expected output:') || txt === 'output';
      });

      const outputVal = outputLabels.length > 0 ? this.findValueNearElement(outputLabels[0]) : null;

      addExample(inputVal, outputVal, null);
    });

    if (examples.length > 0) return examples;

    // 3. Global Regex Match over container text
    const fullText = root.textContent || '';
    const regex = /Input:\s*([\s\S]*?)\s*Output:\s*([\s\S]*?)(?=\s*Explanation:|\s*Input:|\s*Constraints:|\s*Example\s*\d+:|$)/gi;
    const matches = Array.from(fullText.matchAll(regex));

    matches.forEach((m) => {
      const input = m[1];
      const output = m[2];
      if (input && input.length < 1000 && (output || '').length < 1000) {
        addExample(input, output, null);
      }
    });

    return examples;
  }

  private static extractElementValue(el: Element): string | null {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return TextNormalizer.normalize(el.value);
    }
    const valEl = el.querySelector('input, textarea, pre, code') || el;
    if (valEl instanceof HTMLInputElement || valEl instanceof HTMLTextAreaElement) {
      return TextNormalizer.normalize(valEl.value);
    }
    return TextNormalizer.normalize(valEl.textContent);
  }

  private static findValueNearElement(labelEl: Element): string | null {
    const parent = labelEl.parentElement;
    if (parent) {
      const formControl = parent.querySelector('input, textarea, pre, code, .form-control, [class*="value"], [class*="box"]');
      if (formControl && formControl !== labelEl) {
        return this.extractElementValue(formControl);
      }
    }

    let sibling = labelEl.nextElementSibling;
    while (sibling) {
      const val = this.extractElementValue(sibling);
      if (val && val.length > 0 && !/^expected\s+output/i.test(val)) {
        return val;
      }
      sibling = sibling.nextElementSibling;
    }

    return null;
  }
}

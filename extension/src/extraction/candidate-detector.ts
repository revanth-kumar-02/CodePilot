import { CandidateContainer } from './types';
import { TextNormalizer } from './text-normalizer';

export class CandidateDetector {
  public static findBestContainer(doc?: Document): Element {
    if (!doc || !doc.body) {
      return { querySelectorAll: () => [], textContent: '' } as any;
    }

    // 1. Explicit platform container selectors (LeetCode, HackerRank, Codeforces, LearnLogicify)
    const prioritySelectors = [
      '[data-track-load="description_content"]',
      '.elfjS',
      '[class*="description_content"]',
      '.problem-description',
      '.question-content',
      '.problem-statement',
      '#problem-statement',
      '.qtext',
      '.formulation',
      'main',
      'article',
      '[role="main"]',
    ];

    for (const sel of prioritySelectors) {
      try {
        const el = doc.querySelector(sel);
        if (el && (el.textContent || '').trim().length > 80) {
          return el;
        }
      } catch {
        // Ignore selector errors
      }
    }

    // 2. Score candidate elements
    const candidates = this.getCandidateElements(doc);

    if (candidates.length === 0) {
      return doc.body;
    }

    const scored = candidates.map((el, idx) => ({
      element: el,
      score: this.scoreContainer(el),
      id: `candidate-${idx}`,
    }));

    scored.sort((a, b) => b.score - a.score);

    if (scored[0] && scored[0].score > 5) {
      return scored[0].element;
    }

    return doc.body;
  }

  public static getCandidateContainers(doc?: Document): CandidateContainer[] {
    if (!doc) return [];
    const elements = this.getCandidateElements(doc);
    return elements.map((el, idx) => {
      const headings = Array.from(el.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(
        (h) => h.textContent?.trim() || ''
      );
      const preCount = el.querySelectorAll('pre, code').length;
      const text = TextNormalizer.normalizeInline(el.textContent || '');
      return {
        id: `container-${idx}`,
        tag: el.tagName.toLowerCase(),
        score: this.scoreContainer(el),
        text: text.slice(0, 200),
        headings,
        preCount,
      };
    });
  }

  private static getCandidateElements(doc: Document): Element[] {
    const selectors = [
      '[data-track-load="description_content"]',
      'main',
      'article',
      'section',
      '[role="main"]',
      '.problem-description',
      '.question-content',
      '.problem-statement',
      '#problem-statement',
      '.content-area',
      'div',
    ];

    const elements: Element[] = [];
    const seen = new Set<Element>();

    selectors.forEach((sel) => {
      try {
        const matches = doc.querySelectorAll(sel);
        matches.forEach((el) => {
          if (
            !seen.has(el) &&
            !el.closest('header, nav, footer, aside, .monaco-editor, .CodeMirror') &&
            (el.textContent || '').length > 80
          ) {
            seen.add(el);
            elements.push(el);
          }
        });
      } catch {
        // Ignore selector errors
      }
    });

    return elements;
  }

  private static scoreContainer(el: Element): number {
    let score = 0;
    const text = (el.textContent || '').toLowerCase();

    const keywords = [
      'problem statement',
      'input format',
      'output format',
      'constraints',
      'sample input',
      'sample output',
      'explanation',
      'example',
      'test cases',
      'matrix',
      'output:',
      'input:',
    ];

    keywords.forEach((kw) => {
      if (text.includes(kw)) score += 3;
    });

    const headingCount = el.querySelectorAll('h1, h2, h3, h4, h5').length;
    score += Math.min(headingCount * 2, 10);

    const preCount = el.querySelectorAll('pre, code').length;
    score += Math.min(preCount * 2, 8);

    if (el.querySelector('nav, header, footer')) score -= 5;
    if (text.includes('copyright') || text.includes('all rights reserved')) score -= 3;

    return score;
  }
}

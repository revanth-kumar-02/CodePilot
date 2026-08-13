import { CandidateContainer } from './types';
import { TextNormalizer } from './text-normalizer';

export class CandidateDetector {
  public static findBestContainer(doc?: Document): Element {
    if (!doc || !doc.body) {
      return { querySelectorAll: () => [], textContent: '' } as any;
    }

    // 1. Explicit platform container selectors (LeetCode, HackerRank, Codeforces, GeeksforGeeks, CodeChef, AtCoder, LearnLogicify & LMS Portals)
    const prioritySelectors = [
      '[data-track-load="description_content"]',
      '[data-key="description"]',
      '.elfjS',
      '[class*="description_content"]',
      '[class*="description__"]',
      '.challenge-body-html',
      '.question-text',
      '[class*="question-text"]',
      '[class*="question-body"]',
      '[class*="question_body"]',
      '[class*="question-details"]',
      '[class*="question-card"]',
      '[class*="problem-body"]',
      '[class*="problem-details"]',
      '[class*="problem-description"]',
      '[class*="task-description"]',
      '#question-container',
      '.question-container',
      '.questionContainer',
      '#problem-container',
      '.problem-container',
      '.problemContainer',
      '#question',
      '.markdown-body',
      '.md-content',
      '[data-testid*="question"]',
      '[data-testid*="problem"]',
      '[data-testid*="description"]',
      '[class*="challenge-body"]',
      '[class*="ps-content"]',
      '.question-statement',
      '.problems_problem_content',
      '#task-statement',
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
        if (el && (el.textContent || '').trim().length > 30) {
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

    if (scored[0] && scored[0].score >= 2) {
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
      '.question-body',
      '.question-details',
      '.question-container',
      '#question-container',
      '.problem-container',
      '#problem-container',
      '.problem-description',
      '.task-description',
      '.markdown-body',
      '.card-body',
      'main',
      'article',
      'section',
      '[role="main"]',
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
            !el.closest('header, nav, footer, aside, .monaco-editor, .CodeMirror, .ace_editor') &&
            (el.textContent || '').length > 40
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
      'question',
      'problem',
      'task',
      'description',
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
      if (text.includes(kw)) score += 2;
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

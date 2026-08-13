import { ExtractionFieldResult } from '../types';
import { TextNormalizer } from '../text-normalizer';
import { SectionClassifier } from '../section-classifier';

export class StatementExtractor {
  public static extract(container: Element, doc?: Document): { statement: string; fieldResult: ExtractionFieldResult } {
    let statement = this.extractFromElement(container);

    // Fallback: If container extraction returned statement < 80 chars, search doc.body
    if ((!statement || statement.length < 80) && doc && doc.body && container !== doc.body) {
      const bodyStatement = this.extractFromElement(doc.body);
      if (bodyStatement && bodyStatement.length > (statement ? statement.length : 0)) {
        statement = bodyStatement;
      }
    }

    if (statement && statement.length >= 10) {
      return {
        statement,
        fieldResult: {
          field: 'statement',
          status: 'found',
          confidence: Math.min(0.95, 0.7 + (statement.length > 50 ? 0.2 : 0.1)),
          method: 'semantic-boundary-structural',
        },
      };
    }

    return {
      statement: '',
      fieldResult: {
        field: 'statement',
        status: 'missing',
        confidence: 0.0,
        method: 'none',
      },
    };
  }

  private static extractFromElement(root: Element): string {
    // 1. Explicit Problem Description / Question Containers (must have >30 chars of real problem text)
    const explicitContainers = Array.from(
      root.querySelectorAll('.qtext, .formulation, [data-track-load="description_content"], [data-key="description"], .elfjS, .challenge-body-html, [class*="question-text"], [class*="question-body"], [class*="question-details"], [class*="question-card"], [class*="problem-body"], [class*="problem-details"], [class*="task-description"], #question-container, .question-container, #problem-container, .problem-container, .markdown-body, [data-testid*="question"], [data-testid*="problem"], [data-testid*="description"], [class*="challenge-body"], [class*="ps-content"], .problem-description, .problems_problem_content, #task-statement, .question-statement, .problem-statement, .coding-question')
    );

    if (explicitContainers.length > 0) {
      const parts: string[] = [];
      explicitContainers.forEach((el) => {
        const text = TextNormalizer.normalize(el.textContent);
        if (text && text.length > 30 && !this.isNoise(text)) {
          parts.push(text);
        }
      });
      if (parts.length > 0) {
        return TextNormalizer.normalize(parts.join('\n\n'));
      }
    }

    // 2. Look for explicit Problem Statement / Description Heading
    const headings = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, .section-title'));
    let statementHeading: Element | null = null;

    for (const h of headings) {
      const match = SectionClassifier.classifyHeader(h.textContent || '');
      if (match && match.field === 'statement') {
        statementHeading = h;
        break;
      }
    }

    if (statementHeading) {
      const contentParts: string[] = [];
      let sibling = statementHeading.nextElementSibling;

      while (sibling) {
        const sibHeaderMatch = SectionClassifier.classifyHeader(sibling.textContent || '');
        if (
          sibHeaderMatch &&
          sibHeaderMatch.field !== 'statement' &&
          (sibling.tagName.startsWith('H') || sibling.classList.contains('section-title'))
        ) {
          break;
        }

        const text = TextNormalizer.normalize(sibling.textContent);
        if (text && !this.isNoise(text)) {
          contentParts.push(text);
        }

        sibling = sibling.nextElementSibling;
      }

      if (contentParts.length > 0) {
        const combined = TextNormalizer.normalize(contentParts.join('\n\n'));
        if (combined.length > 30) return combined;
      }
    }

    // 3. Structural extraction from paragraphs, divs, and text elements
    const textNodes = Array.from(root.querySelectorAll('p, div, article, section'));
    const validTexts: string[] = [];
    const seenTexts = new Set<string>();

    for (const p of textNodes) {
      if (p.closest('nav, header, footer, .monaco-editor, .CodeMirror, pre, script, style')) continue;

      const text = TextNormalizer.normalize(p.textContent);
      if (text && text.length > 25 && !this.isNoise(text)) {
        const inline = TextNormalizer.normalizeInline(text);
        if (!seenTexts.has(inline)) {
          seenTexts.add(inline);
          validTexts.push(text);
        }
      }
    }

    if (validTexts.length > 0) {
      return validTexts.join('\n\n');
    }

    // 4. Fallback text slice up to Example 1 or Constraints
    const fullText = (root.textContent || '').trim();
    if (fullText.length > 30) {
      const match = fullText.match(/^([\s\S]*?)(?=\s*Example\s*\d+:|\s*Constraints:|\s*Input:|$)/i);
      if (match && match[1].trim().length > 30) {
        return TextNormalizer.normalize(match[1]);
      }
    }

    return '';
  }

  private static isNoise(text: string): boolean {
    const lower = text.toLowerCase().trim();
    if (lower === 'description' || lower === 'editorial' || lower === 'solutions' || lower === 'submissions') return true;
    if (lower.includes('all rights reserved') || lower.includes('copyright')) return true;
    if (lower.startsWith('run code') || lower.startsWith('submit')) return true;
    return false;
  }
}

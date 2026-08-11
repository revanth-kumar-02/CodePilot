import { ExtractionFieldResult } from '../types';
import { TextNormalizer } from '../text-normalizer';

const GENERIC_TITLES = ['home', 'dashboard', 'coding', 'assessment', 'problem', 'index', 'welcome', 'description', 'editorial', 'solutions', 'submissions', 'code', 'testcase', 'test result'];

export class TitleExtractor {
  public static extract(container: Element, doc?: Document): { title: string; fieldResult: ExtractionFieldResult } {
    // 1. Check for specific problem title heading within container
    const h1s = Array.from(container.querySelectorAll('h1, h2, h3, h4, .problem-title, .title, .qtitle, .question-title, [class*="title"], [class*="Question"]'));
    for (const h of h1s) {
      const text = TextNormalizer.normalizeInline(h.textContent);
      if (text && !this.isGeneric(text)) {
        return {
          title: text,
          fieldResult: {
            field: 'title',
            status: 'found',
            confidence: 0.95,
            method: 'heading-element',
          },
        };
      }
    }

    // 2. Global Document H1 / H2 fallback
    if (doc) {
      const globalHeadings = Array.from(doc.querySelectorAll('h1, h2, h3'));
      for (const h of globalHeadings) {
        const text = TextNormalizer.normalizeInline(h.textContent);
        if (text && !this.isGeneric(text)) {
          return {
            title: text,
            fieldResult: {
              field: 'title',
              status: 'found',
              confidence: 0.88,
              method: 'document-heading',
            },
          };
        }
      }

      // 3. Document Title fallback
      if (doc.title) {
        const cleanTitle = TextNormalizer.normalizeInline(doc.title.split('-')[0].split('|')[0]);
        if (cleanTitle && !this.isGeneric(cleanTitle)) {
          return {
            title: cleanTitle,
            fieldResult: {
              field: 'title',
              status: 'found',
              confidence: 0.75,
              method: 'document-title',
            },
          };
        }
      }
    }

    return {
      title: 'Coding Problem',
      fieldResult: {
        field: 'title',
        status: 'found',
        confidence: 0.5,
        method: 'default-fallback',
      },
    };
  }

  private static isGeneric(title: string): boolean {
    const lower = title.toLowerCase().trim();
    return GENERIC_TITLES.includes(lower) || lower.length < 2;
  }
}

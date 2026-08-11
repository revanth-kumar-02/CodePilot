import { ExtractionFieldResult } from '../types';
import { TextNormalizer } from '../text-normalizer';
import { SectionClassifier } from '../section-classifier';

export class NotesExtractor {
  public static extract(container: Element): { notes: string | null; fieldResult: ExtractionFieldResult } {
    const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, .section-title, strong'));

    for (const h of headings) {
      const match = SectionClassifier.classifyHeader(h.textContent || '');
      if (match && match.field === 'notes') {
        const contentParts: string[] = [];
        let sibling = h.nextElementSibling;

        while (sibling) {
          if (sibling.tagName.startsWith('H') || SectionClassifier.classifyHeader(sibling.textContent || '')) {
            break;
          }
          const text = TextNormalizer.normalize(sibling.textContent);
          if (text) contentParts.push(text);
          sibling = sibling.nextElementSibling;
        }

        if (contentParts.length > 0) {
          return {
            notes: contentParts.join('\n'),
            fieldResult: {
              field: 'notes',
              status: 'found',
              confidence: 0.85,
              method: 'semantic-heading',
            },
          };
        }
      }
    }

    return {
      notes: null,
      fieldResult: {
        field: 'notes',
        status: 'missing',
        confidence: 0.0,
        method: 'none',
      },
    };
  }
}

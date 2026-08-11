import { ExtractionFieldResult } from '../types';
import { TextNormalizer } from '../text-normalizer';
import { SectionClassifier } from '../section-classifier';

export class OutputExtractor {
  public static extract(container: Element): { outputFormat: string | null; fieldResult: ExtractionFieldResult } {
    const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, .section-title, strong, b'));

    for (const h of headings) {
      const text = h.textContent || '';
      const match = SectionClassifier.classifyHeader(text);
      if (match && match.field === 'output' && !text.toLowerCase().includes('sample') && !text.toLowerCase().includes('example')) {
        const contentParts: string[] = [];
        let sibling = h.nextElementSibling || (h.parentElement && h.parentElement.nextElementSibling);

        while (sibling) {
          const sibText = sibling.textContent || '';
          if (sibling.tagName.startsWith('H') || SectionClassifier.classifyHeader(sibText)) {
            break;
          }
          const norm = TextNormalizer.normalize(sibText);
          if (norm) contentParts.push(norm);
          sibling = sibling.nextElementSibling;
        }

        if (contentParts.length > 0) {
          return {
            outputFormat: contentParts.join('\n'),
            fieldResult: {
              field: 'output',
              status: 'found',
              confidence: 0.9,
              method: 'semantic-heading',
            },
          };
        }
      }
    }

    return {
      outputFormat: 'Expected return value or printed output matching example output signatures.',
      fieldResult: {
        field: 'output',
        status: 'found',
        confidence: 0.7,
        method: 'inferred-default',
      },
    };
  }
}

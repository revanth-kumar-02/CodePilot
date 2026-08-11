import { ExtractionFieldResult } from '../types';
import { TextNormalizer } from '../text-normalizer';
import { SectionClassifier } from '../section-classifier';

export class ConstraintsExtractor {
  public static extract(container: Element): { constraints: string | null; fieldResult: ExtractionFieldResult } {
    const elements = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, .section-title, strong, b, p'));

    for (const h of elements) {
      const text = (h.textContent || '').trim();
      const match = SectionClassifier.classifyHeader(text);

      if (
        (match && match.field === 'constraints') ||
        text.toLowerCase().startsWith('constraints:') ||
        text.toLowerCase() === 'constraints'
      ) {
        const contentParts: string[] = [];

        // 1. Check direct next element or parent's next element (e.g. <p><strong>Constraints:</strong></p> <ul>...</ul>)
        let sibling = h.nextElementSibling || (h.parentElement && h.parentElement.nextElementSibling);

        while (sibling) {
          const siblingText = (sibling.textContent || '').trim();
          if (
            sibling.tagName.startsWith('H') ||
            (siblingText && SectionClassifier.classifyHeader(siblingText) && !siblingText.toLowerCase().includes('matrix'))
          ) {
            break;
          }

          // If sibling is a list <ul> or <ol>, extract each <li>
          if (sibling.tagName === 'UL' || sibling.tagName === 'OL') {
            const listItems = Array.from(sibling.querySelectorAll('li')).map((li) => TextNormalizer.normalize(li.textContent));
            contentParts.push(...listItems.filter(Boolean));
          } else {
            const normalizedText = TextNormalizer.normalize(siblingText);
            if (normalizedText) contentParts.push(normalizedText);
          }

          sibling = sibling.nextElementSibling;
        }

        if (contentParts.length > 0) {
          return {
            constraints: contentParts.join('\n'),
            fieldResult: {
              field: 'constraints',
              status: 'found',
              confidence: 0.9,
              method: 'semantic-heading',
            },
          };
        }
      }
    }

    // 2. Structural fallback search for list items with mathematical inequalities
    const listItems = Array.from(container.querySelectorAll('li'));
    const matchingItems: string[] = [];

    for (const li of listItems) {
      const text = (li.textContent || '').trim();
      if (
        text.includes('<=') ||
        text.includes('>=') ||
        text.includes('≤') ||
        text.includes('≥') ||
        text.includes('==') ||
        text.match(/\b\d+\s*<=\s*\w+\s*<=\s*\d+\b/)
      ) {
        const norm = TextNormalizer.normalize(text);
        if (norm) matchingItems.push(norm);
      }
    }

    if (matchingItems.length > 0) {
      return {
        constraints: matchingItems.join('\n'),
        fieldResult: {
          field: 'constraints',
          status: 'found',
          confidence: 0.85,
          method: 'inequality-list-pattern',
        },
      };
    }

    return {
      constraints: null,
      fieldResult: {
        field: 'constraints',
        status: 'missing',
        confidence: 0.0,
        method: 'none',
      },
    };
  }
}

import { ExtractionFieldResult } from '../types';
import { TextNormalizer } from '../text-normalizer';

const KNOWN_LANGUAGES = ['java', 'python', 'c++', 'cpp', 'c', 'javascript', 'typescript', 'rust', 'go', 'golang', 'kotlin', 'swift'];

export class LanguageExtractor {
  public static extract(doc?: Document): { language: string | null; fieldResult: ExtractionFieldResult } {
    if (!doc) {
      return {
        language: null,
        fieldResult: {
          field: 'language',
          status: 'missing',
          confidence: 0.0,
          method: 'none',
        },
      };
    }
    // 1. Language Select Dropdown
    const select = doc.querySelector('select[name*="lang"], select[id*="lang"], .language-select select, select');
    if (select) {
      const selectedOption = (select as HTMLSelectElement).selectedOptions[0];
      const text = TextNormalizer.normalizeInline(selectedOption?.textContent || (select as HTMLSelectElement).value);
      const matched = this.matchLanguage(text);
      if (matched) {
        return {
          language: matched,
          fieldResult: {
            field: 'language',
            status: 'found',
            confidence: 0.95,
            method: 'select-dropdown',
          },
        };
      }
    }

    // 2. Active Tab or Button (e.g., .tab.active, [aria-selected="true"])
    const activeTabs = Array.from(doc.querySelectorAll('.active, [aria-selected="true"], .selected'));
    for (const tab of activeTabs) {
      const text = TextNormalizer.normalizeInline(tab.textContent);
      const matched = this.matchLanguage(text);
      if (matched) {
        return {
          language: matched,
          fieldResult: {
            field: 'language',
            status: 'found',
            confidence: 0.9,
            method: 'active-tab-selector',
          },
        };
      }
    }

    // 3. Editor DOM Mode attribute (e.g. data-mode-id="cpp")
    const monacoMode = doc.querySelector('[data-mode-id]');
    if (monacoMode) {
      const mode = monacoMode.getAttribute('data-mode-id');
      const matched = this.matchLanguage(mode || '');
      if (matched) {
        return {
          language: matched,
          fieldResult: {
            field: 'language',
            status: 'found',
            confidence: 0.92,
            method: 'editor-mode-attribute',
          },
        };
      }
    }

    return {
      language: null,
      fieldResult: {
        field: 'language',
        status: 'missing',
        confidence: 0.0,
        method: 'none',
      },
    };
  }

  private static matchLanguage(rawText: string): string | null {
    const lower = rawText.toLowerCase().trim();
    if (!lower) return null;

    for (const lang of KNOWN_LANGUAGES) {
      if (lower === lang || lower.includes(lang)) {
        if (lang === 'cpp') return 'c++';
        if (lang === 'golang') return 'go';
        return lang;
      }
    }
    return null;
  }
}

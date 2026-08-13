import { Problem, ProblemExtractionResult, ExtractionFieldResult, ProblemExample } from '../types';
import { TextNormalizer } from '../text-normalizer';

export class CodeChefProblemExtractor {
  public static isCodeChef(doc?: Document): boolean {
    if (!doc) return false;
    const hostname = doc.location ? doc.location.hostname : '';
    const href = doc.location ? doc.location.href : '';
    return hostname.includes('codechef.com') || href.includes('codechef.com');
  }

  public static extract(doc: Document): ProblemExtractionResult {
    const startTime = performance.now();
    const fields: ExtractionFieldResult[] = [];
    const url = doc.location ? doc.location.href : '';

    // 1. Locate Problem Container while excluding Editors
    const container = this.findCodeChefContainer(doc);

    // 2. Extract Title
    const title = this.extractTitle(doc, container);
    fields.push({
      field: 'title',
      status: title ? 'found' : 'missing',
      confidence: title ? 0.95 : 0,
      method: 'codechef-dom-title',
    });

    // 3. Extract Statement & Sections
    const containerText = container ? this.getCleanContainerText(container) : '';
    const statement = this.extractStatement(container, containerText);
    fields.push({
      field: 'statement',
      status: statement && statement.length > 50 ? 'found' : 'missing',
      confidence: statement && statement.length > 50 ? 0.95 : 0,
      method: 'codechef-dom-statement',
    });

    const inputFormat = this.extractInputFormat(container, containerText);
    fields.push({
      field: 'input',
      status: inputFormat ? 'found' : 'missing',
      confidence: inputFormat ? 0.9 : 0,
      method: 'codechef-dom-input',
    });

    const outputFormat = this.extractOutputFormat(container, containerText);
    fields.push({
      field: 'output',
      status: outputFormat ? 'found' : 'missing',
      confidence: outputFormat ? 0.9 : 0,
      method: 'codechef-dom-output',
    });

    const constraints = this.extractConstraints(container, containerText);
    fields.push({
      field: 'constraints',
      status: constraints ? 'found' : 'missing',
      confidence: constraints ? 0.9 : 0,
      method: 'codechef-dom-constraints',
    });

    const examples = this.extractExamples(container, containerText);
    fields.push({
      field: 'examples',
      status: examples.length > 0 ? 'found' : 'missing',
      confidence: examples.length > 0 ? 0.9 : 0,
      method: 'codechef-dom-examples',
    });

    // 4. Validation Rule:
    // title exists AND statement exists (>50 chars) AND at least one section exists
    const hasTitle = Boolean(title && title.length > 0);
    const hasStatement = Boolean(statement && statement.length > 50);
    const hasAnySection = Boolean(inputFormat || outputFormat || constraints || examples.length > 0);

    const isValid = hasTitle && hasStatement && hasAnySection;
    const durationMs = Number((performance.now() - startTime).toFixed(2));

    if (!isValid) {
      return {
        status: 'failed',
        problem: null,
        confidence: 0,
        fields,
        warnings: [],
        errors: ['EXTRACTION_INCOMPLETE: Title, statement (>50 chars), and at least one section required.'],
        durationMs,
      };
    }

    const problem: Problem = {
      id: `codechef-${this.slugify(title!)}`,
      title: title!,
      statement: statement!,
      inputFormat: inputFormat || null,
      outputFormat: outputFormat || null,
      constraints: constraints || null,
      examples,
      notes: null,
      language: 'java',
      source: {
        url,
        hostname: 'CodeChef',
        platform: 'CodeChef',
        detectedAt: Date.now(),
      },
      metadata: {
        extractedAt: Date.now(),
        extractionMethod: 'codechef-dom-adapter',
        confidence: 0.95,
        characterCount: statement!.length,
      },
    };

    return {
      status: 'success',
      problem,
      confidence: 0.95,
      fields,
      warnings: [],
      errors: [],
      durationMs,
    };
  }

  private static findCodeChefContainer(doc: Document): Element | null {
    const selectors = [
      '[data-cy="problem-statement"]',
      '._problemStatement_',
      '[class*="problemStatement"]',
      '[class*="problem-statement"]',
      '[class*="statement-container"]',
      '[class*="ProblemStatement"]',
      '.problem-statement',
      '#problem-statement',
      '.m-style-problem-statement',
      '.question-statement',
      '[class*="problemContent"]',
      '.problem-description',
      '.problemBody',
      'main',
      '[role="main"]',
    ];

    for (const sel of selectors) {
      try {
        const els = Array.from(doc.querySelectorAll(sel));
        for (const el of els) {
          // Exclude any editor elements
          if (el.closest('.monaco-editor, .CodeMirror, .cm-editor, textarea, [class*="editor"]')) {
            continue;
          }
          const text = (el.textContent || '').trim();
          if (text.length > 50) {
            return el;
          }
        }
      } catch {
        // Ignore selector errors
      }
    }
    return doc.body;
  }

  private static extractTitle(doc: Document, container: Element | null): string | null {
    // 1. Check DOM elements in problem container
    if (container) {
      const titleSelectors = [
        '[data-cy="problem-name"]',
        '.problem-name',
        '[class*="ProblemName"]',
        '[class*="problem-title"]',
        '.problem-title',
        '._problemTitle_',
        'h1',
        'h2',
        'h3',
      ];

      for (const sel of titleSelectors) {
        const el = container.querySelector(sel);
        if (el) {
          const rawText = el.textContent || '';
          const clean = TextNormalizer.normalizeInline(rawText);
          if (clean && !this.isGenericTitle(clean)) {
            return clean;
          }
        }
      }
    }

    // 2. Global Document Headings
    const globalHeadings = Array.from(doc.querySelectorAll('h1, h2, h3'));
    for (const h of globalHeadings) {
      if (h.closest('.monaco-editor, .CodeMirror, .cm-editor, textarea')) continue;
      const clean = TextNormalizer.normalizeInline(h.textContent || '');
      if (clean && !this.isGenericTitle(clean)) {
        return clean;
      }
    }

    // 3. Document Title parsing
    if (doc.title) {
      let rawTitle = doc.title;
      // e.g., "Print Squares Practice Problem in Java - CodeChef" or "Print Squares | CodeChef"
      rawTitle = rawTitle.split('Practice Problem')[0];
      rawTitle = rawTitle.split('Coding Problem')[0];
      rawTitle = rawTitle.split('Problem |')[0];
      rawTitle = rawTitle.split('| CodeChef')[0];
      rawTitle = rawTitle.split('- CodeChef')[0];
      rawTitle = rawTitle.split('CodeChef')[0];
      const clean = TextNormalizer.normalizeInline(rawTitle);
      if (clean && !this.isGenericTitle(clean)) {
        return clean;
      }
    }

    return null;
  }

  private static extractStatement(container: Element | null, fullText: string): string | null {
    if (!container && !fullText) return null;

    // Remove headers and stop at Input Format / Constraints / Sample
    const cleaned = this.removeUINoise(fullText);

    // Stop at Input Format, Constraints, Example, or Sample
    const boundaryMatch = cleaned.match(/^([\s\S]*?)(?=\n\s*(?:Input\s*Format|Output\s*Format|Constraints|Sample\s*\d|Sample\s*Input|Examples|Explanation)|$)/i);
    let statement = boundaryMatch ? boundaryMatch[1].trim() : cleaned.trim();

    statement = TextNormalizer.normalize(statement);
    if (statement.length > 50) {
      return statement;
    }

    if (cleaned.length > 50) {
      return TextNormalizer.normalize(cleaned);
    }

    return null;
  }

  private static extractInputFormat(container: Element | null, fullText: string): string | null {
    if (container) {
      const headingEls = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, strong, b, div'));
      for (const h of headingEls) {
        const text = (h.textContent || '').trim().toLowerCase();
        if (text === 'input format' || text === 'input' || text.startsWith('input format:')) {
          let content = '';
          let sibling = h.nextElementSibling;
          while (sibling && !this.isHeaderElement(sibling)) {
            content += ' ' + sibling.textContent;
            sibling = sibling.nextElementSibling;
          }
          const clean = TextNormalizer.normalize(content);
          if (clean.length > 5) return clean;
        }
      }
    }

    const match = fullText.match(/(?:Input\s*Format|Input)[:\s\n]+([\s\S]*?)(?=(?:Output\s*Format|Output|Constraints|Sample|Example|$))/i);
    if (match && match[1].trim().length > 5) {
      return TextNormalizer.normalize(match[1]);
    }

    return null;
  }

  private static extractOutputFormat(container: Element | null, fullText: string): string | null {
    if (container) {
      const headingEls = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, strong, b, div'));
      for (const h of headingEls) {
        const text = (h.textContent || '').trim().toLowerCase();
        if (text === 'output format' || text === 'output' || text.startsWith('output format:')) {
          let content = '';
          let sibling = h.nextElementSibling;
          while (sibling && !this.isHeaderElement(sibling)) {
            content += ' ' + sibling.textContent;
            sibling = sibling.nextElementSibling;
          }
          const clean = TextNormalizer.normalize(content);
          if (clean.length > 5) return clean;
        }
      }
    }

    const match = fullText.match(/(?:Output\s*Format|Output)[:\s\n]+([\s\S]*?)(?=(?:Constraints|Sample|Example|Explanation|$))/i);
    if (match && match[1].trim().length > 5) {
      return TextNormalizer.normalize(match[1]);
    }

    return null;
  }

  private static extractConstraints(container: Element | null, fullText: string): string | null {
    if (container) {
      const headingEls = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, strong, b, div'));
      for (const h of headingEls) {
        const text = (h.textContent || '').trim().toLowerCase();
        if (text === 'constraints' || text.startsWith('constraints:')) {
          let content = '';
          let sibling = h.nextElementSibling;
          while (sibling && !this.isHeaderElement(sibling)) {
            content += ' ' + sibling.textContent;
            sibling = sibling.nextElementSibling;
          }
          const clean = TextNormalizer.normalize(content);
          if (clean.length > 3) return clean;
        }
      }
    }

    const match = fullText.match(/Constraints[:\s\n]+([\s\S]*?)(?=(?:Sample|Example|Explanation|$))/i);
    if (match && match[1].trim().length > 3) {
      return TextNormalizer.normalize(match[1]);
    }

    return null;
  }

  private static extractExamples(container: Element | null, fullText: string): ProblemExample[] {
    const examples: ProblemExample[] = [];

    if (container) {
      // 1. Table-based samples (CodeChef often uses tables for Input / Output)
      const tables = Array.from(container.querySelectorAll('table'));
      for (const table of tables) {
        const headers = Array.from(table.querySelectorAll('th')).map((th) => (th.textContent || '').trim().toLowerCase());
        const inputIdx = headers.findIndex((h) => h.includes('input'));
        const outputIdx = headers.findIndex((h) => h.includes('output'));

        if (inputIdx !== -1 && outputIdx !== -1) {
          const rows = Array.from(table.querySelectorAll('tbody tr, tr')).filter((r) => r.querySelectorAll('td').length > 0);
          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells[inputIdx] && cells[outputIdx]) {
              const inVal = TextNormalizer.normalizeInline(cells[inputIdx].textContent || '');
              const outVal = TextNormalizer.normalizeInline(cells[outputIdx].textContent || '');
              if (inVal || outVal) {
                examples.push({
                  input: inVal || '',
                  output: outVal || '',
                  explanation: null,
                });
              }
            }
          }
        }
      }

      if (examples.length > 0) return examples;
    }

    // 2. Text regex scraping for Sample 1 / Sample Input / Sample Output
    const sampleRegex = /Sample\s*(?:Input)?\s*(\d+)?:?[\s\n]*([\s\S]*?)(?:Sample\s*Output\s*\1?:?[\s\n]*([\s\S]*?))?(?=\n\s*Sample|\n\s*Explanation|\n\s*Constraints|$)/gi;
    let match: RegExpExecArray | null;

    while ((match = sampleRegex.exec(fullText)) !== null) {
      const inVal = match[2] ? TextNormalizer.normalizeInline(match[2]) : '';
      const outVal = match[3] ? TextNormalizer.normalizeInline(match[3]) : '';
      if (inVal || outVal) {
        examples.push({
          input: inVal,
          output: outVal,
          explanation: null,
        });
      }
    }

    return examples;
  }

  private static getCleanContainerText(container: Element): string {
    const clone = container.cloneNode(true) as Element;

    // Remove noise elements
    const noiseSelectors = [
      '.monaco-editor',
      '.CodeMirror',
      '.cm-editor',
      'textarea',
      'button',
      'nav',
      'header',
      'footer',
      '[class*="aiTutor"]',
      '[class*="ai-help"]',
      '[class*="AIHelp"]',
      '[class*="submit"]',
      '[class*="sidebar"]',
    ];

    noiseSelectors.forEach((sel) => {
      clone.querySelectorAll(sel).forEach((el) => el.remove());
    });

    return clone.textContent || '';
  }

  private static removeUINoise(text: string): string {
    return text
      .replace(/Switch to AI Tutor Mode/gi, '')
      .replace(/Submit Code/gi, '')
      .replace(/Run Code/gi, '')
      .replace(/Visualize Code/gi, '')
      .replace(/AI Help/gi, '')
      .replace(/Did you like the problem\?/gi, '')
      .replace(/Users found this helpful/gi, '')
      .replace(/Share Problem/gi, '')
      .replace(/Report Problem/gi, '')
      .replace(/Statement\s+Submissions\s+Solution\s+AI Help/gi, '')
      .trim();
  }

  private static isHeaderElement(el: Element): boolean {
    const tag = el.tagName.toLowerCase();
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) return true;
    const text = (el.textContent || '').trim().toLowerCase();
    return ['input format', 'output format', 'constraints', 'sample input', 'sample output', 'examples'].includes(text);
  }

  private static isGenericTitle(title: string): boolean {
    const lower = title.toLowerCase().trim();
    const generic = ['home', 'dashboard', 'statement', 'submissions', 'solution', 'ai help', 'coding problem', 'codechef', 'index'];
    return generic.includes(lower) || lower.length < 2;
  }

  private static slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
}

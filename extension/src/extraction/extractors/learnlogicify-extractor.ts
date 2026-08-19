import { Problem, ProblemExtractionResult, ExtractionFieldResult, ProblemExample } from '../types.ts';

export class LearnLogicifyProblemExtractor {
  public static isLearnLogicify(doc?: Document): boolean {
    if (!doc) return false;
    const href = (doc.location ? doc.location.href : '').toLowerCase();
    const hostname = (doc.location ? doc.location.hostname : '').toLowerCase();
    const title = (doc.title || '').toLowerCase();
    const bodyText = (doc.body ? doc.body.textContent || '' : '').toLowerCase().slice(0, 2000);

    const isUrlMatch =
      hostname.includes('learnlogicify') ||
      hostname.includes('logicify') ||
      href.includes('learnlogicify') ||
      href.includes('logicify');

    const isTitleMatch = title.includes('learnlogicify') || title.includes('logicify');

    const isDomMatch = !!(
      doc.querySelector('[data-platform="learnlogicify"], .learnlogicify-problem, .logicify-problem, [class*="learnlogicify"], [class*="logicify"]') ||
      doc.querySelector('#learnlogicify-root, [data-cy*="learnlogicify"]')
    );

    const isBodyMatch = bodyText.includes('learnlogicify') || bodyText.includes('logicify');

    return isUrlMatch || isTitleMatch || isDomMatch || isBodyMatch;
  }

  public static extract(doc?: Document): ProblemExtractionResult {
    const startTime = performance.now();
    const targetDoc = doc || (typeof document !== 'undefined' ? document : null);

    if (!targetDoc || !targetDoc.body) {
      return {
        status: 'failed',
        problem: null,
        confidence: 0,
        fields: [],
        warnings: [],
        errors: ['NO_DOCUMENT: Document or body unavailable.'],
        durationMs: 0,
      };
    }

    const currentUrl = targetDoc.location ? targetDoc.location.href : 'https://learnlogicify.com';
    const fields: ExtractionFieldResult[] = [];

    // 1. Extract Problem Title
    let title = '';
    const titleSelectors = [
      '[data-cy="problem-title"]',
      '.problem-title',
      '.question-title',
      '#problem-name',
      '.assessment-title',
      'h1',
      'h2.problem-name',
      '.problem-header',
    ];

    for (const sel of titleSelectors) {
      const el = targetDoc.querySelector(sel);
      if (el && el.textContent) {
        const text = el.textContent.trim();
        if (text.length > 2 && text.length < 200) {
          title = text;
          break;
        }
      }
    }

    if (!title && targetDoc.title) {
      const parts = targetDoc.title.split(/[-|–]/);
      title = parts[0].trim();
    }

    if (!title) {
      title = 'LearnLogicify Assessment Problem';
    }

    fields.push({
      field: 'title',
      status: 'found',
      confidence: 0.9,
      method: 'learnlogicify-dom-title',
    });

    // 2. Locate Main Problem Container & Exclude Code Editors
    const containerSelectors = [
      '.problem-container',
      '.question-container',
      '.problem-statement',
      '.problem-description',
      '#problem-statement',
      '.assessment-container',
      'main',
      '[role="main"]',
    ];

    let rawContainer: Element | null = null;
    for (const sel of containerSelectors) {
      const candidate = targetDoc.querySelector(sel);
      if (candidate && (candidate.textContent || '').trim().length >= 50) {
        rawContainer = candidate;
        break;
      }
    }

    if (!rawContainer) {
      rawContainer = targetDoc.body;
    }

    // Clone container to avoid mutating DOM and scrub out editor elements
    const container = rawContainer.cloneNode(true) as Element;
    const editorElements = container.querySelectorAll(
      '.monaco-editor, .CodeMirror, .cm-editor, .ace_editor, textarea, [class*="editor"], [id*="editor"]'
    );
    editorElements.forEach((el) => el.remove());

    const fullContainerText = (container.textContent || '').trim();
    const durationMs = Number((performance.now() - startTime).toFixed(2));

    if (fullContainerText.length < 50) {
      return {
        status: 'failed',
        problem: null,
        confidence: 0,
        fields,
        warnings: [],
        errors: [`EXTRACTION_INCOMPLETE: Extracted text length (${fullContainerText.length}) is under 50 characters.`],
        durationMs,
      };
    }

    fields.push({
      field: 'statement',
      status: 'found',
      confidence: 0.9,
      method: 'learnlogicify-dom-statement',
    });

    // 3. Extract Structured Sections
    let inputFormat: string | null = null;
    let outputFormat: string | null = null;
    let constraints: string | null = null;
    const examples: ProblemExample[] = [];

    const sectionElements = container.querySelectorAll('h2, h3, h4, strong, b, .section-title');
    sectionElements.forEach((heading) => {
      const headingText = (heading.textContent || '').trim().toLowerCase();
      let parentOrNext = heading.nextElementSibling || heading.parentElement;

      if (headingText.includes('input format') || headingText.includes('input description')) {
        inputFormat = (parentOrNext?.textContent || '').trim();
      } else if (headingText.includes('output format') || headingText.includes('output description')) {
        outputFormat = (parentOrNext?.textContent || '').trim();
      } else if (headingText.includes('constraint')) {
        constraints = (parentOrNext?.textContent || '').trim();
      }
    });

    // Extract Examples / Test Cases
    const sampleBlocks = container.querySelectorAll('.sample-test, .example-block, .example, pre, code');
    sampleBlocks.forEach((block) => {
      const text = (block.textContent || '').trim();
      if (text.toLowerCase().includes('input') || text.toLowerCase().includes('output')) {
        const lines = text.split('\n');
        let currentIn = '';
        let currentOut = '';
        let target: 'in' | 'out' | null = null;

        for (const line of lines) {
          const lTrim = line.trim();
          if (lTrim.toLowerCase().startsWith('input:')) {
            target = 'in';
            currentIn += lTrim.replace(/^input:\s*/i, '') + '\n';
          } else if (lTrim.toLowerCase().startsWith('output:')) {
            target = 'out';
            currentOut += lTrim.replace(/^output:\s*/i, '') + '\n';
          } else if (target === 'in') {
            currentIn += line + '\n';
          } else if (target === 'out') {
            currentOut += line + '\n';
          }
        }

        if (currentIn.trim() || currentOut.trim()) {
          examples.push({
            input: currentIn.trim() || null,
            output: currentOut.trim() || null,
            explanation: null,
          });
        }
      }
    });

    fields.push({
      field: 'input',
      status: inputFormat ? 'found' : 'missing',
      confidence: inputFormat ? 0.9 : 0,
      method: 'learnlogicify-dom-input',
    });

    fields.push({
      field: 'output',
      status: outputFormat ? 'found' : 'missing',
      confidence: outputFormat ? 0.9 : 0,
      method: 'learnlogicify-dom-output',
    });

    fields.push({
      field: 'constraints',
      status: constraints ? 'found' : 'missing',
      confidence: constraints ? 0.9 : 0,
      method: 'learnlogicify-dom-constraints',
    });

    fields.push({
      field: 'examples',
      status: examples.length > 0 ? 'found' : 'missing',
      confidence: examples.length > 0 ? 0.9 : 0,
      method: 'learnlogicify-dom-examples',
    });

    // 4. Construct Problem Output
    const problem: Problem = {
      id: `learnlogicify-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title,
      statement: fullContainerText,
      inputFormat,
      outputFormat,
      constraints,
      examples,
      notes: null,
      language: null,
      source: {
        platform: 'LearnLogicify',
        url: currentUrl,
        hostname: targetDoc.location ? targetDoc.location.hostname : 'learnlogicify.com',
        detectedAt: Date.now(),
      },
      metadata: {
        extractedAt: Date.now(),
        extractionMethod: 'learnlogicify-dedicated',
        confidence: 0.95,
        characterCount: fullContainerText.length,
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
}

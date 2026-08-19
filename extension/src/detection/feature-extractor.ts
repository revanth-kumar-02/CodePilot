import { PageSnapshot } from './types';

export class FeatureExtractor {
  public static extractFromDOM(doc: Document = document, win: Window = window): PageSnapshot {
    const location = doc.location || win.location;
    const url = location ? location.href : '';
    const hostname = location ? location.hostname : '';
    const pathname = location ? location.pathname : '';
    const title = doc.title || '';

    // Extract headings (visible ones)
    const headings: string[] = [];
    const headingElements = doc.querySelectorAll('h1, h2, h3, h4');
    headingElements.forEach((el) => {
      const text = el.textContent?.trim();
      if (text && text.length < 150) {
        headings.push(text);
      }
    });

    // Extract visible text sample (first ~2000 chars of body text)
    let visibleTextSample = '';
    if (doc.body) {
      const clone = doc.body.cloneNode(true) as HTMLElement;
      // Remove scripts, styles, inputs to avoid sensitive/irrelevant noise
      const noisy = clone.querySelectorAll('script, style, noscript, svg, input[type="password"], input[type="hidden"]');
      noisy.forEach((node) => node.remove());
      visibleTextSample = (clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 3000);
    }

    // Counts
    const forms = doc.querySelectorAll('form').length;
    const textareas = doc.querySelectorAll('textarea').length;
    const contentEditables = doc.querySelectorAll('[contenteditable="true"]').length;
    const iframes = doc.querySelectorAll('iframe').length;

    // Buttons (text labels)
    const buttons: string[] = [];
    const buttonEls = doc.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]');
    buttonEls.forEach((btn) => {
      const label = (btn.textContent || (btn as HTMLInputElement).value || '').trim();
      if (label && label.length < 50) {
        buttons.push(label);
      }
    });

    // Inputs (labels/placeholders)
    const inputs: string[] = [];
    const inputEls = doc.querySelectorAll('input:not([type="password"]):not([type="hidden"])');
    inputEls.forEach((inp) => {
      const placeholder = (inp as HTMLInputElement).placeholder || (inp as HTMLInputElement).name || '';
      if (placeholder) {
        inputs.push(placeholder);
      }
    });

    // Script hints (presence of monaco, codemirror, ace in window global or script src)
    const scriptHints: string[] = [];
    const scripts = doc.querySelectorAll('script');
    scripts.forEach((scr) => {
      const src = scr.src.toLowerCase();
      if (src.includes('monaco')) scriptHints.push('monaco-script');
      if (src.includes('codemirror')) scriptHints.push('codemirror-script');
      if (src.includes('ace')) scriptHints.push('ace-script');
    });

    // Editor DOM class/attribute hints
    const detectedEditorHints: string[] = [];
    if (doc.querySelector('.monaco-editor, [data-mode-id], .monaco-aria-container')) {
      detectedEditorHints.push('monaco-dom');
    }
    if (doc.querySelector('.CodeMirror, .cm-editor, .cm-content')) {
      detectedEditorHints.push('codemirror-dom');
    }
    if (doc.querySelector('.ace_editor, .ace_content')) {
      detectedEditorHints.push('ace-dom');
    }

    return {
      url,
      hostname,
      pathname,
      title,
      headings,
      visibleTextSample,
      forms,
      textareas,
      contentEditables,
      iframes,
      buttons,
      inputs,
      scriptHints,
      detectedEditorHints,
    };
  }

  public static extractFallbackFromTabState(tabState: { url?: string; title?: string }): PageSnapshot {
    let hostname = '';
    let pathname = '';
    try {
      if (tabState.url) {
        const u = new URL(tabState.url);
        hostname = u.hostname;
        pathname = u.pathname;
      }
    } catch {
      // Ignore URL parsing errors
    }

    const urlLower = (tabState.url || '').toLowerCase();
    const isCodingPlatform =
      urlLower.includes('learnlogicify') ||
      urlLower.includes('logicify') ||
      urlLower.includes('hackerrank.com') ||
      urlLower.includes('leetcode.com') ||
      urlLower.includes('codesignal.com') ||
      urlLower.includes('codechef.com') ||
      urlLower.includes('hackerearth.com') ||
      urlLower.includes('geeksforgeeks.org');

    return {
      url: tabState.url || '',
      hostname,
      pathname,
      title: tabState.title || '',
      headings: tabState.title ? [tabState.title] : [],
      visibleTextSample: isCodingPlatform
        ? `${tabState.title || ''} problem statement sample input sample output constraints run submit`
        : tabState.title || '',
      forms: 0,
      textareas: isCodingPlatform ? 1 : 0,
      contentEditables: 0,
      iframes: 0,
      buttons: isCodingPlatform ? ['Run Code', 'Submit'] : [],
      inputs: [],
      scriptHints: isCodingPlatform ? ['monaco-script'] : [],
      detectedEditorHints: isCodingPlatform ? ['monaco-dom'] : [],
    };
  }
}

export { FeatureExtractor as PageFeatureExtractor };


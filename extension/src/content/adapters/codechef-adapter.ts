import { EditorAdapter, EditorType } from './types';

export class CodeChefAdapter implements EditorAdapter {
  public readonly name = 'CodeChef Adapter';
  public readonly type: EditorType = 'codemirror';

  public detect(): boolean {
    if (typeof document === 'undefined') return false;
    const isCodeChefDomain = window.location.hostname.includes('codechef.com');
    const hasCm = !!(
      document.querySelector('.cm-editor') ||
      document.querySelector('.cm-content') ||
      document.querySelector('.CodeMirror')
    );
    return isCodeChefDomain && hasCm;
  }

  public focus(): void {
    try {
      const cm6Content = document.querySelector('.cm-content') as HTMLElement;
      if (cm6Content) {
        cm6Content.focus();
        return;
      }
      const cm5Textarea = document.querySelector('.CodeMirror textarea') as HTMLTextAreaElement;
      if (cm5Textarea) {
        cm5Textarea.focus();
      }
    } catch {
      // Focus fallback
    }
  }

  public detectLanguage(): string | null {
    try {
      const langSelector = document.querySelector('select[class*="language"]') ||
                           document.querySelector('[data-cy="language-dropdown"]') ||
                           document.querySelector('.cm-editor');
      if (langSelector) {
        const val = (langSelector as HTMLSelectElement).value || langSelector.getAttribute('data-language');
        if (val) return val;
      }
    } catch {
      // Ignore
    }
    return null;
  }

  public getValue(): string {
    try {
      const cm5Element = document.querySelector('.CodeMirror') as unknown as { CodeMirror?: { getValue?: () => string } };
      if (cm5Element?.CodeMirror?.getValue) {
        return cm5Element.CodeMirror.getValue() || '';
      }

      const cm6Content = document.querySelector('.cm-content');
      if (cm6Content) {
        return cm6Content.textContent || '';
      }
    } catch {
      // Ignore
    }
    return '';
  }

  public setValue(code: string): boolean {
    try {
      this.focus();

      // CodeMirror 5
      const cm5Element = document.querySelector('.CodeMirror') as unknown as { CodeMirror?: { setValue?: (v: string) => void } };
      if (cm5Element?.CodeMirror?.setValue) {
        cm5Element.CodeMirror.setValue(code);
        return true;
      }

      // CodeMirror 6 / DOM Selection + execCommand atomic replace
      const cm6Content = document.querySelector('.cm-content') as HTMLElement;
      if (cm6Content) {
        cm6Content.focus();

        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(cm6Content);
          selection.removeAllRanges();
          selection.addRange(range);
        }

        const success = document.execCommand('insertText', false, code);
        if (!success) {
          cm6Content.textContent = code;
        }

        cm6Content.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
    } catch (e) {
      console.warn('[CodePilot][CodeChefAdapter] Set value failed:', e);
    }
    return false;
  }
}

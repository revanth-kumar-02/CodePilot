import { EditorAdapter, EditorType } from './types';

export class CodeMirrorAdapter implements EditorAdapter {
  public readonly name = 'CodeMirror Adapter';
  public readonly type: EditorType = 'codemirror';

  public detect(): boolean {
    if (typeof document === 'undefined') return false;
    return !!(
      document.querySelector('.CodeMirror') ||
      document.querySelector('.cm-editor') ||
      document.querySelector('.cm-content')
    );
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
      const langAttr = document.querySelector('.cm-editor')?.getAttribute('data-language') ||
                       document.querySelector('.CodeMirror')?.getAttribute('data-lang');
      if (langAttr) return langAttr;
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

      // CodeMirror 6 / DOM execCommand fallback
      const cm6Content = document.querySelector('.cm-content') as HTMLElement;
      if (cm6Content) {
        cm6Content.focus();
        document.execCommand('selectAll', false);
        document.execCommand('insertText', false, code);
        cm6Content.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }

      const cmTextarea = document.querySelector('.CodeMirror textarea') as HTMLTextAreaElement;
      if (cmTextarea) {
        cmTextarea.focus();
        cmTextarea.value = code;
        cmTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
    } catch (e) {
      console.warn('[CodePilot][CodeMirrorAdapter] Set value failed:', e);
    }
    return false;
  }
}

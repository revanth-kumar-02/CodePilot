import { EditorAdapter, EditorType } from './types';

export class TextareaAdapter implements EditorAdapter {
  public readonly name = 'Textarea / Input Adapter';
  public readonly type: EditorType = 'textarea';

  public detect(): boolean {
    if (typeof document === 'undefined') return false;
    return !!document.querySelector('textarea');
  }

  public focus(): void {
    try {
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
      }
    } catch {
      // Focus fallback
    }
  }

  public detectLanguage(): string | null {
    return null;
  }

  public getValue(): string {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    return textarea ? textarea.value || '' : '';
  }

  public setValue(code: string): boolean {
    try {
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
        textarea.value = code;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    } catch (e) {
      console.warn('[CodePilot][TextareaAdapter] Set value failed:', e);
    }
    return false;
  }
}

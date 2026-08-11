import { EditorAdapter, EditorType } from './types';

export class ContentEditableAdapter implements EditorAdapter {
  public readonly name = 'ContentEditable Adapter';
  public readonly type: EditorType = 'contenteditable';

  public detect(): boolean {
    if (typeof document === 'undefined') return false;
    return !!document.querySelector('[contenteditable="true"]');
  }

  public focus(): void {
    try {
      const editable = document.querySelector('[contenteditable="true"]') as HTMLElement;
      if (editable) {
        editable.focus();
      }
    } catch {
      // Focus fallback
    }
  }

  public detectLanguage(): string | null {
    return null;
  }

  public getValue(): string {
    const editable = document.querySelector('[contenteditable="true"]');
    return editable ? editable.textContent || '' : '';
  }

  public setValue(code: string): boolean {
    try {
      const editable = document.querySelector('[contenteditable="true"]') as HTMLElement;
      if (editable) {
        editable.focus();
        editable.textContent = code;
        editable.dispatchEvent(new Event('input', { bubbles: true }));
        editable.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    } catch (e) {
      console.warn('[CodePilot][ContentEditableAdapter] Set value failed:', e);
    }
    return false;
  }
}

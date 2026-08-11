import { EditorAdapter, EditorType } from './types';

export class AceAdapter implements EditorAdapter {
  public readonly name = 'Ace Editor Adapter';
  public readonly type: EditorType = 'ace';

  public detect(): boolean {
    if (typeof document === 'undefined') return false;
    return !!(
      document.querySelector('.ace_editor') ||
      (window as unknown as { ace?: unknown }).ace
    );
  }

  public focus(): void {
    try {
      const textarea = document.querySelector('.ace_editor textarea.ace_text-input') as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
      }
    } catch {
      // Focus fallback
    }
  }

  public detectLanguage(): string | null {
    try {
      const aceElement = document.querySelector('.ace_editor');
      const aceGlobal = (window as unknown as { ace?: { edit?: (el: Element) => { getSession?: () => { getMode?: () => { $id?: string } } } } }).ace;
      if (aceElement && aceGlobal?.edit) {
        const editor = aceGlobal.edit(aceElement);
        const modeId = editor?.getSession?.()?.getMode?.()?.$id;
        if (modeId) {
          return modeId.replace('ace/mode/', '');
        }
      }
    } catch {
      // Ignore
    }
    return null;
  }

  public getValue(): string {
    try {
      const aceElement = document.querySelector('.ace_editor');
      const aceGlobal = (window as unknown as { ace?: { edit?: (el: Element) => { getValue?: () => string } } }).ace;
      if (aceElement && aceGlobal?.edit) {
        const editor = aceGlobal.edit(aceElement);
        if (editor?.getValue) return editor.getValue();
      }
    } catch {
      // Ignore
    }
    return '';
  }

  public setValue(code: string): boolean {
    try {
      this.focus();

      const aceElement = document.querySelector('.ace_editor');
      const aceGlobal = (window as unknown as { ace?: { edit?: (el: Element) => { setValue?: (v: string, p?: number) => void } } }).ace;
      if (aceElement && aceGlobal?.edit) {
        const editor = aceGlobal.edit(aceElement);
        if (editor?.setValue) {
          editor.setValue(code, -1);
          return true;
        }
      }

      const textarea = document.querySelector('.ace_editor textarea.ace_text-input') as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
        textarea.value = code;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
    } catch (e) {
      console.warn('[CodePilot][AceAdapter] Set value failed:', e);
    }
    return false;
  }
}

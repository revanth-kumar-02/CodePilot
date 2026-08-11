import { Logger } from '../shared/utils/logger';
import { WindowRuntimeState } from './runtime-state';
import { RuntimeEventEmitter } from './runtime-events';

const logger = new Logger('WindowManager');

export class WindowManager {
  private windows = new Map<number, WindowRuntimeState>();
  private emitter: RuntimeEventEmitter;

  constructor(emitter: RuntimeEventEmitter) {
    this.emitter = emitter;
    this.initChromeListeners();
  }

  public registerWindow(win: chrome.windows.Window): WindowRuntimeState | null {
    if (win.id === undefined) return null;

    const newState: WindowRuntimeState = {
      windowId: win.id,
      focused: Boolean(win.focused),
      type: win.type,
    };

    this.windows.set(win.id, newState);
    logger.info(`Window registered: ${win.id} (focused: ${newState.focused})`);
    this.emitter.emit('WINDOW_CREATED', newState);
    return newState;
  }

  public removeWindow(windowId: number): void {
    if (this.windows.has(windowId)) {
      this.windows.delete(windowId);
      logger.info(`Window removed: ${windowId}`);
      this.emitter.emit('WINDOW_REMOVED', windowId);
    }
  }

  public getWindow(windowId: number): WindowRuntimeState | undefined {
    return this.windows.get(windowId);
  }

  public getAllWindows(): WindowRuntimeState[] {
    return Array.from(this.windows.values());
  }

  public setFocusedWindow(focusedWindowId: number): void {
    for (const [winId, winState] of this.windows.entries()) {
      const isFocused = winId === focusedWindowId;
      if (winState.focused !== isFocused) {
        this.windows.set(winId, {
          ...winState,
          focused: isFocused,
        });
      }
    }

    if (focusedWindowId !== chrome.windows.WINDOW_ID_NONE) {
      logger.info(`Window focused: ${focusedWindowId}`);
      this.emitter.emit('WINDOW_FOCUSED', focusedWindowId);
    }
  }

  private initChromeListeners(): void {
    if (typeof chrome === 'undefined' || !chrome.windows) return;

    chrome.windows.onCreated.addListener((win) => {
      this.registerWindow(win);
    });

    chrome.windows.onRemoved.addListener((windowId) => {
      this.removeWindow(windowId);
    });

    chrome.windows.onFocusChanged.addListener((windowId) => {
      this.setFocusedWindow(windowId);
    });
  }
}

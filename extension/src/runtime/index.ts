import { Logger } from '../shared/utils/logger';
import { TabManager } from './tab-manager';
import { WindowManager } from './window-manager';
import { NavigationManager } from './navigation-manager';
import { ContentScriptManager } from './content-script-manager';
import { RuntimeEventEmitter } from './runtime-events';

const logger = new Logger('Runtime');

export class RuntimeEngine {
  public emitter: RuntimeEventEmitter;
  public tabManager: TabManager;
  public windowManager: WindowManager;
  public navigationManager: NavigationManager;
  public contentScriptManager: ContentScriptManager;

  constructor() {
    this.emitter = new RuntimeEventEmitter();
    this.tabManager = new TabManager(this.emitter);
    this.windowManager = new WindowManager(this.emitter);
    this.navigationManager = new NavigationManager(this.tabManager, this.emitter);
    this.contentScriptManager = new ContentScriptManager(this.tabManager, this.emitter);
  }

  public async initialize(): Promise<void> {
    logger.info('Initializing browser runtime');

    if (typeof chrome === 'undefined' || !chrome.windows || !chrome.tabs) {
      logger.warn('Chrome APIs unavailable; runtime running in fallback mode');
      return;
    }

    try {
      // 1. Query current windows
      const windows = await chrome.windows.getAll({ populate: false });
      logger.info(`Found ${windows.length} windows`);
      windows.forEach((win) => this.windowManager.registerWindow(win));

      // 2. Query current tabs
      const tabs = await chrome.tabs.query({});
      logger.info(`Found ${tabs.length} tabs`);
      tabs.forEach((tab) => this.tabManager.registerTab(tab));

      logger.info('Runtime initialized');
    } catch (error) {
      logger.error('Failed to initialize runtime from Chrome APIs:', error);
    }
  }
}

export { RuntimeEngine as ExtensionRuntime };


import { Logger } from '../shared/utils/logger';
import { RuntimeEngine } from '../runtime';
import { MessageRouter } from '../messaging/message-router';

const logger = new Logger('Background');

class BackgroundServiceWorker {
  private runtime: RuntimeEngine;
  private router: MessageRouter;

  constructor() {
    this.runtime = new RuntimeEngine();
    this.router = new MessageRouter(this.runtime);
    this.init();
  }

  private async init(): Promise<void> {
    await this.runtime.initialize();
    this.initListeners();
    logger.info('Background Service Worker initialized with RuntimeEngine & MessageRouter');
  }

  private initListeners(): void {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      return;
    }

    // Single central message listener routing to MessageRouter
    chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
      (async () => {
        try {
          await this.router.route(message, sender, sendResponse);
        } catch (error) {
          logger.error('Error routing message in BackgroundServiceWorker:', error);
          sendResponse({
            code: 'RUNTIME_ERROR',
            message: error instanceof Error ? error.message : 'Unknown background routing error',
          });
        }
      })();
      return true; // Keep message channel open for asynchronous sendResponse calls
    });
  }
}

// Instantiate background service worker
new BackgroundServiceWorker();

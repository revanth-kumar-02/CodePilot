import { Logger } from '../shared/utils/logger';
import { TabManager } from './tab-manager';
import { RuntimeEventEmitter } from './runtime-events';
import { ContentScriptAckResponse } from '../shared/types/messages';

const logger = new Logger('ContentScriptManager');

export class ContentScriptManager {
  private tabManager: TabManager;
  private emitter: RuntimeEventEmitter;

  constructor(tabManager: TabManager, emitter: RuntimeEventEmitter) {
    this.tabManager = tabManager;
    this.emitter = emitter;
  }

  public handleContentScriptReady(tabId: number, timestamp: number): ContentScriptAckResponse {
    const existing = this.tabManager.getTab(tabId);

    if (existing) {
      this.tabManager.updateTab(tabId, {
        contentScript: 'ready',
      });
      logger.info(`Tab ${tabId} content script registered as READY`);
    } else {
      logger.warn(`Received CONTENT_SCRIPT_READY for untracked tab ${tabId}`);
    }

    this.emitter.emit('CONTENT_SCRIPT_READY', { tabId, timestamp });

    return {
      type: 'CONTENT_SCRIPT_ACK',
      timestamp: Date.now(),
    };
  }

  public markUnavailable(tabId: number, reason: string): void {
    const existing = this.tabManager.getTab(tabId);
    if (existing) {
      this.tabManager.updateTab(tabId, {
        contentScript: 'unavailable',
      });
      logger.info(`Tab ${tabId} content script marked as UNAVAILABLE: ${reason}`);
      this.emitter.emit('CONTENT_SCRIPT_UNAVAILABLE', { tabId, reason });
    }
  }

  public async pingContentScript(tabId: number): Promise<boolean> {
    const tab = this.tabManager.getTab(tabId);
    if (!tab) return false;

    if (this.tabManager.isRestrictedUrl(tab.url)) {
      this.markUnavailable(tabId, 'Restricted browser page');
      return false;
    }

    if (typeof chrome === 'undefined' || !chrome.tabs) return false;

    return new Promise<boolean>((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: 'PING_CONTENT_SCRIPT' }, (response) => {
        const error = chrome.runtime.lastError;
        if (error || !response || !response.ready) {
          this.markUnavailable(tabId, 'Script injection unavailable or tab un-responsive');
          resolve(false);
        } else {
          this.tabManager.updateTab(tabId, { contentScript: 'ready' });
          resolve(true);
        }
      });
    });
  }
}

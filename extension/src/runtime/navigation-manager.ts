import { Logger } from '../shared/utils/logger';
import { TabManager } from './tab-manager';
import { RuntimeEventEmitter } from './runtime-events';

const logger = new Logger('Navigation');

export class NavigationManager {
  private tabManager: TabManager;

  constructor(tabManager: TabManager, _emitter: RuntimeEventEmitter) {
    this.tabManager = tabManager;
    this.initListeners();
  }

  private initListeners(): void {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    if (chrome.tabs.onReplaced) {
      chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
        logger.info(`Tab replaced: ${removedTabId} -> ${addedTabId}`);
        this.tabManager.removeTab(removedTabId);
        chrome.tabs.get(addedTabId, (tab) => {
          if (tab) {
            this.tabManager.registerTab(tab);
          }
        });
      });
    }

    if (chrome.webNavigation) {
      chrome.webNavigation.onCommitted.addListener((details) => {
        if (details.frameId === 0) {
          logger.info(`Navigation committed on tab ${details.tabId} (${details.transitionType})`);
          this.handleTabNavigation(details.tabId, details.url);
        }
      });

      chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
        if (details.frameId === 0) {
          logger.info(`SPA navigation on tab ${details.tabId} to ${details.url}`);
          this.handleTabNavigation(details.tabId, details.url);
        }
      });
    }
  }

  public handleTabNavigation(tabId: number, newUrl: string): void {
    const existing = this.tabManager.getTab(tabId);
    if (!existing) return;

    const isRestricted = this.tabManager.isRestrictedUrl(newUrl);

    this.tabManager.updateTab(tabId, {
      url: newUrl,
      status: 'loading',
      contentScript: isRestricted ? 'unavailable' : 'unknown',
    });
  }
}

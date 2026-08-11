import { Logger } from '../shared/utils/logger';
import { TabRuntimeState } from './runtime-state';
import { RuntimeEventEmitter } from './runtime-events';

const logger = new Logger('TabManager');

export class TabManager {
  private tabs = new Map<number, TabRuntimeState>();
  private activeTabIdByWindow = new Map<number, number>();
  private emitter: RuntimeEventEmitter;

  constructor(emitter: RuntimeEventEmitter) {
    this.emitter = emitter;
    this.initChromeListeners();
  }

  public isRestrictedUrl(url?: string): boolean {
    if (!url) return true;
    const restrictedPrefixes = [
      'chrome://',
      'chrome-extension://',
      'chrome-search://',
      'edge://',
      'about:',
      'view-source:',
      'https://chrome.google.com/webstore',
      'https://chromewebstore.google.com',
    ];
    return restrictedPrefixes.some((prefix) => url.startsWith(prefix));
  }

  public registerTab(tab: chrome.tabs.Tab): TabRuntimeState | null {
    if (tab.id === undefined) return null;

    const url = tab.url || tab.pendingUrl || '';
    const unavailable = this.isRestrictedUrl(url);

    const newState: TabRuntimeState = {
      tabId: tab.id,
      windowId: tab.windowId,
      url,
      title: tab.title || '',
      active: Boolean(tab.active),
      status: tab.status === 'loading' ? 'loading' : 'ready',
      contentScript: unavailable ? 'unavailable' : 'unknown',
      lastUpdated: Date.now(),
    };

    this.tabs.set(tab.id, newState);

    if (tab.active) {
      this.setActiveTabForWindow(tab.windowId, tab.id);
    }

    logger.info(`Tab created/registered: ${tab.id}`);
    this.emitter.emit('TAB_CREATED', newState);
    return newState;
  }

  public updateTab(tabId: number, changes: Partial<TabRuntimeState>): TabRuntimeState | null {
    const existing = this.tabs.get(tabId);
    if (!existing) return null;

    const url = changes.url !== undefined ? changes.url : existing.url;
    const isRestricted = this.isRestrictedUrl(url);

    const updatedState: TabRuntimeState = {
      ...existing,
      ...changes,
      url,
      contentScript: isRestricted ? 'unavailable' : changes.contentScript || existing.contentScript,
      lastUpdated: Date.now(),
    };

    this.tabs.set(tabId, updatedState);
    logger.info(`Tab updated: ${tabId}`);
    this.emitter.emit('TAB_UPDATED', updatedState);
    return updatedState;
  }

  public removeTab(tabId: number): void {
    if (this.tabs.has(tabId)) {
      this.tabs.delete(tabId);
      logger.info(`Tab removed: ${tabId}`);
      this.emitter.emit('TAB_REMOVED', tabId);
    }
  }

  public getTab(tabId: number): TabRuntimeState | undefined {
    return this.tabs.get(tabId);
  }

  public getAllTabs(): TabRuntimeState[] {
    return Array.from(this.tabs.values());
  }

  public getActiveTab(): TabRuntimeState | null {
    for (const tab of this.tabs.values()) {
      if (tab.active) {
        return tab;
      }
    }
    return null;
  }

  public async syncActiveTab(): Promise<TabRuntimeState | null> {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      return this.getActiveTab();
    }

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (activeTab && activeTab.id !== undefined) {
        let state = this.tabs.get(activeTab.id);
        if (!state) {
          const registered = this.registerTab(activeTab);
          if (registered) state = registered;
        } else {
          this.setActiveTabForWindow(activeTab.windowId, activeTab.id);
          if (activeTab.url && activeTab.url !== state.url) {
            const updated = this.updateTab(activeTab.id, { url: activeTab.url, title: activeTab.title || state.title });
            if (updated) state = updated;
          }
        }
        return state || this.getActiveTab() || null;
      }
    } catch (error) {
      logger.warn('Failed to sync active tab with Chrome API:', error);
    }
    return this.getActiveTab();
  }

  public setActiveTabForWindow(windowId: number, activeTabId: number): void {
    this.activeTabIdByWindow.set(windowId, activeTabId);

    // Update active flag across tabs in this window
    for (const [tabId, tabState] of this.tabs.entries()) {
      if (tabState.windowId === windowId) {
        const isActive = tabId === activeTabId;
        if (tabState.active !== isActive) {
          this.tabs.set(tabId, {
            ...tabState,
            active: isActive,
            lastUpdated: Date.now(),
          });
        }
      }
    }

    logger.info(`Tab activated: ${activeTabId} in window ${windowId}`);
    this.emitter.emit('TAB_ACTIVATED', { tabId: activeTabId, windowId });
  }

  private initChromeListeners(): void {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    chrome.tabs.onCreated.addListener((tab) => {
      this.registerTab(tab);
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
      this.removeTab(tabId);
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      const existing = this.tabs.get(tabId);
      if (!existing) {
        this.registerTab(tab);
        return;
      }

      const updates: Partial<TabRuntimeState> = {};
      if (changeInfo.url) updates.url = changeInfo.url;
      if (changeInfo.title) updates.title = changeInfo.title;
      if (changeInfo.status) {
        updates.status = changeInfo.status === 'loading' ? 'loading' : 'ready';
        if (changeInfo.status === 'loading') {
          // Reset content script state on navigation load
          const newUrl = changeInfo.url || existing.url;
          updates.contentScript = this.isRestrictedUrl(newUrl) ? 'unavailable' : 'loading';
        }
      }

      this.updateTab(tabId, updates);
    });

    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.setActiveTabForWindow(activeInfo.windowId, activeInfo.tabId);
    });
  }
}

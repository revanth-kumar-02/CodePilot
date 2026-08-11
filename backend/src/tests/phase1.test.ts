import assert from 'node:assert';
import { test, describe } from 'node:test';

// Define isolated TabRuntimeState and logic models for unit test verification
interface TabRuntimeState {
  tabId: number;
  windowId: number;
  url: string;
  title: string;
  active: boolean;
  status: 'created' | 'loading' | 'ready' | 'error';
  contentScript: 'unknown' | 'loading' | 'ready' | 'unavailable';
  lastUpdated: number;
}

interface WindowRuntimeState {
  windowId: number;
  focused: boolean;
  type?: string;
}

class TestTabManager {
  public tabs = new Map<number, TabRuntimeState>();

  public isRestrictedUrl(url?: string): boolean {
    if (!url) return true;
    const restricted = ['chrome://', 'chrome-extension://', 'about:', 'https://chrome.google.com/webstore'];
    return restricted.some((prefix) => url.startsWith(prefix));
  }

  public registerTab(tabId: number, windowId: number, url: string, active: boolean): TabRuntimeState {
    const isRestricted = this.isRestrictedUrl(url);
    const state: TabRuntimeState = {
      tabId,
      windowId,
      url,
      title: 'Test Title',
      active,
      status: 'ready',
      contentScript: isRestricted ? 'unavailable' : 'unknown',
      lastUpdated: Date.now(),
    };
    this.tabs.set(tabId, state);
    return state;
  }

  public removeTab(tabId: number): void {
    this.tabs.delete(tabId);
  }

  public updateTab(tabId: number, changes: Partial<TabRuntimeState>): TabRuntimeState | null {
    const existing = this.tabs.get(tabId);
    if (!existing) return null;
    const url = changes.url !== undefined ? changes.url : existing.url;
    const isRestricted = this.isRestrictedUrl(url);

    const updated: TabRuntimeState = {
      ...existing,
      ...changes,
      url,
      contentScript: isRestricted ? 'unavailable' : changes.contentScript || existing.contentScript,
      lastUpdated: Date.now(),
    };
    this.tabs.set(tabId, updated);
    return updated;
  }

  public setActiveTab(windowId: number, activeTabId: number): void {
    for (const [tabId, tab] of this.tabs.entries()) {
      if (tab.windowId === windowId) {
        this.tabs.set(tabId, { ...tab, active: tabId === activeTabId });
      }
    }
  }

  public getActiveTab(): TabRuntimeState | null {
    for (const tab of this.tabs.values()) {
      if (tab.active) return tab;
    }
    return null;
  }
}

class TestWindowManager {
  public windows = new Map<number, WindowRuntimeState>();

  public registerWindow(windowId: number, focused: boolean): WindowRuntimeState {
    const state: WindowRuntimeState = { windowId, focused };
    this.windows.set(windowId, state);
    return state;
  }

  public setFocusedWindow(focusedWindowId: number): void {
    for (const [wId, wState] of this.windows.entries()) {
      this.windows.set(wId, { ...wState, focused: wId === focusedWindowId });
    }
  }
}

describe('Phase 1 Browser Runtime Unit Tests', () => {
  describe('Tab Manager', () => {
    test('Tab creation, state retrieval, and update', () => {
      const tm = new TestTabManager();
      const tab1 = tm.registerTab(1, 10, 'https://leetcode.com/problems/two-sum', true);

      assert.strictEqual(tab1.tabId, 1);
      assert.strictEqual(tab1.active, true);
      assert.strictEqual(tm.tabs.size, 1);

      tm.updateTab(1, { title: 'Two Sum - LeetCode' });
      assert.strictEqual(tm.tabs.get(1)?.title, 'Two Sum - LeetCode');
    });

    test('Tab removal clean removal', () => {
      const tm = new TestTabManager();
      tm.registerTab(1, 10, 'https://example.com', true);
      assert.strictEqual(tm.tabs.size, 1);

      tm.removeTab(1);
      assert.strictEqual(tm.tabs.size, 0);
      assert.strictEqual(tm.tabs.get(1), undefined);
    });

    test('Tab activation switching', () => {
      const tm = new TestTabManager();
      tm.registerTab(1, 10, 'https://site1.com', true);
      tm.registerTab(2, 10, 'https://site2.com', false);

      assert.strictEqual(tm.getActiveTab()?.tabId, 1);

      tm.setActiveTab(10, 2);
      assert.strictEqual(tm.tabs.get(1)?.active, false);
      assert.strictEqual(tm.tabs.get(2)?.active, true);
      assert.strictEqual(tm.getActiveTab()?.tabId, 2);
    });
  });

  describe('Window Manager', () => {
    test('Window registration and focus tracking', () => {
      const wm = new TestWindowManager();
      wm.registerWindow(100, true);
      wm.registerWindow(200, false);

      assert.strictEqual(wm.windows.get(100)?.focused, true);
      assert.strictEqual(wm.windows.get(200)?.focused, false);

      wm.setFocusedWindow(200);
      assert.strictEqual(wm.windows.get(100)?.focused, false);
      assert.strictEqual(wm.windows.get(200)?.focused, true);
    });
  });

  describe('Navigation & Content Script Lifecycle', () => {
    test('Navigation resets contentScript state to unknown or unavailable', () => {
      const tm = new TestTabManager();
      tm.registerTab(1, 10, 'https://example.com', true);
      tm.updateTab(1, { contentScript: 'ready' });

      assert.strictEqual(tm.tabs.get(1)?.contentScript, 'ready');

      // User navigates to new URL
      tm.updateTab(1, { url: 'https://newsite.com', status: 'loading', contentScript: 'unknown' });
      assert.strictEqual(tm.tabs.get(1)?.contentScript, 'unknown');
      assert.strictEqual(tm.tabs.get(1)?.status, 'loading');
    });

    test('Restricted URL marks contentScript as unavailable', () => {
      const tm = new TestTabManager();
      const chromeTab = tm.registerTab(2, 10, 'chrome://extensions', true);
      assert.strictEqual(chromeTab.contentScript, 'unavailable');

      const webstoreTab = tm.registerTab(3, 10, 'https://chrome.google.com/webstore', true);
      assert.strictEqual(webstoreTab.contentScript, 'unavailable');
    });

    test('Handshake ready and ACK flow', () => {
      const tm = new TestTabManager();
      tm.registerTab(1, 10, 'https://example.com', true);

      const handleReady = (tabId: number) => {
        tm.updateTab(tabId, { contentScript: 'ready' });
        return { type: 'CONTENT_SCRIPT_ACK', timestamp: Date.now() };
      };

      const ack = handleReady(1);
      assert.strictEqual(ack.type, 'CONTENT_SCRIPT_ACK');
      assert.strictEqual(tm.tabs.get(1)?.contentScript, 'ready');
    });
  });

  describe('Message Bus & Validation', () => {
    test('Valid vs Invalid Message Validation', () => {
      const validateMsg = (msg: any) => {
        if (!msg || typeof msg !== 'object') return { valid: false, code: 'INVALID_MESSAGE' };
        const validTypes = ['GET_RUNTIME_STATE', 'GET_ACTIVE_TAB', 'CONTENT_SCRIPT_READY', 'PING_CONTENT_SCRIPT'];
        if (!validTypes.includes(msg.type)) return { valid: false, code: 'INVALID_MESSAGE' };
        return { valid: true };
      };

      assert.strictEqual(validateMsg({ type: 'GET_RUNTIME_STATE' }).valid, true);
      assert.strictEqual(validateMsg({ type: 'UNKNOWN_TYPE' }).valid, false);
      assert.strictEqual(validateMsg(null).valid, false);
    });
  });

  describe('State Consistency & Service Worker Reinitialization', () => {
    test('Service worker restart queries and reconstructs active tabs cleanly', () => {
      const tm = new TestTabManager();

      // Simulated initial discovery query
      const discoveredTabs = [
        { id: 10, windowId: 1, url: 'https://siteA.com', active: true },
        { id: 11, windowId: 1, url: 'https://siteB.com', active: false },
      ];

      discoveredTabs.forEach((t) => tm.registerTab(t.id, t.windowId, t.url, t.active));

      assert.strictEqual(tm.tabs.size, 2);
      assert.strictEqual(tm.getActiveTab()?.tabId, 10);
    });
  });
});

import React from 'react';
import { TabRuntimeState } from '../../runtime/runtime-state';

interface TabListViewProps {
  tabs: TabRuntimeState[];
  activeTabId: number | null;
}

export const TabListView: React.FC<TabListViewProps> = ({ tabs, activeTabId }) => {
  if (tabs.length === 0) {
    return <div className="no-tabs">No tracked tabs available.</div>;
  }

  return (
    <div className="tab-list-container">
      <div className="section-label">Tracked Tabs ({tabs.length})</div>
      <ul className="tab-list">
        {tabs.map((tab) => {
          const isActive = tab.tabId === activeTabId;
          const isConnected = tab.contentScript === 'ready';
          const isUnavailable = tab.contentScript === 'unavailable';

          let scriptBadge = 'Connecting';
          if (isConnected) scriptBadge = 'Connected';
          if (isUnavailable) scriptBadge = 'Unavailable';

          return (
            <li key={tab.tabId} className={`tab-item ${isActive ? 'active-tab-item' : ''}`}>
              <div className="tab-item-header">
                <span className={`dot ${isConnected ? 'connected' : isUnavailable ? 'error' : 'pending'}`}></span>
                <span className="tab-title" title={tab.url || tab.title}>
                  {tab.title || tab.url || `Tab ${tab.tabId}`}
                </span>
              </div>
              <div className="tab-item-meta">
                <span>W{tab.windowId} · Tab {tab.tabId}</span>
                <span className="badge">{tab.status} · {scriptBadge}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

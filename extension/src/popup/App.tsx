import React, { useEffect, useState, useRef } from 'react';
import { Header } from './components/Header';
import { StatusCard } from './components/StatusCard';
import { TabListView } from './components/TabListView';
import { DiagnosticsView } from './components/DiagnosticsView';
import { AnalysisView } from './components/AnalysisView';
import { SolutionPlanView } from './components/SolutionPlanView';
import { CodeView } from './components/CodeView';
import { SettingsModal } from './components/SettingsModal';
import { TabRuntimeState } from '../runtime/runtime-state';
import {
  RuntimeStateResponsePayload,
  GetAllTabStatesResponsePayload,
  ProblemExtractionResponseMessage,
  AIAnalysisResponseMessage,
  ReasoningResponseMessage,
  CodeGenerationResponseMessage,
  InsertCodeResponseMessage,
} from '../shared/types/messages';
import { Logger } from '../shared/utils/logger';
import { MonacoDiagnostics } from '../content/adapters/types';
import './App.css';

const logger = new Logger('Popup');

function clampPosition(x: number, y: number) {
  const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const winHeight = typeof window !== 'undefined' ? window.innerHeight : 768;

  const minX = 0;
  const maxX = Math.max(0, winWidth - 380);

  const minY = 0;
  const maxY = Math.max(0, winHeight - 100);

  const clampedX = Math.max(minX, Math.min(x, maxX));
  const clampedY = Math.max(minY, Math.min(y, maxY));

  return { x: clampedX, y: clampedY };
}

function savePanelPosition(x: number, y: number): void {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
    try {
      chrome.storage.session.set({ codepilot_panel_x: x, codepilot_panel_y: y });
    } catch {
      // Fallback ignore
    }
  }
}

function loadPanelPosition(callback: (pos: { x: number; y: number } | null) => void): void {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
    try {
      chrome.storage.session.get(['codepilot_panel_x', 'codepilot_panel_y'], (items) => {
        if (typeof items?.codepilot_panel_x === 'number' && typeof items?.codepilot_panel_y === 'number') {
          callback({ x: items.codepilot_panel_x, y: items.codepilot_panel_y });
        } else {
          callback(null);
        }
      });
      return;
    } catch {
      // Fallback ignore
    }
  }
  callback(null);
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabRuntimeState | null>(null);
  const [allTabs, setAllTabs] = useState<TabRuntimeState[]>([]);
  const [viewMode, setViewMode] = useState<'current' | 'analysis' | 'plan' | 'code' | 'diagnostics' | 'all'>('current');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [rateLimitAlert, setRateLimitAlert] = useState<string | null>(null);

  // Loading States
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isPlanning, setIsPlanning] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [_isInserting, setIsInserting] = useState<boolean>(false);

  // Position & Draggable Panel States
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const defaultX = Math.max(20, winWidth - 380 - 24);
    const defaultY = 80;
    return { x: defaultX, y: defaultY };
  });
  const [isClosed, setIsClosed] = useState<boolean>(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const requestRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; initialX: number; initialY: number }>({
    pointerX: 0,
    pointerY: 0,
    initialX: 0,
    initialY: 0,
  });
  const currentPosRef = useRef<{ x: number; y: number }>({ x: position.x, y: position.y });

  useEffect(() => {
    currentPosRef.current = position;
  }, [position]);

  useEffect(() => {
    loadPanelPosition((stored) => {
      if (stored) {
        const clamped = clampPosition(stored.x, stored.y);
        setPosition(clamped);
        currentPosRef.current = clamped;
      }
    });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const clamped = clampPosition(prev.x, prev.y);
        savePanelPosition(clamped.x, clamped.y);
        currentPosRef.current = clamped;
        return clamped;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleDragStart = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    document.body.style.userSelect = 'none';

    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      initialX: currentPosRef.current.x,
      initialY: currentPosRef.current.y,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current) return;

      const deltaX = moveEvent.clientX - dragStartRef.current.pointerX;
      const deltaY = moveEvent.clientY - dragStartRef.current.pointerY;

      const rawX = dragStartRef.current.initialX + deltaX;
      const rawY = dragStartRef.current.initialY + deltaY;

      const clamped = clampPosition(rawX, rawY);
      currentPosRef.current = clamped;

      if (!requestRef.current) {
        requestRef.current = requestAnimationFrame(() => {
          if (panelRef.current) {
            panelRef.current.style.left = `${currentPosRef.current.x}px`;
            panelRef.current.style.top = `${currentPosRef.current.y}px`;
          }
          requestRef.current = null;
        });
      }
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);

      const finalX = currentPosRef.current.x;
      const finalY = currentPosRef.current.y;
      setPosition({ x: finalX, y: finalY });
      savePanelPosition(finalX, finalY);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleDragMove = (_e: React.PointerEvent<HTMLElement>) => {};
  const handleDragEnd = (_e: React.PointerEvent<HTMLElement>) => {};

  const handleClose = () => {
    setIsClosed(true);
    if (typeof window !== 'undefined' && typeof window.close === 'function') {
      try {
        window.close();
      } catch {
        // Ignore fallback
      }
    }
  };

  const fetchRuntimeState = (): void => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      setActiveTab(null);
      setAllTabs([]);
      return;
    }

    chrome.runtime.sendMessage({ type: 'GET_RUNTIME_STATE' }, (response: RuntimeStateResponsePayload) => {
      const err = chrome.runtime.lastError;
      if (!err && response?.activeTabState) {
        setActiveTab(response.activeTabState);
      }
    });

    chrome.runtime.sendMessage({ type: 'GET_ALL_TAB_STATES' }, (response: GetAllTabStatesResponsePayload) => {
      const err = chrome.runtime.lastError;
      if (!err && response?.tabs) {
        setAllTabs(response.tabs);
      }
    });
  };

  const handleRefreshDetection = (): void => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      setTimeout(() => setIsRefreshing(false), 500);
      return;
    }
    chrome.runtime.sendMessage({ type: 'REQUEST_PAGE_DETECTION', forceRefresh: true }, () => {
      const err1 = chrome.runtime.lastError;
      if (err1) {
        setIsRefreshing(false);
        return;
      }
      chrome.runtime.sendMessage({ type: 'REQUEST_PROBLEM_EXTRACTION', forceRefresh: true }, (res: ProblemExtractionResponseMessage) => {
        const err2 = chrome.runtime.lastError;
        setIsRefreshing(false);
        if (!err2 && res?.result) {
          logger.info('Refreshed extraction result:', res.result.status);
          fetchRuntimeState();
        }
      });
    });
  };

  const checkRateLimitError = (errMsg?: string) => {
    if (!errMsg) return;
    const lower = errMsg.toLowerCase();
    if (lower.includes('rate limit') || lower.includes('429') || lower.includes('limit reached') || lower.includes('ai_rate_limited')) {
      setRateLimitAlert(errMsg);
    }
  };

  const handleAnalyzeProblem = (): void => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setViewMode('analysis');
    setRateLimitAlert(null);
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      setTimeout(() => setIsAnalyzing(false), 500);
      return;
    }
    chrome.runtime.sendMessage({ type: 'REQUEST_AI_ANALYSIS' }, (res: AIAnalysisResponseMessage) => {
      const err = chrome.runtime.lastError;
      setIsAnalyzing(false);
      if (!err && res?.analysis) {
        logger.info('AI Analysis complete:', res.analysis.status);
      }
      if (res?.error) {
        checkRateLimitError(typeof res.error === 'string' ? res.error : (res.error as any).message);
      }
      fetchRuntimeState();
    });
  };

  const handleRequestReasoning = (): void => {
    if (isPlanning) return;
    setIsPlanning(true);
    setViewMode('plan');
    setRateLimitAlert(null);
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      setTimeout(() => setIsPlanning(false), 500);
      return;
    }
    chrome.runtime.sendMessage({ type: 'REQUEST_REASONING' }, (res: ReasoningResponseMessage) => {
      const err = chrome.runtime.lastError;
      setIsPlanning(false);
      if (!err && res?.plan) {
        logger.info('Reasoning plan generated:', res.plan.status);
      }
      if (res?.error) {
        checkRateLimitError(typeof res.error === 'string' ? res.error : (res.error as any).message);
      }
      fetchRuntimeState();
    });
  };

  const handleRequestCodeGeneration = (targetLanguage: string): void => {
    if (isGenerating) return;
    setIsGenerating(true);
    setViewMode('code');
    setRateLimitAlert(null);
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      setTimeout(() => setIsGenerating(false), 500);
      return;
    }
    chrome.runtime.sendMessage({ type: 'REQUEST_CODE_GENERATION', targetLanguage }, (res: CodeGenerationResponseMessage) => {
      const err = chrome.runtime.lastError;
      setIsGenerating(false);
      if (!err && res?.generatedCode) {
        logger.info('Code generation complete for language:', res.generatedCode.language);
      }
      if (res?.error) {
        checkRateLimitError(typeof res.error === 'string' ? res.error : (res.error as any).message);
      }
      fetchRuntimeState();
    });
  };

  const handleInsertCode = async (
    code: string,
    targetLanguage: string,
    forceInsert?: boolean,
    mode?: 'instant' | 'progressive',
    insertionId?: string
  ): Promise<{ success: boolean; editorType: string; errorCode?: string; detectedEditorLanguage?: string | null; message?: string; diagnostics?: MonacoDiagnostics }> => {
    setIsInserting(true);
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      setIsInserting(false);
      return { success: false, editorType: 'unknown', message: 'DATA_NOT_AVAILABLE: Extension runtime context unavailable' };
    }
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'INSERT_CODE_TO_EDITOR', code, targetLanguage, forceInsert, mode, insertionId },
        (res: InsertCodeResponseMessage) => {
          const err = chrome.runtime.lastError;
          setIsInserting(false);
          if (err || !res) {
            resolve({ success: false, editorType: 'unknown', errorCode: 'EDITOR_NOT_ACCESSIBLE', message: 'Runtime message failed' });
          } else {
            resolve(res);
          }
        }
      );
    });
  };

  const handleCancelInsertion = (insertionId?: string): void => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'CANCEL_CODE_INSERTION', insertionId });
    }
    setIsInserting(false);
  };

  useEffect(() => {
    logger.info('Popup opened');
    fetchRuntimeState();
    handleRefreshDetection();
  }, []);

  if (isClosed) return null;

  return (
    <div
      ref={panelRef}
      className="popup-container"
      onClick={(e) => e.stopPropagation()}
    >
      <Header
        onClose={handleClose}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      />

      {rateLimitAlert && (
        <div style={{
          background: '#450a0a',
          color: '#fca5a5',
          border: '1px solid #dc2626',
          borderRadius: '6px',
          padding: '8px 12px',
          margin: '8px 12px 0 12px',
          fontSize: '11px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <div>
            <span style={{ fontSize: '13px' }}>⚠️</span> <strong>API Key Limit Reached:</strong> {rateLimitAlert}
          </div>
          <button
            onClick={() => {
              setRateLimitAlert(null);
              setIsSettingsOpen(true);
            }}
            style={{
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Change Keys
          </button>
        </div>
      )}

      <nav className="tab-nav">
        <button className={`nav-btn ${viewMode === 'current' ? 'active' : ''}`} onClick={() => setViewMode('current')}>
          <span>Extraction</span>
          {isRefreshing && <span className="btn-spinner" style={{ width: '10px', height: '10px', marginLeft: '4px' }}></span>}
        </button>
        <button className={`nav-btn ${viewMode === 'analysis' ? 'active' : ''}`} onClick={() => setViewMode('analysis')}>
          <span>AI Analysis</span>
          {(isAnalyzing || activeTab?.aiAnalysis?.status === 'pending') && (
            <span className="btn-spinner" style={{ width: '10px', height: '10px', marginLeft: '4px' }}></span>
          )}
        </button>
        <button className={`nav-btn ${viewMode === 'plan' ? 'active' : ''}`} onClick={() => setViewMode('plan')}>
          <span>Solution Plan</span>
          {(isPlanning || activeTab?.reasoning?.status === 'pending') && (
            <span className="btn-spinner" style={{ width: '10px', height: '10px', marginLeft: '4px' }}></span>
          )}
        </button>
        <button className={`nav-btn ${viewMode === 'code' ? 'active' : ''}`} onClick={() => setViewMode('code')}>
          <span>Code</span>
          {(isGenerating || activeTab?.codeGeneration?.status === 'GENERATING') && (
            <span className="btn-spinner" style={{ width: '10px', height: '10px', marginLeft: '4px' }}></span>
          )}
        </button>
        <button className={`nav-btn ${viewMode === 'diagnostics' ? 'active' : ''}`} onClick={() => setViewMode('diagnostics')}>
          <span>Diagnostics</span>
          {isRefreshing && <span className="btn-spinner" style={{ width: '10px', height: '10px', marginLeft: '4px' }}></span>}
        </button>
        <button className={`nav-btn ${viewMode === 'all' ? 'active' : ''}`} onClick={() => setViewMode('all')}>
          <span>Tabs ({allTabs.length})</span>
        </button>
      </nav>

      <main className="content">
        {viewMode === 'current' ? (
          activeTab ? (
            <StatusCard
              contentScriptStatus={activeTab.contentScript}
              detectionResult={activeTab.pageDetection?.result}
              extractionResult={activeTab.problemExtraction?.result}
              aiAnalysisState={activeTab.aiAnalysis}
              reasoningState={activeTab.reasoning}
              windowId={activeTab.windowId}
              tabId={activeTab.tabId}
              title={activeTab.title}
              url={activeTab.url}
              isRefreshing={isRefreshing}
              isAnalyzing={isAnalyzing}
              isPlanning={isPlanning}
              onRefreshDetection={handleRefreshDetection}
              onAnalyzeProblem={handleAnalyzeProblem}
              onRequestReasoning={handleRequestReasoning}
            />
          ) : (
            <div className="detection-status">No active browser tab detected.</div>
          )
        ) : viewMode === 'analysis' ? (
          <AnalysisView
            aiAnalysis={activeTab?.aiAnalysis}
            isAnalyzing={isAnalyzing}
            onAnalyze={handleAnalyzeProblem}
          />
        ) : viewMode === 'plan' ? (
          <SolutionPlanView
            reasoningState={activeTab?.reasoning}
            isPlanning={isPlanning}
            onRequestReasoning={handleRequestReasoning}
          />
        ) : viewMode === 'code' ? (
          <CodeView
            plan={activeTab?.reasoning?.plan}
            codeState={activeTab?.codeGeneration}
            detectedVersion={activeTab?.codeGeneration?.detectedVersion}
            onRequestCodeGeneration={(lang) => handleRequestCodeGeneration(lang)}
            onInsertCode={handleInsertCode}
            onCancelInsertion={handleCancelInsertion}
          />
        ) : viewMode === 'diagnostics' ? (
          <DiagnosticsView
            detectionResult={activeTab?.pageDetection?.result}
            extractionResult={activeTab?.problemExtraction?.result}
            reasoningState={activeTab?.reasoning}
            session={activeTab?.problemSession}
          />
        ) : (
          <TabListView tabs={allTabs} activeTabId={activeTab?.tabId || null} />
        )}
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

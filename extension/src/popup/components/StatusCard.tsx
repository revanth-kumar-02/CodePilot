import React, { useState } from 'react';
import { PageDetectionResult } from '../../detection/types';
import { ProblemExtractionResult } from '../../extraction/types';
import { AIAnalysisState, ReasoningState } from '../../runtime/runtime-state';
import { ProblemViewerModal } from './ProblemViewerModal';

interface StatusCardProps {
  contentScriptStatus: 'unknown' | 'loading' | 'ready' | 'unavailable';
  detectionResult?: PageDetectionResult;
  extractionResult?: ProblemExtractionResult;
  aiAnalysisState?: AIAnalysisState;
  reasoningState?: ReasoningState;
  windowId?: number;
  tabId?: number;
  title?: string;
  url?: string;
  isRefreshing?: boolean;
  isAnalyzing?: boolean;
  isPlanning?: boolean;
  onRefreshDetection?: () => void;
  onAnalyzeProblem?: () => void;
  onRequestReasoning?: () => void;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  contentScriptStatus,
  detectionResult,
  extractionResult,
  aiAnalysisState,
  reasoningState,
  windowId,
  tabId,
  title,
  url,
  isRefreshing = false,
  isAnalyzing = false,
  isPlanning = false,
  onRefreshDetection,
  onAnalyzeProblem,
  onRequestReasoning,
}) => {
  const [showModal, setShowModal] = useState(false);
  const isCodingEnv =
    detectionResult &&
    (detectionResult.type === 'coding-problem' ||
      detectionResult.type === 'coding' ||
      detectionResult.type === 'editor');

  const formatClassificationTitle = (type?: string) => {
    switch (type) {
      case 'coding-problem':
        return 'Coding Problem';
      case 'editor':
        return 'Code Editor';
      case 'coding':
        return 'Coding Page';
      case 'normal':
        return 'Normal Page';
      default:
        return 'Unknown Page';
    }
  };

  const isAnalysisPending = isAnalyzing || aiAnalysisState?.status === 'pending';
  const isReasoningPending = isPlanning || reasoningState?.status === 'pending';

  return (
    <div className="status-box">
      <div>
        <span className="section-label">Current Page</span>
        <div className="subtitle" title={url || title || 'Current Tab'}>
          {title || url || 'No tab selected'}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
        <div className="status-row">
          <span style={{ fontSize: '14px', fontWeight: 600 }}>
            {formatClassificationTitle(detectionResult?.type)}
          </span>
          {detectionResult && (
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: isCodingEnv ? 'var(--accent-green)' : 'var(--text-muted)',
              }}
            >
              Confidence {Math.round(detectionResult.confidence * 100)}%
            </span>
          )}
        </div>

        {isCodingEnv && (
          <ul style={{ marginTop: '8px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <li style={{ fontSize: '11px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>✓</span>
              <span>Problem detected</span>
            </li>
            {extractionResult && extractionResult.status !== 'failed' && (
              <li style={{ fontSize: '11px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>✓</span>
                <span>Problem extracted ({extractionResult.fields.filter((f) => f.status === 'found').length} sections found)</span>
              </li>
            )}
            {extractionResult && extractionResult.status === 'failed' && (
              <li style={{ fontSize: '11px', color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Problem extraction failed.</span>
              </li>
            )}
          </ul>
        )}

        {isCodingEnv && extractionResult?.problem && (
          <div style={{ marginTop: '8px', background: 'var(--panel-bg)', padding: '6px', borderRadius: '4px' }}>
            <div className="section-label">Title</div>
            <div style={{ fontSize: '12px', fontWeight: 600 }}>{extractionResult.problem.title}</div>
            
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
              <button className="refresh-btn" onClick={() => setShowModal(true)}>
                View Problem
              </button>

              {onAnalyzeProblem && (
                <button
                  className="refresh-btn"
                  style={{ backgroundColor: 'var(--panel-bg)', color: 'var(--text-main)' }}
                  onClick={onAnalyzeProblem}
                  disabled={isAnalysisPending}
                >
                  {isAnalysisPending && <span className="btn-spinner"></span>}
                  <span>{isAnalysisPending ? 'Analyzing...' : 'AI Analysis'}</span>
                </button>
              )}

              {onRequestReasoning && (
                <button
                  className="refresh-btn"
                  style={{ backgroundColor: 'var(--accent-blue)', color: '#ffffff', borderColor: 'var(--accent-blue)' }}
                  onClick={onRequestReasoning}
                  disabled={isReasoningPending}
                >
                  {isReasoningPending && <span className="btn-spinner"></span>}
                  <span>{isReasoningPending ? 'Planning...' : 'Generate Plan'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {!isCodingEnv && (
          <p style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            No coding environment detected.
          </p>
        )}
      </div>

      <div className="status-row" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
        <span className="section-label">Content Script</span>
        <span className={`dot ${contentScriptStatus === 'ready' ? 'connected' : contentScriptStatus === 'unavailable' ? 'error' : 'pending'}`}></span>
      </div>

      {windowId !== undefined && tabId !== undefined && (
        <div className="status-row">
          <span className="section-label">Location</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Window {windowId} · Tab {tabId}
          </span>
        </div>
      )}

      {onRefreshDetection && (
        <button className="refresh-btn" onClick={onRefreshDetection} disabled={isRefreshing}>
          {isRefreshing && <span className="btn-spinner"></span>}
          <span>{isRefreshing ? 'Refreshing Detection...' : 'Refresh Detection'}</span>
        </button>
      )}

      {showModal && extractionResult?.problem && (
        <ProblemViewerModal problem={extractionResult.problem} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
};

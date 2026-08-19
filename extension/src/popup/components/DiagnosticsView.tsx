import React, { useState } from 'react';
import { PageDetectionResult } from '../../detection/types';
import { ProblemExtractionResult } from '../../extraction/types';
import { ReasoningState } from '../../runtime/runtime-state';
import { ProblemSession } from '../../storage/session-store';
import { ProblemViewerModal } from './ProblemViewerModal';

interface DiagnosticsViewProps {
  detectionResult?: PageDetectionResult;
  extractionResult?: ProblemExtractionResult;
  reasoningState?: ReasoningState;
  session?: ProblemSession | null;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({
  detectionResult,
  extractionResult,
  reasoningState,
  session,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingRepair, setGeneratingRepair] = useState(false);
  const [applyingRepair, setApplyingRepair] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(
    session?.diagnosticsContext?.errorClassification || null
  );
  const [repairedCode, setRepairedCode] = useState<string | null>(
    session?.diagnosticsContext?.repairCode || null
  );
  const [repairStatusMsg, setRepairStatusMsg] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const diagContext = session?.diagnosticsContext;
  const executionStatus = diagContext?.lastExecutionStatus;
  const hasError =
    executionStatus &&
    executionStatus !== 'ACCEPTED' &&
    executionStatus !== 'PASS';
  const isAccepted = executionStatus === 'ACCEPTED' || executionStatus === 'PASS';
  const repairAttempt = diagContext?.repairAttempt || 0;
  const isLimitReached = repairAttempt >= 3;

  const handleAnalyzeError = () => {
    setAnalyzing(true);
    setErrorMessage(null);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(
        { type: 'REQUEST_ERROR_ANALYSIS' },
        (response) => {
          setAnalyzing(false);
          if (response?.status === 'success' && response.analysis) {
            setAnalysisResult(response.analysis.classification);
          } else {
            setErrorMessage(response?.error || 'Failed to analyze error.');
          }
        }
      );
    } else {
      setAnalyzing(false);
      setAnalysisResult('Compilation Error');
    }
  };

  const handleGenerateRepair = () => {
    setGeneratingRepair(true);
    setErrorMessage(null);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(
        { type: 'REQUEST_CODE_REPAIR' },
        (response) => {
          setGeneratingRepair(false);
          if (response?.status === 'success' && response.repairedCode) {
            setRepairedCode(response.repairedCode);
          } else {
            setErrorMessage(response?.error || 'Failed to generate repair code.');
          }
        }
      );
    } else {
      setGeneratingRepair(false);
      setRepairedCode(`public class Solution {\n    // Repaired code\n}`);
    }
  };

  const handleApplyRepair = () => {
    if (!repairedCode) return;
    setApplyingRepair(true);
    setErrorMessage(null);
    setRepairStatusMsg(null);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(
        {
          type: 'APPLY_REPAIR',
          payload: { code: repairedCode },
        },
        (response) => {
          setApplyingRepair(false);
          if (response?.success) {
            setRepairStatusMsg('✓ Repair applied');
            setRepairedCode(null);
          } else {
            setErrorMessage(response?.message || 'Failed to apply repair into editor.');
          }
        }
      );
    } else {
      setApplyingRepair(false);
      setRepairStatusMsg('✓ Repair applied');
      setRepairedCode(null);
    }
  };

  return (
    <div className="tab-list-container">
      {/* 1. CODE EXECUTION & REPAIR SECTION */}
      <div className="status-box" style={{ marginBottom: '12px' }}>
        <div className="section-label" style={{ fontSize: '13px', fontWeight: 600 }}>
          Diagnostics & Code Repair
        </div>

        {isAccepted && (
          <div style={{ marginTop: '8px', padding: '10px', backgroundColor: 'rgba(46, 160, 67, 0.15)', borderRadius: '6px', color: 'var(--accent-green)', fontWeight: 600 }}>
            ✓ Code Passed
          </div>
        )}

        {!hasError && !isAccepted && (
          <div style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>No errors detected</div>
            Run your code to see diagnostics here.
          </div>
        )}

        {hasError && (
          <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, color: 'var(--accent-red)', textTransform: 'uppercase' }}>
                Execution Failed ({executionStatus})
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Attempt {repairAttempt} / 3
              </span>
            </div>

            {diagContext?.lastError && (
              <div style={{ marginBottom: '8px' }}>
                <div className="section-label">Error Message</div>
                <pre
                  style={{
                    backgroundColor: '#161b22',
                    padding: '8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: '#ff7b72',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '120px',
                    overflowY: 'auto',
                  }}
                >
                  {diagContext.lastError}
                </pre>
              </div>
            )}

            {diagContext?.lastTestOutput && (
              <div style={{ marginBottom: '8px' }}>
                <div className="section-label">Test Output</div>
                <pre
                  style={{
                    backgroundColor: '#161b22',
                    padding: '8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: 'var(--text-muted)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '80px',
                    overflowY: 'auto',
                  }}
                >
                  {diagContext.lastTestOutput}
                </pre>
              </div>
            )}

            {analysisResult && (
              <div className="status-row" style={{ marginTop: '6px', marginBottom: '8px' }}>
                <span className="section-label">Classification</span>
                <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{analysisResult}</span>
              </div>
            )}

            {errorMessage && (
              <div style={{ color: 'var(--accent-red)', fontSize: '11px', marginBottom: '8px' }}>
                {errorMessage}
              </div>
            )}

            {repairStatusMsg && (
              <div style={{ color: 'var(--accent-green)', fontWeight: 600, fontSize: '12px', marginBottom: '8px' }}>
                {repairStatusMsg}
              </div>
            )}

            {isLimitReached ? (
              <div style={{ color: 'var(--accent-red)', fontWeight: 600, fontSize: '12px', marginTop: '6px' }}>
                Repair limit reached.
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                {!analysisResult && (
                  <button
                    className="refresh-btn"
                    onClick={handleAnalyzeError}
                    disabled={analyzing}
                    style={{ flex: 1 }}
                  >
                    {analyzing ? 'Analyzing error...' : 'Analyze Error'}
                  </button>
                )}

                {analysisResult && !repairedCode && (
                  <button
                    className="refresh-btn"
                    onClick={handleGenerateRepair}
                    disabled={generatingRepair}
                    style={{ flex: 1 }}
                  >
                    {generatingRepair ? 'Generating repair...' : 'Generate Repair'}
                  </button>
                )}
              </div>
            )}

            {repairedCode && (
              <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span className="section-label" style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
                    REPAIR READY
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Preview Mode
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Problem: </span>
                  {session?.problem?.title || extractionResult?.problem?.title || 'Current Problem'}
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Error: </span>
                  {analysisResult || diagContext?.errorClassification || executionStatus || 'Execution Failure'}
                </div>

                <div className="section-label" style={{ marginBottom: '4px' }}>Repaired Code</div>
                <pre
                  style={{
                    backgroundColor: '#0d1117',
                    padding: '8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: '#7ee787',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '140px',
                    overflowY: 'auto',
                    marginBottom: '8px',
                  }}
                >
                  {repairedCode}
                </pre>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="refresh-btn"
                    onClick={handleApplyRepair}
                    disabled={applyingRepair || analyzing || generatingRepair}
                    style={{ flex: 1, backgroundColor: 'var(--accent-green)', color: '#fff', fontWeight: 600 }}
                  >
                    {applyingRepair ? 'Applying...' : 'Apply Repair'}
                  </button>
                  <button
                    className="refresh-btn"
                    onClick={() => setRepairedCode(null)}
                    disabled={applyingRepair}
                    style={{ backgroundColor: 'var(--bg-tertiary)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. STORAGE DIAGNOSTICS */}
      <div className="status-box" style={{ marginBottom: '10px' }}>
        <div className="section-label">Session Storage Diagnostics</div>
        {session ? (
          <>
            <div className="status-row">
              <span className="section-label">Session ID</span>
              <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{session.sessionId}</span>
            </div>
            <div className="status-row">
              <span className="section-label">Tab ID</span>
              <span>{session.tabId}</span>
            </div>
            <div className="status-row">
              <span className="section-label">Problem</span>
              <span style={{ fontWeight: 600, color: session.problem ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {session.problem ? 'PASS' : 'MISSING'}
              </span>
            </div>
            <div className="status-row">
              <span className="section-label">Solution Plan</span>
              <span style={{ fontWeight: 600, color: session.solutionPlan ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {session.solutionPlan ? 'PASS' : 'MISSING'}
              </span>
            </div>
            <div className="status-row">
              <span className="section-label">Code</span>
              <span style={{ fontWeight: 600, color: session.code?.source ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {session.code?.source ? 'PASS' : 'MISSING'}
              </span>
            </div>
            <div className="status-row">
              <span className="section-label">Language</span>
              <span>{session.code?.language || 'None'}</span>
            </div>
            <div className="status-row">
              <span className="section-label">Repair Attempts</span>
              <span>{repairAttempt} / 3</span>
            </div>
          </>
        ) : (
          <div className="status-row" style={{ color: 'var(--text-muted)' }}>
            No active problem session stored for this tab.
          </div>
        )}
      </div>

      {/* 3. EXTRACTION DIAGNOSTICS */}
      <div className="status-box">
        <div className="section-label">Extraction Diagnostics</div>
        
        {(() => {
          const prob = session?.problem || extractionResult?.problem;
          const platform = prob?.source?.platform || session?.platform || 'CodeChef';
          const pageTitle = prob?.title || 'Unknown Page';
          const isPass = Boolean(prob && prob.statement && prob.statement.length > 50);
          const charCount = prob?.statement?.length || 0;

          const hasTitle = Boolean(prob?.title);
          const hasStatement = Boolean(prob?.statement && prob.statement.length > 0);
          const hasInput = Boolean(prob?.inputFormat);
          const hasOutput = Boolean(prob?.outputFormat);
          const hasConstraints = Boolean(prob?.constraints);
          const hasExamples = Boolean(prob?.examples && prob.examples.length > 0);

          return (
            <>
              <div className="status-row">
                <span className="section-label">Platform</span>
                <span style={{ fontWeight: 600 }}>{platform}</span>
              </div>
              <div className="status-row">
                <span className="section-label">Page</span>
                <span style={{ fontWeight: 500, fontSize: '11px' }}>{pageTitle}</span>
              </div>
              <div className="status-row">
                <span className="section-label">Extraction</span>
                <span
                  style={{
                    fontWeight: 700,
                    color: isPass ? 'var(--accent-green)' : 'var(--accent-red)',
                  }}
                >
                  {isPass ? 'PASS' : 'FAIL'}
                </span>
              </div>

              <div style={{ marginTop: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                <div className="status-row">
                  <span className="section-label">Title</span>
                  <span style={{ fontWeight: 600, color: hasTitle ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {hasTitle ? 'FOUND' : 'MISSING'}
                  </span>
                </div>
                <div className="status-row">
                  <span className="section-label">Statement</span>
                  <span style={{ fontWeight: 600, color: hasStatement ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {hasStatement ? 'FOUND' : 'MISSING'}
                  </span>
                </div>
                <div className="status-row">
                  <span className="section-label">Input</span>
                  <span style={{ fontWeight: 600, color: hasInput ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {hasInput ? 'FOUND' : 'MISSING'}
                  </span>
                </div>
                <div className="status-row">
                  <span className="section-label">Output</span>
                  <span style={{ fontWeight: 600, color: hasOutput ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {hasOutput ? 'FOUND' : 'MISSING'}
                  </span>
                </div>
                <div className="status-row">
                  <span className="section-label">Constraints</span>
                  <span style={{ fontWeight: 600, color: hasConstraints ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {hasConstraints ? 'FOUND' : 'MISSING'}
                  </span>
                </div>
                <div className="status-row">
                  <span className="section-label">Examples</span>
                  <span style={{ fontWeight: 600, color: hasExamples ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {hasExamples ? 'FOUND' : 'MISSING'}
                  </span>
                </div>
                <div className="status-row">
                  <span className="section-label">Extracted characters</span>
                  <span style={{ fontFamily: 'monospace' }}>{charCount}</span>
                </div>
              </div>

              {prob && (
                <button
                  className="refresh-btn"
                  style={{ marginTop: '8px', width: '100%' }}
                  onClick={() => setShowModal(true)}
                >
                  View Extracted Problem
                </button>
              )}
            </>
          );
        })()}
      </div>

      {/* 4. REASONING DIAGNOSTICS */}
      {reasoningState && reasoningState.status !== 'not-started' && (
        <div className="status-box" style={{ marginTop: '10px' }}>
          <div className="section-label">Reasoning Diagnostics</div>
          <div className="status-row">
            <span className="section-label">Status</span>
            <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{reasoningState.status}</span>
          </div>
          {reasoningState.plan && (
            <div className="status-row">
              <span className="section-label">Algorithm</span>
              <span>{reasoningState.plan.algorithm.name}</span>
            </div>
          )}
        </div>
      )}

      {/* 5. DETECTION DIAGNOSTICS */}
      {detectionResult && (
        <div className="status-box" style={{ marginTop: '10px' }}>
          <div className="section-label">Detection Diagnostics</div>
          <div className="status-row">
            <span className="section-label">Page Type</span>
            <span style={{ textTransform: 'capitalize' }}>{detectionResult.type}</span>
          </div>
          <div className="status-row">
            <span className="section-label">Editor</span>
            <span>{detectionResult.editor.detected ? `${detectionResult.editor.type}` : 'None'}</span>
          </div>
        </div>
      )}

      {showModal && extractionResult?.problem && (
        <ProblemViewerModal problem={extractionResult.problem} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
};

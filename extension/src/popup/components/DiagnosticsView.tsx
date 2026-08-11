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

  return (
    <div className="tab-list-container">
      {/* 0. Storage Diagnostics */}
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
              <span className="section-label">AI Analysis</span>
              <span style={{ fontWeight: 600, color: session.aiAnalysis ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {session.aiAnalysis ? 'PASS' : 'MISSING'}
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
              <span className="section-label">Version</span>
              <span>{session.code?.version || 'Version unavailable'}</span>
            </div>
            <div className="status-row">
              <span className="section-label">Session Status</span>
              <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{session.status}</span>
            </div>
            <div className="status-row">
              <span className="section-label">Last Updated</span>
              <span>{new Date(session.updatedAt).toLocaleTimeString()}</span>
            </div>
          </>
        ) : (
          <div className="status-row" style={{ color: 'var(--text-muted)' }}>
            No active problem session stored for this tab.
          </div>
        )}
      </div>
      {/* 1. Reasoning Diagnostics */}
      {reasoningState && reasoningState.status !== 'not-started' && (
        <div className="status-box" style={{ marginBottom: '10px' }}>
          <div className="section-label">Solution Plan Diagnostics</div>
          <div className="status-row">
            <span className="section-label">Status</span>
            <span
              style={{
                fontWeight: 600,
                textTransform: 'uppercase',
                color:
                  reasoningState.status === 'ready'
                    ? 'var(--accent-green)'
                    : reasoningState.status === 'needs-clarification'
                    ? '#d29922'
                    : 'var(--accent-red)',
              }}
            >
              {reasoningState.status}
            </span>
          </div>

          {reasoningState.plan && (
            <>
              <div className="status-row">
                <span className="section-label">Algorithm</span>
                <span style={{ fontWeight: 600 }}>{reasoningState.plan.algorithm.name} ({reasoningState.plan.algorithm.category})</span>
              </div>
              <div className="status-row">
                <span className="section-label">Complexity</span>
                <span>Time: {reasoningState.plan.complexity.time} | Space: {reasoningState.plan.complexity.space}</span>
              </div>
              <div className="status-row">
                <span className="section-label">Confidence</span>
                <span style={{ fontWeight: 600 }}>{Math.round(reasoningState.plan.confidence * 100)}%</span>
              </div>
              <div className="status-row">
                <span className="section-label">Model / Provider</span>
                <span>{reasoningState.plan.model} ({reasoningState.plan.provider})</span>
              </div>
            </>
          )}

          {reasoningState.validation && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '4px' }}>
              <div className="status-row">
                <span className="section-label">Consistency Validation</span>
                <span style={{ fontWeight: 600, color: reasoningState.validation.valid ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {reasoningState.validation.valid ? 'PASS' : 'FAIL'}
                </span>
              </div>
              {reasoningState.validation.issues.length > 0 && (
                <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--accent-red)' }}>
                  Issues: {reasoningState.validation.issues.map(i => i.message).join('; ')}
                </div>
              )}
            </div>
          )}

          {reasoningState.error && (
            <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--accent-red)' }}>
              Error: {reasoningState.error}
            </div>
          )}
        </div>
      )}

      {/* 2. Extraction Diagnostics */}
      {extractionResult ? (
        <div className="status-box">
          <div className="section-label">Extraction Diagnostics</div>
          <div className="status-row">
            <span className="section-label">Status</span>
            <span
              style={{
                fontWeight: 600,
                textTransform: 'uppercase',
                color:
                  extractionResult.status === 'success'
                    ? 'var(--accent-green)'
                    : extractionResult.status === 'partial'
                    ? 'var(--accent-blue)'
                    : 'var(--accent-red)',
              }}
            >
              {extractionResult.status}
            </span>
          </div>

          <div className="status-row">
            <span className="section-label">Confidence</span>
            <span style={{ fontWeight: 600 }}>{Math.round(extractionResult.confidence * 100)}%</span>
          </div>

          <div className="status-row">
            <span className="section-label">Character Count</span>
            <span>{extractionResult.problem?.metadata.characterCount || 0}</span>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '4px' }}>
            <div className="section-label" style={{ marginBottom: '6px' }}>
              Field Diagnostics ({extractionResult.fields.length})
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {extractionResult.fields.map((f, idx) => (
                <li key={idx} style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>
                    <strong style={{ textTransform: 'capitalize' }}>{f.field}:</strong>{' '}
                    {f.status === 'found' ? '✓ Found' : 'Missing'} ({f.method})
                  </span>
                  <span style={{ fontWeight: 600 }}>{Math.round(f.confidence * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>

          {extractionResult.warnings.length > 0 && (
            <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--accent-blue)' }}>
              Warnings: {extractionResult.warnings.join(', ')}
            </div>
          )}

          {extractionResult.errors.length > 0 && (
            <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--accent-red)' }}>
              Errors: {extractionResult.errors.join(', ')}
            </div>
          )}

          {extractionResult.problem && (
            <button className="refresh-btn" style={{ marginTop: '8px' }} onClick={() => setShowModal(true)}>
              View Normalized Problem
            </button>
          )}
        </div>
      ) : (
        <div className="no-tabs">No problem extraction diagnostics available.</div>
      )}

      {/* 3. Detection Diagnostics */}
      {detectionResult && (
        <div className="status-box" style={{ marginTop: '10px' }}>
          <div className="section-label">Detection Diagnostics</div>
          <div className="status-row">
            <span className="section-label">Type</span>
            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{detectionResult.type}</span>
          </div>

          <div className="status-row">
            <span className="section-label">Confidence</span>
            <span style={{ fontWeight: 600 }}>{Math.round(detectionResult.confidence * 100)}%</span>
          </div>

          <div className="status-row">
            <span className="section-label">Duration</span>
            <span>{detectionResult.detectionDurationMs} ms</span>
          </div>

          <div className="status-row">
            <span className="section-label">Editor</span>
            <span style={{ textTransform: 'capitalize' }}>
              {detectionResult.editor.detected
                ? `${detectionResult.editor.type} (${Math.round(detectionResult.editor.confidence * 100)}%)`
                : 'None detected'}
            </span>
          </div>
        </div>
      )}

      {showModal && extractionResult?.problem && (
        <ProblemViewerModal problem={extractionResult.problem} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
};

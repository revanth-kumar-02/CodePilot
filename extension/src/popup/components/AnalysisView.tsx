import React from 'react';
import { AIAnalysisState } from '../../runtime/runtime-state';

interface AnalysisViewProps {
  aiAnalysis?: AIAnalysisState;
  isAnalyzing?: boolean;
  onAnalyze: () => void;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ aiAnalysis, isAnalyzing = false, onAnalyze }) => {
  const isPending = isAnalyzing || aiAnalysis?.status === 'pending';

  if (!aiAnalysis || aiAnalysis.status === 'not-started') {
    return (
      <div className="status-box">
        <div className="section-label">AI Problem Analysis</div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Analyze the extracted coding problem using AI logic reasoning.
        </p>
        <button
          className="refresh-btn"
          style={{ marginTop: '10px', backgroundColor: 'var(--accent-blue)', color: '#ffffff', borderColor: 'var(--accent-blue)' }}
          onClick={onAnalyze}
          disabled={isPending}
        >
          {isPending && <span className="btn-spinner"></span>}
          <span>{isPending ? 'Analyzing Problem...' : 'Analyze Problem'}</span>
        </button>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="status-box">
        <div className="section-label">AI Problem Analysis</div>
        <div className="status-row" style={{ marginTop: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="btn-spinner" style={{ color: 'var(--accent-blue)' }}></span>
            <span style={{ fontSize: '12px', color: 'var(--accent-blue)', fontWeight: 600 }}>
              Analyzing problem statement & examples...
            </span>
          </div>
          <span className="dot pending"></span>
        </div>
      </div>
    );
  }

  if (aiAnalysis.status === 'failed') {
    return (
      <div className="status-box">
        <div className="section-label">AI Problem Analysis</div>
        <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--accent-red)' }}>
          Analysis Failed: {aiAnalysis.error || 'Unable to complete AI analysis.'}
        </div>
        <button
          className="refresh-btn"
          style={{ marginTop: '10px', backgroundColor: 'var(--accent-blue)', color: '#ffffff', borderColor: 'var(--accent-blue)' }}
          onClick={onAnalyze}
          disabled={isPending}
        >
          {isPending && <span className="btn-spinner"></span>}
          <span>{isPending ? 'Retrying Analysis...' : 'Retry Analysis'}</span>
        </button>
      </div>
    );
  }

  if (aiAnalysis.status === 'insufficient-information') {
    return (
      <div className="status-box">
        <div className="section-label">AI Problem Analysis</div>
        <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--accent-blue)', fontWeight: 600 }}>
          More information is required to analyze this problem reliably.
        </div>
        {aiAnalysis.analysis?.understanding && (
          <p style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
            {aiAnalysis.analysis.understanding}
          </p>
        )}
        <button
          className="refresh-btn"
          style={{ marginTop: '10px', backgroundColor: 'var(--accent-blue)', color: '#ffffff', borderColor: 'var(--accent-blue)' }}
          onClick={onAnalyze}
          disabled={isPending}
        >
          {isPending && <span className="btn-spinner"></span>}
          <span>{isPending ? 'Re-Analyzing Problem...' : 'Re-Analyze Problem'}</span>
        </button>
      </div>
    );
  }

  const analysis = aiAnalysis.analysis;

  return (
    <div className="status-box" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div className="status-row">
        <span style={{ fontSize: '14px', fontWeight: 600 }}>Problem Analysis</span>
        {analysis && (
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-green)' }}>
            Confidence {Math.round(analysis.confidence * 100)}%
          </span>
        )}
      </div>

      {analysis?.understanding && (
        <div>
          <div className="section-label">Understanding</div>
          <div style={{ fontSize: '12px', marginTop: '2px' }}>{analysis.understanding}</div>
        </div>
      )}

      {analysis?.keyObservations && analysis.keyObservations.length > 0 && (
        <div>
          <div className="section-label">Key Observations</div>
          <ul style={{ listStyle: 'disc', paddingLeft: '16px', fontSize: '11px', marginTop: '2px' }}>
            {analysis.keyObservations.map((obs, idx) => (
              <li key={idx}>{obs}</li>
            ))}
          </ul>
        </div>
      )}

      {analysis?.algorithmApproach && (
        <div>
          <div className="section-label">Approach</div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-blue)', marginTop: '2px' }}>
            {analysis.algorithmApproach}
          </div>
        </div>
      )}

      {analysis?.algorithmSteps && analysis.algorithmSteps.length > 0 && (
        <div>
          <div className="section-label">Algorithm Steps</div>
          <ol style={{ paddingLeft: '16px', fontSize: '11px', marginTop: '2px' }}>
            {analysis.algorithmSteps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      <div style={{ display: 'flex', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
        <div>
          <div className="section-label">Time Complexity</div>
          <div style={{ fontSize: '12px', fontWeight: 600 }}>{analysis?.timeComplexity || 'N/A'}</div>
        </div>
        <div>
          <div className="section-label">Space Complexity</div>
          <div style={{ fontSize: '12px', fontWeight: 600 }}>{analysis?.spaceComplexity || 'N/A'}</div>
        </div>
      </div>

      {analysis?.edgeCases && analysis.edgeCases.length > 0 && (
        <div>
          <div className="section-label">Edge Cases</div>
          <ul style={{ listStyle: 'circle', paddingLeft: '16px', fontSize: '11px', marginTop: '2px' }}>
            {analysis.edgeCases.map((ec, idx) => (
              <li key={idx}>{ec}</li>
            ))}
          </ul>
        </div>
      )}

      {analysis?.assumptions && analysis.assumptions.length > 0 && (
        <div>
          <div className="section-label">Assumptions</div>
          <ul style={{ listStyle: 'none', fontSize: '11px', marginTop: '2px', color: 'var(--text-muted)' }}>
            {analysis.assumptions.map((asm, idx) => (
              <li key={idx}>• {asm}</li>
            ))}
          </ul>
        </div>
      )}

      {analysis && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '6px', fontSize: '10px', color: 'var(--text-muted)' }}>
          Provider: {analysis.provider} · Model: {analysis.model}
        </div>
      )}
    </div>
  );
};

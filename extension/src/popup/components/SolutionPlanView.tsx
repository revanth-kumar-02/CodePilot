import React from 'react';
import { ReasoningState } from '../../runtime/runtime-state';

interface SolutionPlanViewProps {
  reasoningState?: ReasoningState;
  isPlanning?: boolean;
  onRequestReasoning?: () => void;
}

export const SolutionPlanView: React.FC<SolutionPlanViewProps> = ({
  reasoningState,
  isPlanning = false,
  onRequestReasoning,
}) => {
  const isPending = isPlanning || reasoningState?.status === 'pending';

  if (!reasoningState || reasoningState.status === 'not-started') {
    return (
      <div className="status-box" style={{ textAlign: 'center', padding: '16px' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          No solution plan generated yet.
        </p>
        {onRequestReasoning && (
          <button
            className="refresh-btn"
            style={{
              marginTop: '10px',
              backgroundColor: 'var(--accent-blue)',
              color: '#ffffff',
              borderColor: 'var(--accent-blue)',
            }}
            onClick={onRequestReasoning}
            disabled={isPending}
          >
            {isPending && <span className="btn-spinner"></span>}
            <span>{isPending ? 'Generating Solution Plan...' : 'Generate Solution Plan'}</span>
          </button>
        )}
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="status-box" style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <span className="btn-spinner" style={{ color: 'var(--accent-blue)' }}></span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent-blue)' }}>
            Generating Solution Plan...
          </span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
          Performing constraint analysis, algorithm evaluation, correctness reasoning, and multi-pass consistency validation.
        </p>
      </div>
    );
  }

  if (reasoningState.status === 'failed' || !reasoningState.plan) {
    return (
      <div className="status-box" style={{ borderColor: 'var(--accent-red)' }}>
        <span className="section-label" style={{ color: 'var(--accent-red)' }}>SOLUTION PLANNING FAILED</span>
        <p style={{ fontSize: '12px', color: 'var(--text-main)', marginTop: '6px' }}>
          The AI returned an incomplete solution plan.
        </p>
        {onRequestReasoning && (
          <button
            className="refresh-btn"
            style={{ marginTop: '10px', backgroundColor: 'var(--accent-blue)', color: '#ffffff', borderColor: 'var(--accent-blue)' }}
            onClick={onRequestReasoning}
            disabled={isPending}
          >
            {isPending && <span className="btn-spinner"></span>}
            <span>{isPending ? 'Retrying Solution Planning...' : 'Retry Solution Planning'}</span>
          </button>
        )}
      </div>
    );
  }

  const { plan, validation } = reasoningState;

  return (
    <div className="status-box" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header & Status */}
      <div className="status-row">
        <span style={{ fontSize: '14px', fontWeight: 700 }}>Solution Plan</span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor:
              plan.status === 'ready'
                ? 'rgba(46, 160, 67, 0.2)'
                : plan.status === 'needs-clarification'
                ? 'rgba(210, 153, 34, 0.2)'
                : 'rgba(248, 81, 73, 0.2)',
            color:
              plan.status === 'ready'
                ? 'var(--accent-green)'
                : plan.status === 'needs-clarification'
                ? '#d29922'
                : 'var(--accent-red)',
          }}
        >
          {plan.status.toUpperCase()}
        </span>
      </div>

      {plan.status === 'needs-clarification' && (
        <div style={{ padding: '8px', borderRadius: '4px', backgroundColor: 'rgba(210, 153, 34, 0.1)', border: '1px solid #d29922' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#d29922' }}>Clarification Required</span>
          <p style={{ fontSize: '11px', color: 'var(--text-main)', marginTop: '4px' }}>
            The problem statement or parameters require clarification before an executable plan can be confirmed.
          </p>
        </div>
      )}

      {/* Problem Understanding */}
      <div>
        <span className="section-label">Understanding</span>
        <p style={{ fontSize: '12px', color: 'var(--text-main)', marginTop: '2px' }}>
          {plan.problemUnderstanding}
        </p>
      </div>

      {/* Constraints & Scale Analysis */}
      <div style={{ background: 'var(--panel-bg)', padding: '8px', borderRadius: '4px' }}>
        <span className="section-label">Constraints & Scale</span>
        <div style={{ fontSize: '11px', color: 'var(--text-main)', marginTop: '4px' }}>
          <div><strong>Scale:</strong> {plan.constraintsAnalysis.inputScale}</div>
          <div><strong>Required Complexity:</strong> {plan.constraintsAnalysis.requiredComplexity}</div>
          {plan.constraintsAnalysis.numericRange && (
            <div><strong>Numeric Bounds:</strong> {plan.constraintsAnalysis.numericRange}</div>
          )}
        </div>
      </div>

      {/* Algorithm Strategy */}
      <div style={{ background: 'var(--panel-bg)', padding: '8px', borderRadius: '4px' }}>
        <div className="status-row">
          <span className="section-label">Algorithm Strategy</span>
          <span style={{ fontSize: '11px', color: 'var(--accent-blue)', fontWeight: 600 }}>
            {plan.algorithm.category}
          </span>
        </div>
        <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px' }}>{plan.algorithm.name}</div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{plan.algorithm.description}</p>

        <span className="section-label" style={{ marginTop: '8px', display: 'block' }}>Algorithm Steps</span>
        <ol style={{ fontSize: '11px', paddingLeft: '16px', margin: '4px 0 0 0', color: 'var(--text-main)' }}>
          {plan.algorithm.steps.map((step, idx) => (
            <li key={idx} style={{ marginBottom: '2px' }}>{step}</li>
          ))}
        </ol>

        {plan.algorithm.alternatives && plan.algorithm.alternatives.length > 0 && (
          <div style={{ marginTop: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}>
            <span className="section-label">Alternatives Considered</span>
            {plan.algorithm.alternatives.map((alt, idx) => (
              <div key={idx} style={{ fontSize: '11px', marginTop: '2px' }}>
                <strong>{alt.name}</strong> ({alt.complexity}): <span style={{ color: 'var(--text-muted)' }}>{alt.reasonRejected}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Complexity & Derivation */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div style={{ background: 'var(--panel-bg)', padding: '8px', borderRadius: '4px' }}>
          <span className="section-label">Time Complexity</span>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-green)' }}>{plan.complexity.time}</div>
        </div>
        <div style={{ background: 'var(--panel-bg)', padding: '8px', borderRadius: '4px' }}>
          <span className="section-label">Space Complexity</span>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-blue)' }}>{plan.complexity.space}</div>
        </div>
      </div>

      {/* Correctness Reasoning */}
      <div>
        <span className="section-label">Correctness Argument</span>
        <p style={{ fontSize: '11px', color: 'var(--text-main)', marginTop: '2px' }}>
          {plan.correctnessReasoning.argument}
        </p>
      </div>

      {/* Edge Cases */}
      {plan.edgeCases && plan.edgeCases.length > 0 && (
        <div style={{ background: 'var(--panel-bg)', padding: '8px', borderRadius: '4px' }}>
          <span className="section-label">Critical Edge Cases</span>
          <ul style={{ fontSize: '11px', paddingLeft: '16px', margin: '4px 0 0 0' }}>
            {plan.edgeCases.map((ec, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>
                <strong>{ec.case}:</strong> {ec.expectedBehavior}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Implementation Guidelines */}
      {plan.implementationRequirements && plan.implementationRequirements.length > 0 && (
        <div>
          <span className="section-label">Implementation Guidelines</span>
          <ul style={{ fontSize: '11px', paddingLeft: '16px', margin: '4px 0 0 0' }}>
            {plan.implementationRequirements.map((req, idx) => (
              <li key={idx} style={{ marginBottom: '2px' }}>
                <span style={{ fontWeight: 600, color: req.priority === 'required' ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                  [{req.priority.toUpperCase()}]
                </span>{' '}
                {req.requirement}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Validation Telemetry */}
      {validation && (
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
          Validation: {validation.valid ? 'PASSED' : 'ISSUES DETECTED'} · Confidence {Math.round(plan.confidence * 100)}% · Model: {plan.model}
        </div>
      )}
    </div>
  );
};

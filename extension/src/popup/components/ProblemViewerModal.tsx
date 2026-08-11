import React from 'react';
import { Problem } from '../../extraction/types';

interface ProblemViewerModalProps {
  problem: Problem;
  onClose: () => void;
}

export const ProblemViewerModal: React.FC<ProblemViewerModalProps> = ({ problem, onClose }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <span style={{ fontWeight: 600, fontSize: '13px' }}>Normalized Problem Object</span>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <div className="section-label">Title</div>
            <div style={{ fontWeight: 600, fontSize: '13px' }}>{problem.title}</div>
          </div>

          <div>
            <div className="section-label">Problem Statement</div>
            <pre className="code-block-preview">{problem.statement}</pre>
          </div>

          {problem.inputFormat && (
            <div>
              <div className="section-label">Input Format</div>
              <pre className="code-block-preview">{problem.inputFormat}</pre>
            </div>
          )}

          {problem.outputFormat && (
            <div>
              <div className="section-label">Output Format</div>
              <pre className="code-block-preview">{problem.outputFormat}</pre>
            </div>
          )}

          {problem.constraints && (
            <div>
              <div className="section-label">Constraints</div>
              <pre className="code-block-preview">{problem.constraints}</pre>
            </div>
          )}

          {problem.examples && problem.examples.length > 0 && (
            <div>
              <div className="section-label">Examples ({problem.examples.length})</div>
              {problem.examples.map((ex, idx) => (
                <div key={idx} style={{ background: 'var(--panel-bg)', padding: '6px', borderRadius: '4px', marginTop: '4px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600 }}>Example {idx + 1}</div>
                  {ex.input && <div><span className="section-label">Input:</span> <pre className="code-block-preview">{ex.input}</pre></div>}
                  {ex.output && <div><span className="section-label">Output:</span> <pre className="code-block-preview">{ex.output}</pre></div>}
                  {ex.explanation && <div><span className="section-label">Explanation:</span> {ex.explanation}</div>}
                </div>
              ))}
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
            <div className="section-label">Metadata</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              ID: {problem.id} · Character Count: {problem.metadata.characterCount} · Language: {problem.language || 'Not detected'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

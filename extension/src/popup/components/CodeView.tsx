import React, { useState, useEffect } from 'react';
import { SolutionPlanData, CodeGenerationState } from '../../runtime/runtime-state';
import { LanguageRegistry, SupportedLanguage, DEFAULT_LANGUAGE } from '../../shared/language-registry';
import { MonacoDiagnostics } from '../../content/adapters/types';

interface CodeViewProps {
  plan?: SolutionPlanData;
  codeState?: CodeGenerationState;
  detectedVersion?: string | null;
  detectedEditorLanguage?: string | null;
  onRequestCodeGeneration: (language: SupportedLanguage) => void;
  onInsertCode: (
    code: string,
    targetLanguage: SupportedLanguage,
    forceInsert?: boolean,
    mode?: 'instant' | 'progressive',
    insertionId?: string
  ) => Promise<{
    success: boolean;
    editorType: string;
    errorCode?: string;
    detectedEditorLanguage?: string | null;
    message?: string;
    diagnostics?: MonacoDiagnostics;
  }>;
  onCancelInsertion?: (insertionId?: string) => void;
}

export const CodeView: React.FC<CodeViewProps> = ({
  plan,
  codeState,
  detectedVersion,
  onRequestCodeGeneration,
  onInsertCode,
  onCancelInsertion,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(
    codeState?.generatedCode?.language || codeState?.targetLanguage || DEFAULT_LANGUAGE
  );
  const [copied, setCopied] = useState<boolean>(false);
  const [localInserting, setLocalInserting] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [activeInsertionId, setActiveInsertionId] = useState<string | null>(null);
  const [insertResult, setInsertResult] = useState<{
    status: 'idle' | 'success' | 'failed' | 'mismatch';
    message: string;
    errorCode?: string;
    detectedLang?: string | null;
    diagnostics?: MonacoDiagnostics;
  }>({
    status: 'idle',
    message: '',
  });

  const generatedCode = codeState?.generatedCode;
  const currentStatus = codeState?.status || (plan ? 'PLAN_READY' : 'NOT_READY');
  const isBusy = currentStatus === 'GENERATING' || currentStatus === 'INSERTING' || localInserting;

  useEffect(() => {
    if (codeState?.generatedCode?.language) {
      setSelectedLanguage(codeState.generatedCode.language);
    }
  }, [codeState?.generatedCode?.language]);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      const listener = (msg: any) => {
        if (msg?.type === 'INSERT_CODE_PROGRESS') {
          if (typeof msg.progress === 'number') {
            setProgressPercent(msg.progress);
          }
        }
      };
      chrome.runtime.onMessage.addListener(listener);
      return () => {
        try {
          chrome.runtime.onMessage.removeListener(listener);
        } catch {
          // Ignore
        }
      };
    }
    return undefined;
  }, []);

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setSelectedLanguage(newLang);
    setInsertResult({ status: 'idle', message: '' });
  };

  const handleCopy = () => {
    if (generatedCode?.code) {
      navigator.clipboard.writeText(generatedCode.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const executeInsertion = async (force: boolean = false) => {
    if (!generatedCode?.code || isBusy) return;

    const insId = `ins_${Date.now()}`;
    setActiveInsertionId(insId);
    setLocalInserting(true);
    setProgressPercent(0);
    setInsertResult({ status: 'idle', message: '' });

    try {
      const res = await onInsertCode(generatedCode.code, selectedLanguage, force, 'progressive', insId);
      if (res.success) {
        setInsertResult({
          status: 'success',
          message: res.message || '✓ Inserted and verified',
          diagnostics: res.diagnostics,
        });
      } else if (res.errorCode === 'INSERTION_CANCELLED') {
        setInsertResult({
          status: 'failed',
          errorCode: 'INSERTION_CANCELLED',
          message: 'INSERTION_CANCELLED',
          diagnostics: res.diagnostics,
        });
      } else if (res.errorCode === 'LANGUAGE_MISMATCH') {
        setInsertResult({
          status: 'mismatch',
          errorCode: 'LANGUAGE_MISMATCH',
          detectedLang: res.detectedEditorLanguage,
          message: `Language mismatch`,
          diagnostics: res.diagnostics,
        });
      } else {
        setInsertResult({
          status: 'failed',
          errorCode: res.errorCode || 'EDITOR_NOT_ACCESSIBLE',
          message: res.message || 'Failed to insert code into editor.',
          diagnostics: res.diagnostics,
        });
      }
    } catch (err) {
      setInsertResult({
        status: 'failed',
        errorCode: 'EDITOR_NOT_ACCESSIBLE',
        message: err instanceof Error ? err.message : 'Unknown error during insertion',
      });
    } finally {
      setLocalInserting(false);
      setActiveInsertionId(null);
    }
  };

  const handleCancel = () => {
    if (activeInsertionId && onCancelInsertion) {
      onCancelInsertion(activeInsertionId);
    }
    setLocalInserting(false);
    setActiveInsertionId(null);
    setInsertResult({
      status: 'failed',
      errorCode: 'INSERTION_CANCELLED',
      message: 'INSERTION_CANCELLED',
    });
  };

  const versionDisplay = LanguageRegistry.resolveVersionDisplay(selectedLanguage, detectedVersion);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', boxSizing: 'border-box' }}>
      {/* 1. Compact Responsive Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#1e293b',
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid #334155',
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>LANG:</span>
          <select
            value={selectedLanguage}
            onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
            disabled={isBusy || !plan}
            style={{
              flex: 1,
              minWidth: 0,
              background: '#0f172a',
              color: '#f8fafc',
              border: '1px solid #475569',
              borderRadius: '4px',
              padding: '4px 6px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: isBusy || !plan ? 'not-allowed' : 'pointer',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {LanguageRegistry.getSupportedList().map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.id === selectedLanguage ? versionDisplay : lang.displayName}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => onRequestCodeGeneration(selectedLanguage)}
          disabled={isBusy || !plan}
          style={{
            flexShrink: 0,
            background: isBusy || !plan ? '#475569' : '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            padding: '5px 12px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: isBusy || !plan ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          {currentStatus === 'GENERATING' && <span className="btn-spinner"></span>}
          <span>{currentStatus === 'GENERATING' ? 'Generating...' : generatedCode ? 'Regenerate' : 'Generate Code'}</span>
        </button>
      </div>

      {/* 2. Prerequisite Guard */}
      {!plan && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            background: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            color: '#fde047',
            fontSize: '11px',
          }}
        >
          ⚠️ Solution Plan required. Please generate a plan in Solution Plan tab first.
        </div>
      )}

      {/* 3. Failure State Alert */}
      {codeState?.status === 'FAILED' && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            fontSize: '11px',
          }}
        >
          ❌ Code Generation Failed: {codeState.error || 'Unknown error occurred.'}
        </div>
      )}

      {/* 4. Language Mismatch Warning Card */}
      {insertResult.status === 'mismatch' && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            color: '#fbbf24',
            fontSize: '11px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ fontWeight: 700 }}>Language mismatch</div>
          <div>
            CodePilot: <strong>{LanguageRegistry.getInfo(selectedLanguage).displayName}</strong> | Editor: <strong>{insertResult.detectedLang ? LanguageRegistry.getInfo(insertResult.detectedLang as SupportedLanguage).displayName : 'Unknown'}</strong>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            {insertResult.detectedLang && LanguageRegistry.isSupported(insertResult.detectedLang) && (
              <button
                onClick={() => {
                  const newLang = LanguageRegistry.normalize(insertResult.detectedLang);
                  setSelectedLanguage(newLang);
                  onRequestCodeGeneration(newLang);
                }}
                style={{
                  background: '#d97706',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Switch to {LanguageRegistry.getInfo(insertResult.detectedLang as SupportedLanguage).displayName} & Regenerate
              </button>
            )}
            <button
              onClick={() => executeInsertion(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#fef08a',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Force Insert {LanguageRegistry.getInfo(selectedLanguage).displayName}
            </button>
          </div>
        </div>
      )}

      {/* 5. Insertion Error Card (EDITOR_NOT_FOUND / EDITOR_NOT_ACCESSIBLE) */}
      {insertResult.status === 'failed' && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#fca5a5',
            fontSize: '11px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ fontWeight: 700 }}>
            {insertResult.errorCode === 'EDITOR_NOT_FOUND' ? 'EDITOR_NOT_FOUND' : 'EDITOR_NOT_ACCESSIBLE'}
          </div>
          <div>{insertResult.message}</div>
          <button
            onClick={() => executeInsertion(false)}
            style={{
              alignSelf: 'flex-start',
              background: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 10px',
              fontSize: '10px',
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: '4px',
            }}
          >
            Retry Insert
          </button>
        </div>
      )}

      {/* 6. Success Banner */}
      {insertResult.status === 'success' && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            fontSize: '11px',
            fontWeight: 600,
          }}
        >
          ✅ {insertResult.message}
        </div>
      )}

      {/* 6b. Monaco Diagnostics Panel */}
      {insertResult.diagnostics && (
        <div
          style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '8px 10px',
            fontSize: '11px',
            fontFamily: 'monospace',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            color: '#cbd5e1',
          }}
        >
          <div style={{ fontWeight: 700, color: '#94a3b8', borderBottom: '1px solid #1e293b', paddingBottom: '4px', marginBottom: '2px' }}>
            📊 MONACO DIAGNOSTICS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            <div>Bridge: <strong style={{ color: (insertResult.diagnostics.bridge || 'CONNECTED') === 'CONNECTED' ? '#34d399' : '#fca5a5' }}>{insertResult.diagnostics.bridge || 'CONNECTED'}</strong></div>
            <div>Monaco Runtime: <strong style={{ color: insertResult.diagnostics.monacoRuntime === 'FOUND' ? '#34d399' : '#fca5a5' }}>{insertResult.diagnostics.monacoRuntime}</strong></div>
            <div>Active Editor: <strong style={{ color: insertResult.diagnostics.activeEditor === 'FOUND' ? '#34d399' : '#fca5a5' }}>{insertResult.diagnostics.activeEditor}</strong></div>
            <div>Model: <strong style={{ color: insertResult.diagnostics.model === 'FOUND' ? '#34d399' : '#fca5a5' }}>{insertResult.diagnostics.model}</strong></div>
            <div>Write: <strong style={{ color: insertResult.diagnostics.write === 'PASS' ? '#34d399' : '#fca5a5' }}>{insertResult.diagnostics.write}</strong></div>
            <div>Readback: <strong style={{ color: insertResult.diagnostics.readback === 'PASS' ? '#34d399' : '#fca5a5' }}>{insertResult.diagnostics.readback}</strong></div>
            <div>Verification: <strong style={{ color: insertResult.diagnostics.verification === 'PASS' ? '#34d399' : '#fca5a5' }}>{insertResult.diagnostics.verification}</strong></div>
            <div>Expected Length: <strong>{insertResult.diagnostics.expectedLength}</strong></div>
            <div>Actual Length: <strong>{insertResult.diagnostics.actualLength}</strong></div>
          </div>
          <div style={{ wordBreak: 'break-all', marginTop: '2px', color: '#64748b' }}>
            Model URI: <span style={{ color: '#93c5fd' }}>{insertResult.diagnostics.modelUri || 'N/A'}</span>
          </div>
        </div>
      )}

      {/* 7. Code Generation Loading State */}
      {currentStatus === 'GENERATING' && (
        <div className="code-loading-skeleton">
          <div className="loading-badge">
            <span className="btn-spinner"></span>
            <span>Synthesizing {LanguageRegistry.getInfo(selectedLanguage).displayName} Solution...</span>
          </div>

          <div style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', gap: '6px', flexDirection: 'column', margin: '2px 0' }}>
            <div>✓ Enforcing Platform Rules ({selectedLanguage === 'java' ? 'Class Solution / Main' : 'Standard Rules'})</div>
            <div>⚡ Testing Algorithm Logic vs Examples...</div>
            <div>🛡️ Validating Braces & Zero-Comment Policy...</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: 0.8 }}>
            <div className="shimmer-line" style={{ width: '45%' }}></div>
            <div className="shimmer-line" style={{ width: '70%', marginLeft: '16px' }}></div>
            <div className="shimmer-line" style={{ width: '85%', marginLeft: '16px' }}></div>
            <div className="shimmer-line" style={{ width: '60%', marginLeft: '32px' }}></div>
            <div className="shimmer-line" style={{ width: '75%', marginLeft: '32px' }}></div>
            <div className="shimmer-line" style={{ width: '40%', marginLeft: '16px' }}></div>
            <div className="shimmer-line" style={{ width: '25%' }}></div>
          </div>
        </div>
      )}

      {/* 8. Code Display & Scroll Area */}
      {generatedCode && currentStatus !== 'GENERATING' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Actions Subbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#60a5fa',
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              {LanguageRegistry.getInfo(generatedCode.language).displayName}
            </span>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              onClick={handleCopy}
              disabled={isBusy}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#e2e8f0',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: isBusy ? 'not-allowed' : 'pointer',
              }}
            >
              {copied ? 'Copied!' : 'Copy Code'}
            </button>

            {localInserting ? (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button
                  disabled
                  style={{
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span className="btn-spinner"></span>
                  <span>Inserting... {progressPercent}%</span>
                </button>
                <button
                  onClick={handleCancel}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => executeInsertion(false)}
                disabled={isBusy}
                style={{
                  background: isBusy ? '#475569' : '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: isBusy ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>Insert to Editor</span>
              </button>
            )}
          </div>
          </div>

          {/* Dedicated Scroll Container */}
          <pre
            style={{
              flex: 1,
              margin: 0,
              background: '#0f172a',
              color: '#f8fafc',
              padding: '10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontFamily: 'Consolas, Monaco, "Fira Code", monospace',
              overflowY: 'auto',
              overflowX: 'auto',
              maxHeight: '260px',
              border: '1px solid #1e293b',
              lineHeight: '1.4',
              whiteSpace: 'pre',
            }}
          >
            <code>{generatedCode.code}</code>
          </pre>
        </div>
      )}
    </div>
  );
};

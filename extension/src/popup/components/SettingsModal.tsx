import React, { useState, useEffect } from 'react';
import { SettingsStorage, UserSettings, SupportedAIProvider, DEFAULT_SETTINGS } from '../../storage/settings-storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      SettingsStorage.getSettings().then((loaded) => setSettings(loaded));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage({ text: 'Saving settings...', type: 'info' });

    try {
      await SettingsStorage.saveSettings(settings);
      setStatusMessage({ text: 'Settings saved successfully!', type: 'success' });
      setTimeout(() => {
        setStatusMessage(null);
        onClose();
      }, 1000);
    } catch {
      setStatusMessage({ text: 'Failed to save settings.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '340px',
          background: '#0f172a',
          color: '#f8fafc',
          border: '1px solid #334155',
          borderRadius: '8px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #1e293b',
            background: '#1e293b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>⚙️</span>
            <span style={{ fontWeight: 700, fontSize: '13px', color: '#f8fafc' }}>
              AI Provider & Key Settings
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '18px',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Provider Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1' }}>
              AI Service Provider
            </label>
            <select
              value={settings.aiProvider}
              onChange={(e) => setSettings({ ...settings, aiProvider: e.target.value as SupportedAIProvider })}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #475569',
                fontSize: '12px',
                outline: 'none',
              }}
            >
              <option value="groq">Groq (Ultra-Fast, Llama-3)</option>
              <option value="openrouter">OpenRouter (100+ AI Models)</option>
              <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
              <option value="gemini">Google Gemini (Gemini 1.5 Flash)</option>
              <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
              <option value="mock">Mock Engine (Offline Sandbox)</option>
            </select>
          </div>

          {/* API Key Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1' }}>
                Your Custom API Key
              </label>
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#60a5fa',
                  fontSize: '10px',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showApiKey ? 'text' : 'password'}
              placeholder={
                settings.aiProvider === 'groq'
                  ? 'gsk_...'
                  : settings.aiProvider === 'openai'
                  ? 'sk-proj-...'
                  : settings.aiProvider === 'gemini'
                  ? 'AIzaSy...'
                  : 'sk-ant-...'
              }
              value={settings.apiKey}
              onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #475569',
                fontSize: '12px',
                outline: 'none',
                fontFamily: 'monospace',
              }}
            />
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>
              Stored locally in your browser. Leave empty to use backend default.
            </span>
          </div>

          {/* Backend Server URL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1' }}>
              CodePilot Server Endpoint
            </label>
            <input
              type="text"
              placeholder="http://localhost:3000"
              value={settings.serverUrl}
              onChange={(e) => setSettings({ ...settings, serverUrl: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #475569',
                fontSize: '12px',
                outline: 'none',
              }}
            />
          </div>

          {/* Status Alert */}
          {statusMessage && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                background:
                  statusMessage.type === 'success'
                    ? 'rgba(16, 185, 129, 0.2)'
                    : statusMessage.type === 'error'
                    ? 'rgba(239, 68, 68, 0.2)'
                    : 'rgba(59, 130, 246, 0.2)',
                color:
                  statusMessage.type === 'success'
                    ? '#34d399'
                    : statusMessage.type === 'error'
                    ? '#f87171'
                    : '#60a5fa',
                border: `1px solid ${
                  statusMessage.type === 'success'
                    ? '#10b981'
                    : statusMessage.type === 'error'
                    ? '#ef4444'
                    : '#3b82f6'
                }`,
              }}
            >
              {statusMessage.text}
            </div>
          )}

          {/* Footer Actions */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: 'transparent',
                color: '#cbd5e1',
                border: '1px solid #475569',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontSize: '11px',
                fontWeight: 700,
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

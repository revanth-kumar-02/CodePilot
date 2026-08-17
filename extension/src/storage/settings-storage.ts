export type SupportedAIProvider = 'groq' | 'openrouter' | 'openai' | 'gemini' | 'anthropic' | 'mock';

export interface UserSettings {
  aiProvider: SupportedAIProvider;
  apiKey: string;
  groqAnalysisKey?: string;
  groqReasoningKey?: string;
  groqCodeKey?: string;
  serverUrl: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  aiProvider: 'groq',
  apiKey: '',
  groqAnalysisKey: '',
  groqReasoningKey: '',
  groqCodeKey: '',
  serverUrl: 'https://codepilot-6hi8.onrender.com',
};

export class SettingsStorage {
  private static STORAGE_KEY = 'codepilot_user_settings';

  public static async getSettings(): Promise<UserSettings> {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return DEFAULT_SETTINGS;
    }

    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([this.STORAGE_KEY], (items) => {
          if (items && items[this.STORAGE_KEY]) {
            resolve({
              ...DEFAULT_SETTINGS,
              ...items[this.STORAGE_KEY],
            });
          } else {
            resolve(DEFAULT_SETTINGS);
          }
        });
      } catch {
        resolve(DEFAULT_SETTINGS);
      }
    });
  }

  public static async saveSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    const current = await this.getSettings();
    const updated: UserSettings = {
      ...current,
      ...settings,
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await new Promise<void>((resolve) => {
        try {
          chrome.storage.local.set({ [this.STORAGE_KEY]: updated }, () => resolve());
        } catch {
          resolve();
        }
      });
    }

    return updated;
  }
}

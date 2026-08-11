import { Problem } from '../extraction/types';
import { ProblemAnalysisData, SolutionPlanData } from '../runtime/runtime-state';

export interface ProblemSessionCode {
  status: 'not-started' | 'generating' | 'ready' | 'failed';
  language: string | null;
  version: string | null;
  source: string | null;
  error?: string;
  explanation?: string[];
}

export interface ProblemSessionEditor {
  detected: boolean;
  adapter: string | null;
  inserted: boolean;
}

export interface ProblemSession {
  schemaVersion: 1;
  sessionId: string;
  tabId: number;
  platform: string;
  url: string;
  problemFingerprint: string;
  problem: Problem | null;
  aiAnalysis: ProblemAnalysisData | null;
  solutionPlan: SolutionPlanData | null;
  code: ProblemSessionCode;
  editor: ProblemSessionEditor;
  status: 'active' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
}

export interface SessionDiagnostics {
  sessionId: string | null;
  tabId: number;
  problem: 'PASS' | 'MISSING';
  aiAnalysis: 'PASS' | 'MISSING';
  solutionPlan: 'PASS' | 'MISSING';
  code: 'PASS' | 'MISSING';
  language: string | null;
  version: string | null;
  sessionStatus: string;
  lastUpdated: number | null;
}

const memoryFallbackStorage = new Map<string, any>();

function getStorageArea(): chrome.storage.StorageArea | null {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return chrome.storage.session || chrome.storage.local;
  }
  return null;
}

export class SessionStore {
  public static getSessionKey(tabId: number): string {
    return `codepilot_session_${tabId}`;
  }

  public static createFingerprint(url: string, title?: string): string {
    try {
      const parsed = new URL(url);
      const cleanPath = parsed.pathname.replace(/\/+$/, '');
      const raw = `${parsed.hostname}${cleanPath}:${title || ''}`.toLowerCase();
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        hash = (hash << 5) - hash + raw.charCodeAt(i);
        hash |= 0;
      }
      return `fp_${Math.abs(hash).toString(36)}`;
    } catch {
      return `fp_${(title || url).toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    }
  }

  public static async createSession(
    tabId: number,
    url: string,
    platform: string = 'unknown',
    problemTitle?: string
  ): Promise<ProblemSession> {
    const fingerprint = this.createFingerprint(url, problemTitle);
    const now = Date.now();
    const newSession: ProblemSession = {
      schemaVersion: 1,
      sessionId: `session_${tabId}_${now}`,
      tabId,
      platform,
      url,
      problemFingerprint: fingerprint,
      problem: null,
      aiAnalysis: null,
      solutionPlan: null,
      code: {
        status: 'not-started',
        language: null,
        version: null,
        source: null,
      },
      editor: {
        detected: false,
        adapter: null,
        inserted: false,
      },
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await this.writeRaw(this.getSessionKey(tabId), newSession);
    return newSession;
  }

  public static async getSession(tabId: number): Promise<ProblemSession | null> {
    const raw = await this.readRaw(this.getSessionKey(tabId));
    if (!raw) return null;

    if (!raw.schemaVersion || raw.schemaVersion !== 1 || !raw.sessionId || typeof raw.tabId !== 'number') {
      return null; // SESSION_INVALID schema recovery
    }

    return raw as ProblemSession;
  }

  public static async updateSession(
    tabId: number,
    updates: Partial<ProblemSession>,
    expectedFingerprint?: string
  ): Promise<ProblemSession | null> {
    const current = await this.getSession(tabId);
    if (!current) return null;

    // Stale Response Protection
    if (expectedFingerprint && current.problemFingerprint !== expectedFingerprint) {
      return current; // Ignore update for superseded session
    }

    const merged: ProblemSession = {
      ...current,
      ...updates,
      code: {
        ...current.code,
        ...(updates.code || {}),
      },
      editor: {
        ...current.editor,
        ...(updates.editor || {}),
      },
      schemaVersion: 1,
      tabId: current.tabId,
      sessionId: current.sessionId,
      createdAt: current.createdAt,
      updatedAt: Date.now(),
    };

    await this.writeRaw(this.getSessionKey(tabId), merged);
    return merged;
  }

  public static async clearSession(tabId: number): Promise<void> {
    const storage = getStorageArea();
    const key = this.getSessionKey(tabId);
    if (storage) {
      await new Promise<void>((resolve) => {
        storage.remove(key, () => resolve());
      });
    } else {
      memoryFallbackStorage.delete(key);
    }
  }

  public static async completeSession(tabId: number): Promise<void> {
    const session = await this.getSession(tabId);
    if (!session) return;

    const completed = await this.updateSession(tabId, {
      status: 'completed',
      editor: {
        ...session.editor,
        inserted: true,
      },
    });

    if (completed) {
      // Clean up active session safely after completion
      await this.clearSession(tabId);
    }
  }

  public static async getDiagnostics(tabId: number): Promise<SessionDiagnostics> {
    const session = await this.getSession(tabId);
    if (!session) {
      return {
        sessionId: null,
        tabId,
        problem: 'MISSING',
        aiAnalysis: 'MISSING',
        solutionPlan: 'MISSING',
        code: 'MISSING',
        language: null,
        version: null,
        sessionStatus: 'no-session',
        lastUpdated: null,
      };
    }

    return {
      sessionId: session.sessionId,
      tabId: session.tabId,
      problem: session.problem ? 'PASS' : 'MISSING',
      aiAnalysis: session.aiAnalysis ? 'PASS' : 'MISSING',
      solutionPlan: session.solutionPlan ? 'PASS' : 'MISSING',
      code: session.code?.source ? 'PASS' : 'MISSING',
      language: session.code?.language || null,
      version: session.code?.version || null,
      sessionStatus: session.status,
      lastUpdated: session.updatedAt,
    };
  }

  private static async readRaw(key: string): Promise<any> {
    const storage = getStorageArea();
    if (storage) {
      return new Promise<any>((resolve) => {
        storage.get(key, (items) => {
          resolve(items?.[key] || null);
        });
      });
    }
    return memoryFallbackStorage.get(key) || null;
  }

  private static async writeRaw(key: string, data: any): Promise<void> {
    const storage = getStorageArea();
    if (storage) {
      return new Promise<void>((resolve) => {
        storage.set({ [key]: data }, () => resolve());
      });
    }
    memoryFallbackStorage.set(key, data);
  }
}

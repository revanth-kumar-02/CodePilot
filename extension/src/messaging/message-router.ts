import { ExtensionRuntime } from '../runtime';
import { MessageValidator } from './message-validator';
import {
  RuntimeMessageType,
  RuntimeStateResponsePayload,
  GetAllTabStatesResponsePayload,
  PageDetectionResponseMessage,
  ProblemExtractionResponseMessage,
  RuntimeErrorResponse,
  BaseMessage,
  ExtensionStatusResponsePayload,
} from './message-types';
import { PageDetector } from '../detection/page-detector';
import { PageFeatureExtractor } from '../detection/feature-extractor';
import { Logger } from '../shared/utils/logger';
import { LanguageRegistry } from '../shared/language-registry';
import { SessionStore, ProblemSession } from '../storage/session-store';

const logger = new Logger('MessageRouter');

export class MessageRouter {
  private runtime: ExtensionRuntime;

  constructor(runtime: ExtensionRuntime) {
    this.runtime = runtime;
  }

  public async syncSessionToTabState(tabId: number): Promise<ProblemSession | null> {
    const session = await SessionStore.getSession(tabId);
    if (!session) return null;

    const updates: any = { problemSession: session };

    if (session.problem) {
      updates.problemExtraction = {
        status: 'success',
        result: {
          status: 'success',
          confidence: 0.9,
          durationMs: 0,
          warnings: [],
          errors: [],
          fields: [],
          problem: session.problem,
        },
        lastUpdated: session.updatedAt,
      };
    }

    if (session.aiAnalysis) {
      updates.aiAnalysis = {
        status: session.aiAnalysis.status === 'insufficient_information' ? 'insufficient-information' : 'success',
        analysis: session.aiAnalysis,
        lastUpdated: session.updatedAt,
      };
    }

    if (session.solutionPlan) {
      updates.reasoning = {
        status: session.solutionPlan.status || 'ready',
        plan: session.solutionPlan,
        lastUpdated: session.updatedAt,
      };
    }

    if (session.code) {
      updates.codeGeneration = {
        status:
          session.code.status === 'ready'
            ? 'CODE_READY'
            : session.code.status === 'generating'
            ? 'GENERATING'
            : session.code.status === 'failed'
            ? 'FAILED'
            : 'NOT_READY',
        targetLanguage: session.code.language || undefined,
        detectedVersion: session.code.version || null,
        generatedCode: session.code.source
          ? {
              code: session.code.source,
              language: session.code.language || 'cpp',
              version: session.code.version || undefined,
              explanation: session.code.explanation || [],
              completeness: true,
              model: 'qwen/qwen-2.5-coder-32b-instruct',
              provider: 'openrouter',
              generatedAt: session.updatedAt,
            }
          : undefined,
        error: session.code.error,
        lastUpdated: session.updatedAt,
      };
    }

    this.runtime.tabManager.updateTab(tabId, updates);
    return session;
  }

  public async route(
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ): Promise<boolean> {
    const validation = MessageValidator.validate(message);
    if (!validation.valid) {
      logger.warn('Invalid runtime message received:', validation.error);
      sendResponse(validation.error);
      return false;
    }

    const msg = message as BaseMessage & {
      forceRefresh?: boolean;
      targetLanguage?: string;
      code?: string;
      payload?: any;
    };
    logger.info(`Routing message: ${msg.type} from ${sender.tab ? `tab ${sender.tab.id}` : 'popup/internal'}`);

    try {
      switch (msg.type as RuntimeMessageType) {
        case 'GET_RUNTIME_STATE': {
          const activeTab = await this.runtime.tabManager.syncActiveTab();
          if (activeTab?.tabId) {
            await this.syncSessionToTabState(activeTab.tabId);
          }
          const updatedActiveTab = this.runtime.tabManager.getActiveTab();
          const windows = this.runtime.windowManager.getAllWindows();

          sendResponse({
            activeTabState: updatedActiveTab,
            windows,
            timestamp: Date.now(),
          } satisfies RuntimeStateResponsePayload);
          break;
        }

        case 'GET_ACTIVE_TAB': {
          const activeTab = await this.runtime.tabManager.syncActiveTab();
          if (activeTab?.tabId) {
            await this.syncSessionToTabState(activeTab.tabId);
          }
          const updatedActiveTab = this.runtime.tabManager.getActiveTab();
          sendResponse({ activeTabState: updatedActiveTab });
          break;
        }

        case 'GET_ALL_TAB_STATES': {
          await this.runtime.tabManager.syncActiveTab();
          const tabs = this.runtime.tabManager.getAllTabs();
          for (const tab of tabs) {
            if (tab.tabId) {
              await this.syncSessionToTabState(tab.tabId);
            }
          }
          const activeTab = this.runtime.tabManager.getActiveTab();

          sendResponse({
            tabs: this.runtime.tabManager.getAllTabs(),
            activeTabId: activeTab ? activeTab.tabId : null,
            timestamp: Date.now(),
          } satisfies GetAllTabStatesResponsePayload);
          break;
        }

        case 'GET_SESSION': {
          const activeTab = await this.runtime.tabManager.syncActiveTab();
          const tabId = msg.tabId || activeTab?.tabId;
          const session = tabId ? await SessionStore.getSession(tabId) : null;
          sendResponse({ session });
          break;
        }

        case 'UPDATE_SESSION': {
          const activeTab = await this.runtime.tabManager.syncActiveTab();
          const tabId = msg.tabId || activeTab?.tabId;
          const updates = (msg.payload || msg) as Partial<ProblemSession>;
          const session = tabId ? await SessionStore.updateSession(tabId, updates) : null;
          if (tabId) await this.syncSessionToTabState(tabId);
          sendResponse({ session });
          break;
        }

        case 'CLEAR_SESSION': {
          const activeTab = await this.runtime.tabManager.syncActiveTab();
          const tabId = msg.tabId || activeTab?.tabId;
          if (tabId) await SessionStore.clearSession(tabId);
          sendResponse({ status: 'OK' });
          break;
        }

        case 'GET_SESSION_DIAGNOSTICS': {
          const activeTab = await this.runtime.tabManager.syncActiveTab();
          const tabId = msg.tabId || activeTab?.tabId || 0;
          const diagnostics = await SessionStore.getDiagnostics(tabId);
          sendResponse({ diagnostics });
          break;
        }

        case 'GET_EXTENSION_STATUS': {
          const activeTab = await this.runtime.tabManager.syncActiveTab();
          let isLiveConnected = false;
          if (activeTab && activeTab.tabId) {
            try {
              const pingResponse = await new Promise<any>((resolve) => {
                chrome.tabs.sendMessage(activeTab.tabId, { type: 'PING_CONTENT_SCRIPT' }, (res) => {
                  resolve(chrome.runtime.lastError ? null : res);
                });
              });
              if (pingResponse && (pingResponse.ready || pingResponse.type === 'PONG')) {
                isLiveConnected = true;
              }
            } catch {
              isLiveConnected = false;
            }
          }
          sendResponse({
            status: 'connected',
            contentScriptConnected: isLiveConnected || activeTab?.contentScript === 'ready',
            codingPageDetected: activeTab?.pageDetection?.result?.type === 'coding-problem',
            tabId: activeTab?.tabId,
            message: 'Extension background worker active',
          } satisfies ExtensionStatusResponsePayload);
          break;
        }

        case 'CONTENT_SCRIPT_READY': {
          if (sender.tab && sender.tab.id) {
            const tabId = sender.tab.id;
            this.runtime.contentScriptManager.handleContentScriptReady(tabId, Date.now());
            logger.info(`Content script registered as READY for tab ${tabId}`);
            sendResponse({ type: 'CONTENT_SCRIPT_ACK', timestamp: Date.now() });
          } else {
            sendResponse({
              code: 'TAB_NOT_FOUND',
              message: 'Content script sender tab missing.',
            } satisfies RuntimeErrorResponse);
          }
          break;
        }

        case 'REQUEST_PAGE_DETECTION': {
          const activeTab = this.runtime.tabManager.getActiveTab();
          if (!activeTab) {
            sendResponse({
              code: 'TAB_NOT_FOUND',
              message: 'No active tab found to execute page detection.',
            } satisfies RuntimeErrorResponse);
            return false;
          }

          const targetTabId = activeTab.tabId;

          chrome.tabs.sendMessage(targetTabId, { type: 'PING_CONTENT_SCRIPT' }, (csResponse) => {
            const err1 = chrome.runtime.lastError;
            if (err1 || !csResponse) {
              const domSnapshot = PageFeatureExtractor.extractFallbackFromTabState(activeTab);
              const detectionResult = PageDetector.detect(domSnapshot);

              this.runtime.tabManager.updateTab(targetTabId, {
                pageDetection: {
                  status: 'detected',
                  result: detectionResult,
                  lastUpdated: Date.now(),
                },
              });

              sendResponse({
                type: 'PAGE_DETECTION_RESULT',
                result: detectionResult,
              } satisfies PageDetectionResponseMessage);
              return;
            }

            chrome.tabs.sendMessage(targetTabId, { type: 'REQUEST_PAGE_DETECTION' }, (response) => {
              const err2 = chrome.runtime.lastError;
              if (err2 || !response || !response.result) {
                const domSnapshot = PageFeatureExtractor.extractFallbackFromTabState(activeTab);
                const detectionResult = PageDetector.detect(domSnapshot);

                this.runtime.tabManager.updateTab(targetTabId, {
                  pageDetection: {
                    status: 'detected',
                    result: detectionResult,
                    lastUpdated: Date.now(),
                  },
                });

                sendResponse({
                  type: 'PAGE_DETECTION_RESULT',
                  result: detectionResult,
                } satisfies PageDetectionResponseMessage);
              } else {
                this.runtime.tabManager.updateTab(targetTabId, {
                  pageDetection: {
                    status: 'detected',
                    result: response.result,
                    lastUpdated: Date.now(),
                  },
                });

                sendResponse({
                  type: 'PAGE_DETECTION_RESULT',
                  result: response.result,
                } satisfies PageDetectionResponseMessage);
              }
            });
          });

          return true;
        }

        case 'REQUEST_PROBLEM_EXTRACTION': {
          const activeTab = this.runtime.tabManager.getActiveTab();
          if (!activeTab) {
            sendResponse({
              code: 'TAB_NOT_FOUND',
              message: 'No active tab found to execute problem extraction.',
            } satisfies RuntimeErrorResponse);
            return false;
          }

          const targetTabId = activeTab.tabId;
          const currentSession = await SessionStore.getSession(targetTabId);

          chrome.tabs.sendMessage(targetTabId, { type: 'REQUEST_PROBLEM_EXTRACTION' }, async (response) => {
            const err3 = chrome.runtime.lastError;
            if (err3 || !response || !response.result || !response.result.problem) {
              sendResponse({
                type: 'PROBLEM_EXTRACTION_RESULT',
                result: {
                  status: 'failed',
                  confidence: 0,
                  durationMs: 0,
                  warnings: [],
                  errors: ['DATA_NOT_AVAILABLE: Unable to extract problem statement from active page.'],
                  fields: [],
                  problem: null,
                },
              } satisfies ProblemExtractionResponseMessage);
              return;
            }

            const extractedProblem = response.result.problem;
            const title = extractedProblem?.title || activeTab.title || 'Coding Problem';
            const newFingerprint = SessionStore.createFingerprint(activeTab.url, title);

            if (!currentSession || currentSession.problemFingerprint !== newFingerprint) {
              await SessionStore.createSession(
                targetTabId,
                activeTab.url,
                extractedProblem?.source?.hostname || 'unknown',
                title
              );
            }

            await SessionStore.updateSession(targetTabId, {
              problem: extractedProblem,
              platform: extractedProblem?.source?.hostname || 'unknown',
              url: activeTab.url,
            });

            await this.syncSessionToTabState(targetTabId);

            sendResponse({
              type: 'PROBLEM_EXTRACTION_RESULT',
              result: {
                status: extractedProblem ? 'success' : 'partial',
                confidence: 0.9,
                durationMs: 0,
                warnings: [],
                errors: [],
                fields: [],
                problem: extractedProblem,
              },
            } satisfies ProblemExtractionResponseMessage);
          });

          return true;
        }

        case 'REQUEST_AI_ANALYSIS': {
          const activeTab = this.runtime.tabManager.getActiveTab();
          if (!activeTab) {
            sendResponse({
              code: 'TAB_NOT_FOUND',
              message: 'No active tab to analyze.',
            } satisfies RuntimeErrorResponse);
            return false;
          }

          const tabId = activeTab.tabId;
          let session = await SessionStore.getSession(tabId);
          const existingProblem = session?.problem || activeTab.problemExtraction?.result?.problem;

          const performAnalysis = (problemPayload: any) => {
            this.runtime.tabManager.updateTab(tabId, {
              aiAnalysis: { status: 'pending', lastUpdated: Date.now() },
            });

            fetch('http://localhost:3000/api/ai/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ problem: problemPayload }),
            })
              .then(async (res) => {
                const data = (await res.json()) as {
                  status: string;
                  analysis?: any;
                  error?: { message?: string };
                };

                if (res.ok && data.status === 'success' && data.analysis) {
                  if (!session) {
                    session = await SessionStore.createSession(tabId, activeTab.url, 'unknown', problemPayload.title);
                  }
                  await SessionStore.updateSession(
                    tabId,
                    { problem: problemPayload, aiAnalysis: data.analysis },
                    session.problemFingerprint
                  );
                  await this.syncSessionToTabState(tabId);

                  sendResponse({
                    type: 'AI_ANALYSIS_RESULT',
                    analysis: data.analysis,
                  });
                } else {
                  const errMsg = data.error?.message || 'Failed to analyze problem with AI service.';
                  sendResponse({
                    type: 'AI_ANALYSIS_RESULT',
                    error: errMsg,
                  });
                }
              })
              .catch((err) => {
                const errMsg = err instanceof Error ? err.message : String(err);
                sendResponse({
                  type: 'AI_ANALYSIS_RESULT',
                  error: errMsg,
                });
              });
          };

          if (existingProblem && existingProblem.statement) {
            performAnalysis(existingProblem);
          } else {
            chrome.tabs.sendMessage(activeTab.tabId, { type: 'REQUEST_PROBLEM_EXTRACTION' }, (csResponse) => {
              if (!chrome.runtime.lastError && csResponse?.result?.problem) {
                performAnalysis(csResponse.result.problem);
              } else {
                sendResponse({
                  type: 'AI_ANALYSIS_RESULT',
                  error: 'DATA_NOT_AVAILABLE: No problem extracted. Please extract a problem first.',
                });
              }
            });
          }

          return true;
        }

        case 'REQUEST_REASONING': {
          const activeTab = this.runtime.tabManager.getActiveTab();
          if (!activeTab) {
            sendResponse({
              code: 'TAB_NOT_FOUND',
              message: 'No active tab to generate solution plan for.',
            } satisfies RuntimeErrorResponse);
            return false;
          }

          const tabId = activeTab.tabId;
          let session = await SessionStore.getSession(tabId);
          const extractedProblem = session?.problem || activeTab.problemExtraction?.result?.problem;

          if (!extractedProblem) {
            sendResponse({
              code: 'REASONING_SERVICE_ERROR',
              message: 'No extracted problem available for solution planning. Please extract a problem first.',
            } satisfies RuntimeErrorResponse);
            return false;
          }

          fetch('http://localhost:3000/api/ai/reason', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ problem: extractedProblem }),
          })
            .then(async (res) => {
              const data = (await res.json()) as {
                status: string;
                plan?: any;
                validation?: any;
                error?: { message?: string };
              };

              if (res.ok && data.status === 'success' && data.plan) {
                if (!session) {
                  session = await SessionStore.createSession(tabId, activeTab.url, 'unknown', extractedProblem.title);
                }
                await SessionStore.updateSession(
                  tabId,
                  { problem: extractedProblem, solutionPlan: data.plan },
                  session.problemFingerprint
                );
                await this.syncSessionToTabState(tabId);

                sendResponse({
                  type: 'REASONING_RESULT',
                  plan: data.plan,
                  validation: data.validation,
                });
              } else {
                const errMsg = data.error?.message || 'Failed to generate solution plan with reasoning engine.';
                sendResponse({
                  type: 'REASONING_RESULT',
                  error: errMsg,
                });
              }
            })
            .catch((err) => {
              const errMsg = err instanceof Error ? err.message : String(err);
              sendResponse({
                type: 'REASONING_RESULT',
                error: errMsg,
              });
            });

          return true;
        }

        case 'REQUEST_CODE_GENERATION': {
          const activeTab = this.runtime.tabManager.getActiveTab();
          if (!activeTab) {
            sendResponse({
              code: 'TAB_NOT_FOUND',
              message: 'No active tab to generate code for.',
            } satisfies RuntimeErrorResponse);
            return false;
          }

          const tabId = activeTab.tabId;
          let session = await SessionStore.getSession(tabId);

          const extractedProblem = session?.problem || activeTab.problemExtraction?.result?.problem;
          if (!extractedProblem) {
            sendResponse({
              code: 'CODE_GENERATION_ERROR',
              message: 'No extracted problem available. Please extract a problem first.',
            } satisfies RuntimeErrorResponse);
            return false;
          }

          const solutionPlan = session?.solutionPlan || activeTab.reasoning?.plan;
          if (!solutionPlan) {
            sendResponse({
              code: 'CODE_GENERATION_ERROR',
              message: 'No solution plan available. Please generate a solution plan first.',
            } satisfies RuntimeErrorResponse);
            return false;
          }

          const rawLang = msg.targetLanguage || msg.payload?.targetLanguage;
          const targetLang = LanguageRegistry.normalize(rawLang);

          if (!session) {
            session = await SessionStore.createSession(tabId, activeTab.url, 'unknown', extractedProblem.title);
          }

          await SessionStore.updateSession(
            tabId,
            {
              problem: extractedProblem,
              solutionPlan,
              code: { status: 'generating', language: targetLang, version: null, source: null },
            },
            session.problemFingerprint
          );
          await this.syncSessionToTabState(tabId);

          fetch('http://localhost:3000/api/ai/generate-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              problem: extractedProblem,
              plan: solutionPlan,
              targetLanguage: targetLang,
            }),
          })
            .then(async (res) => {
              const data = (await res.json()) as {
                status: string;
                generatedCode?: any;
                error?: { message?: string };
              };

              if (res.ok && data.status === 'success' && data.generatedCode) {
                const normalizedLang = LanguageRegistry.normalize(data.generatedCode.language);
                await SessionStore.updateSession(
                  tabId,
                  {
                    code: {
                      status: 'ready',
                      language: normalizedLang,
                      version: data.generatedCode.version || null,
                      source: data.generatedCode.code,
                      explanation: data.generatedCode.explanation || [],
                    },
                  },
                  session?.problemFingerprint
                );
                await this.syncSessionToTabState(tabId);

                sendResponse({
                  type: 'CODE_GENERATION_RESULT',
                  generatedCode: data.generatedCode,
                });
              } else {
                const errMsg = data.error?.message || 'Failed to generate source code.';
                await SessionStore.updateSession(
                  tabId,
                  {
                    code: { status: 'failed', language: targetLang, version: null, source: null, error: errMsg },
                  },
                  session?.problemFingerprint
                );
                await this.syncSessionToTabState(tabId);

                sendResponse({
                  type: 'CODE_GENERATION_RESULT',
                  error: errMsg,
                });
              }
            })
            .catch(async (err) => {
              const errMsg = err instanceof Error ? err.message : String(err);
              await SessionStore.updateSession(
                tabId,
                {
                  code: { status: 'failed', language: targetLang, version: null, source: null, error: errMsg },
                },
                session?.problemFingerprint
              );
              await this.syncSessionToTabState(tabId);

              sendResponse({
                type: 'CODE_GENERATION_RESULT',
                error: errMsg,
              });
            });

          return true;
        }

        case 'INSERT_CODE_TO_EDITOR': {
          const activeTab = this.runtime.tabManager.getActiveTab();
          if (!activeTab) {
            sendResponse({
              code: 'TAB_NOT_FOUND',
              message: 'No active tab to insert code into.',
            } satisfies RuntimeErrorResponse);
            return false;
          }

          const targetCode = msg.code || msg.payload?.code;

          if (!targetCode) {
            sendResponse({
              code: 'CODE_GENERATION_ERROR',
              message: 'No code payload provided to insert.',
            } satisfies RuntimeErrorResponse);
            return false;
          }

          chrome.tabs.sendMessage(
            activeTab.tabId,
            { type: 'INSERT_CODE_TO_EDITOR', code: targetCode },
            async (response) => {
              if (chrome.runtime.lastError || !response) {
                sendResponse({
                  type: 'INSERT_CODE_RESPONSE',
                  success: false,
                  editorType: 'unknown',
                  message: 'Content script unavailable to execute code insertion.',
                });
              } else {
                if (response.success) {
                  await SessionStore.completeSession(activeTab.tabId);
                  await this.syncSessionToTabState(activeTab.tabId);
                }
                sendResponse(response);
              }
            }
          );

          return true;
        }

        case 'GET_PROBLEM_EXTRACTION': {
          const activeTab = this.runtime.tabManager.getActiveTab();
          if (activeTab?.tabId) await this.syncSessionToTabState(activeTab.tabId);
          const updatedActiveTab = this.runtime.tabManager.getActiveTab();
          sendResponse({
            extractionState: updatedActiveTab?.problemExtraction || { status: 'not-started' },
          });
          break;
        }

        case 'CLEAR_PROBLEM_EXTRACTION': {
          const activeTab = this.runtime.tabManager.getActiveTab();
          if (activeTab?.tabId) {
            await SessionStore.clearSession(activeTab.tabId);
            this.runtime.tabManager.updateTab(activeTab.tabId, {
              problemExtraction: { status: 'not-started', lastUpdated: Date.now() },
              aiAnalysis: { status: 'not-started', lastUpdated: Date.now() },
              reasoning: { status: 'not-started', lastUpdated: Date.now() },
              codeGeneration: { status: 'NOT_READY', lastUpdated: Date.now() },
              problemSession: null,
            });
          }
          sendResponse({ status: 'OK' });
          break;
        }

        case 'PING_CONTENT_SCRIPT': {
          const targetTabId = msg.tabId || sender.tab?.id;
          if (!targetTabId) {
            sendResponse({
              code: 'TAB_NOT_FOUND',
              message: 'Target tab ID missing.',
            } satisfies RuntimeErrorResponse);
          } else {
            this.runtime.contentScriptManager.pingContentScript(targetTabId).then((ready) => {
              sendResponse({ ready, timestamp: Date.now() });
            });
            return true;
          }
          break;
        }

        default:
          sendResponse({
            code: 'INVALID_MESSAGE',
            message: `Unhandled runtime message type: ${msg.type}`,
          } satisfies RuntimeErrorResponse);
          break;
      }
    } catch (error) {
      logger.error('Unexpected error in MessageRouter:', error);
      sendResponse({
        code: 'RUNTIME_ERROR',
        message: error instanceof Error ? error.message : 'Unknown message routing error',
      } satisfies RuntimeErrorResponse);
    }

    return true;
  }
}

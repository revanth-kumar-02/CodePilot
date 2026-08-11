import { Logger } from '../shared/utils/logger';
import { PageDetector } from '../detection/page-detector';
import { PageDetectionResult } from '../detection/types';
import { ProblemExtractor } from '../extraction/problem-extractor';
import { ProblemExtractionResult } from '../extraction/types';
import { EditorManager } from './adapters/editor-manager';
import { ensurePageBridgeInjected } from './bridge-injector';
import {
  ContentScriptReadyMessage,
  ContentScriptAckResponse,
  BaseMessage,
  RequestPageDetectionMessage,
} from '../shared/types/messages';

const logger = new Logger('Content');

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;
const MAX_BOUNDED_RETRIES = 3;

function isContextValid(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
}

function safeSendMessage(message: any, callback?: (response: any) => void): void {
  if (!isContextValid()) return;
  try {
    if (callback) {
      chrome.runtime.sendMessage(message, (res) => {
        const err = chrome.runtime.lastError;
        if (err) return;
        callback(res);
      });
    } else {
      chrome.runtime.sendMessage(message, () => {
        void chrome.runtime.lastError;
      });
    }
  } catch {
    // Ignore context invalidation
  }
}

function runDetectionAndReport(forceRefresh = false): PageDetectionResult | null {
  try {
    const result = PageDetector.detectPage(document, window, forceRefresh);
    logger.info(`Page detected as: ${result.type} (confidence: ${result.confidence})`);

    safeSendMessage({
      type: 'PAGE_DETECTION_RESULT',
      result,
    });

    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Extension context invalidated')) {
      logger.warn('Extension context reloaded. Please refresh tab.');
    } else {
      logger.error('Error executing page detection:', error);
    }
    return null;
  }
}

function runExtractionAndReport(detection?: PageDetectionResult): ProblemExtractionResult | null {
  try {
    const activeDetection = detection || PageDetector.detectPage(document, window, false);
    const result = ProblemExtractor.extract(document, activeDetection);

    logger.info(`Problem extraction status: ${result.status} (confidence: ${result.confidence})`);

    safeSendMessage({
      type: 'PROBLEM_EXTRACTION_RESULT',
      result,
    });

    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Extension context invalidated')) {
      logger.warn('Extension context reloaded. Please refresh tab.');
    } else {
      logger.error('Error executing problem extraction:', error);
    }
    return null;
  }
}

function initMutationObserver(): void {
  if (typeof MutationObserver === 'undefined' || !document.body) return;

  const observer = new MutationObserver(() => {
    if (!isContextValid()) return;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      if (!isContextValid()) return;
      const detResult = runDetectionAndReport(true);

      if (detResult && (detResult.type === 'coding-problem' || detResult.type === 'coding')) {
        if (retryCount < MAX_BOUNDED_RETRIES) {
          retryCount++;
          logger.info(`Bounded extraction attempt ${retryCount}/${MAX_BOUNDED_RETRIES}`);
          const extResult = runExtractionAndReport(detResult);
          if (extResult?.status === 'success') {
            retryCount = MAX_BOUNDED_RETRIES;
          }
        }
      }
    }, 800);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function initializeContentScript(): void {
  logger.info('Content script initialized');

  ensurePageBridgeInjected();

  if (!isContextValid()) {
    logger.warn('Chrome runtime API unavailable in content script');
    return;
  }

  // 1. Initial Handshake
  const readyMessage: ContentScriptReadyMessage = {
    type: 'CONTENT_SCRIPT_READY',
    timestamp: Date.now(),
  };

  safeSendMessage(readyMessage, (response: ContentScriptAckResponse) => {
    if (response?.type === 'CONTENT_SCRIPT_ACK') {
      logger.info('Received CONTENT_SCRIPT_ACK from background worker');
      const detResult = runDetectionAndReport(false);

      if (detResult && (detResult.type === 'coding-problem' || detResult.type === 'coding')) {
        runExtractionAndReport(detResult);
      }

      initMutationObserver();
    }
  });

  // 2. Message Listeners
  if (chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message: BaseMessage, _sender, sendResponse) => {
      if (!isContextValid()) return false;

      if (message.type === 'REQUEST_PAGE_DETECTION') {
        const reqMsg = message as RequestPageDetectionMessage;
        const result = runDetectionAndReport(Boolean(reqMsg.forceRefresh));
        sendResponse({ type: 'PAGE_DETECTION_RESULT', result });
        return true;
      }

      if (message.type === 'REQUEST_PROBLEM_EXTRACTION') {
        const result = runExtractionAndReport();
        sendResponse({ type: 'PROBLEM_EXTRACTION_RESULT', result });
        return true;
      }

      if (message.type === 'CANCEL_CODE_INSERTION') {
        const cancelMsg = message as { insertionId?: string };
        EditorManager.cancelInsertion(cancelMsg.insertionId);
        sendResponse({ success: true });
        return true;
      }

      if (message.type === 'INSERT_CODE_TO_EDITOR') {
        const codeMsg = message as {
          code?: string;
          targetLanguage?: any;
          forceInsert?: boolean;
          mode?: 'instant' | 'progressive';
          insertionId?: string;
        };
        const code = codeMsg.code || '';
        const mode = codeMsg.mode || 'progressive';
        const insertionId = codeMsg.insertionId || `ins_${Date.now()}`;

        const onProgress = (progress: number) => {
          safeSendMessage({
            type: 'INSERT_CODE_PROGRESS',
            insertionId,
            progress,
            status: 'inserting',
          });
        };

        EditorManager.insertCode(code, codeMsg.targetLanguage, codeMsg.forceInsert, {
          mode,
          insertionId,
          onProgress,
        })
          .then((insertionResult) => {
            sendResponse({
              type: 'INSERT_CODE_RESPONSE',
              success: insertionResult.success,
              editorType: insertionResult.editorType,
              errorCode: insertionResult.errorCode,
              detectedEditorLanguage: insertionResult.detectedEditorLanguage,
              message: insertionResult.message,
              diagnostics: insertionResult.diagnostics,
            });
          })
          .catch((err) => {
            sendResponse({
              type: 'INSERT_CODE_RESPONSE',
              success: false,
              editorType: 'monaco',
              errorCode: 'MONACO_BRIDGE_UNAVAILABLE',
              message: err instanceof Error ? err.message : String(err),
            });
          });
        return true;
      }

      if (message.type === 'PING_CONTENT_SCRIPT') {
        sendResponse({
          ready: true,
          timestamp: Date.now(),
        });
        return true;
      }

      return true;
    });
  }
}

initializeContentScript();

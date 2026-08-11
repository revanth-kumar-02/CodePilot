import { RuntimeMessageType, RuntimeErrorResponse } from './message-types';

const VALID_MESSAGE_TYPES: Set<RuntimeMessageType> = new Set([
  'GET_RUNTIME_STATE',
  'RUNTIME_STATE_RESPONSE',
  'GET_ACTIVE_TAB',
  'ACTIVE_TAB_RESPONSE',
  'GET_ALL_TAB_STATES',
  'ALL_TAB_STATES_RESPONSE',
  'PING_CONTENT_SCRIPT',
  'CONTENT_SCRIPT_READY',
  'CONTENT_SCRIPT_ACK',
  'CONTENT_SCRIPT_STATUS_RESPONSE',
  'REQUEST_PAGE_DETECTION',
  'PAGE_DETECTION_RESULT',
  'REQUEST_PROBLEM_EXTRACTION',
  'PROBLEM_EXTRACTION_RESULT',
  'GET_PROBLEM_EXTRACTION',
  'CLEAR_PROBLEM_EXTRACTION',
  'REQUEST_AI_ANALYSIS',
  'AI_ANALYSIS_RESULT',
  'REQUEST_REASONING',
  'REASONING_RESULT',
  'REQUEST_CODE_GENERATION',
  'CODE_GENERATION_RESULT',
  'INSERT_CODE_TO_EDITOR',
  'INSERT_CODE_RESPONSE',
  'CANCEL_CODE_INSERTION',
  'INSERT_CODE_PROGRESS',
  'GET_EXTENSION_STATUS',
]);

export interface MessageValidationResult {
  valid: boolean;
  error?: RuntimeErrorResponse;
}

export class MessageValidator {
  public static validate(message: unknown): MessageValidationResult {
    if (!message || typeof message !== 'object') {
      return {
        valid: false,
        error: {
          code: 'INVALID_MESSAGE',
          message: 'Message must be a non-null object.',
        },
      };
    }

    const msg = message as Record<string, unknown>;

    if (typeof msg.type !== 'string' || !VALID_MESSAGE_TYPES.has(msg.type as RuntimeMessageType)) {
      return {
        valid: false,
        error: {
          code: 'INVALID_MESSAGE',
          message: `Unknown or missing message type: ${String(msg.type)}`,
        },
      };
    }

    if (msg.tabId !== undefined && typeof msg.tabId !== 'number') {
      return {
        valid: false,
        error: {
          code: 'INVALID_MESSAGE',
          message: 'tabId must be a valid number if provided.',
        },
      };
    }

    return { valid: true };
  }
}

import { TabRuntimeState, WindowRuntimeState, ProblemAnalysisData, SolutionPlanData, ReasoningValidationData, GeneratedCodeData } from '../../runtime/runtime-state';
import { PageDetectionResult } from '../../detection/types';
import { ProblemExtractionResult } from '../../extraction/types';
import { MonacoDiagnostics } from '../../content/adapters/types';

export type RuntimeMessageType =
  | 'GET_RUNTIME_STATE'
  | 'RUNTIME_STATE_RESPONSE'
  | 'GET_ACTIVE_TAB'
  | 'ACTIVE_TAB_RESPONSE'
  | 'GET_ALL_TAB_STATES'
  | 'ALL_TAB_STATES_RESPONSE'
  | 'PING_CONTENT_SCRIPT'
  | 'CONTENT_SCRIPT_READY'
  | 'CONTENT_SCRIPT_ACK'
  | 'CONTENT_SCRIPT_STATUS_RESPONSE'
  | 'REQUEST_PAGE_DETECTION'
  | 'PAGE_DETECTION_RESULT'
  | 'REQUEST_PROBLEM_EXTRACTION'
  | 'PROBLEM_EXTRACTION_RESULT'
  | 'GET_PROBLEM_EXTRACTION'
  | 'CLEAR_PROBLEM_EXTRACTION'
  | 'REQUEST_AI_ANALYSIS'
  | 'AI_ANALYSIS_RESULT'
  | 'REQUEST_REASONING'
  | 'REASONING_RESULT'
  | 'REQUEST_CODE_GENERATION'
  | 'CODE_GENERATION_RESULT'
  | 'INSERT_CODE_TO_EDITOR'
  | 'INSERT_CODE_RESPONSE'
  | 'CANCEL_CODE_INSERTION'
  | 'INSERT_CODE_PROGRESS'
  | 'GET_EXTENSION_STATUS'
  | 'GET_SESSION'
  | 'UPDATE_SESSION'
  | 'CLEAR_SESSION'
  | 'GET_SESSION_DIAGNOSTICS'
  | 'REQUEST_ERROR_ANALYSIS'
  | 'ERROR_ANALYSIS_RESULT'
  | 'REQUEST_CODE_REPAIR'
  | 'CODE_REPAIR_RESULT'
  | 'REPORT_EXECUTION_RESULT'
  | 'SCAN_EXECUTION_RESULT'
  | 'APPLY_REPAIR'
  | 'APPLY_REPAIR_RESPONSE';

export const PING_CONTENT_SCRIPT_TYPE: RuntimeMessageType = 'PING_CONTENT_SCRIPT';

export interface BaseMessage {
  type: RuntimeMessageType;
  tabId?: number;
  payload?: unknown;
}

export interface GetRuntimeStateMessage extends BaseMessage {
  type: 'GET_RUNTIME_STATE';
  tabId?: number;
}

export interface RuntimeStateResponsePayload {
  activeTabState: TabRuntimeState | null;
  windows: WindowRuntimeState[];
  timestamp: number;
}

export interface GetAllTabStatesResponsePayload {
  tabs: TabRuntimeState[];
  activeTabId: number | null;
  timestamp: number;
}

export interface ContentScriptReadyMessage extends BaseMessage {
  type: 'CONTENT_SCRIPT_READY';
  timestamp: number;
}

export interface ContentScriptAckResponse extends BaseMessage {
  type: 'CONTENT_SCRIPT_ACK';
  timestamp: number;
}

export interface RequestPageDetectionMessage extends BaseMessage {
  type: 'REQUEST_PAGE_DETECTION';
  forceRefresh?: boolean;
}

export interface PageDetectionResponseMessage extends BaseMessage {
  type: 'PAGE_DETECTION_RESULT';
  result: PageDetectionResult;
}

export interface RequestProblemExtractionMessage extends BaseMessage {
  type: 'REQUEST_PROBLEM_EXTRACTION';
  forceRefresh?: boolean;
}

export interface ProblemExtractionResponseMessage extends BaseMessage {
  type: 'PROBLEM_EXTRACTION_RESULT';
  result: ProblemExtractionResult;
}

export interface RequestAIAnalysisMessage extends BaseMessage {
  type: 'REQUEST_AI_ANALYSIS';
}

export interface AIAnalysisResponseMessage extends BaseMessage {
  type: 'AI_ANALYSIS_RESULT';
  analysis?: ProblemAnalysisData;
  error?: string;
}

export interface RequestReasoningMessage extends BaseMessage {
  type: 'REQUEST_REASONING';
}

export interface ReasoningResponseMessage extends BaseMessage {
  type: 'REASONING_RESULT';
  plan?: SolutionPlanData;
  validation?: ReasoningValidationData;
  error?: string;
}

export interface RequestCodeGenerationMessage extends BaseMessage {
  type: 'REQUEST_CODE_GENERATION';
  targetLanguage?: string;
}

export interface CodeGenerationResponseMessage extends BaseMessage {
  type: 'CODE_GENERATION_RESULT';
  generatedCode?: GeneratedCodeData;
  error?: string;
}

export interface InsertCodeToEditorMessage extends BaseMessage {
  type: 'INSERT_CODE_TO_EDITOR';
  code: string;
  targetLanguage?: string;
  forceInsert?: boolean;
  mode?: 'instant' | 'progressive';
  insertionId?: string;
}

export interface CancelCodeInsertionMessage extends BaseMessage {
  type: 'CANCEL_CODE_INSERTION';
  insertionId?: string;
}

export interface InsertCodeProgressMessage extends BaseMessage {
  type: 'INSERT_CODE_PROGRESS';
  insertionId?: string;
  progress: number;
  status: 'inserting' | 'completed' | 'cancelled' | 'failed';
}

export interface InsertCodeResponseMessage extends BaseMessage {
  type: 'INSERT_CODE_RESPONSE';
  success: boolean;
  editorType: string;
  errorCode?: string;
  detectedEditorLanguage?: string | null;
  message?: string;
  diagnostics?: MonacoDiagnostics;
}

export interface ContentScriptStatusResponsePayload {
  ready: boolean;
  timestamp: number;
}

export interface RuntimeErrorResponse {
  code: 'TAB_NOT_FOUND' | 'INVALID_MESSAGE' | 'CONTENT_SCRIPT_UNAVAILABLE' | 'RUNTIME_ERROR' | 'AI_SERVICE_ERROR' | 'REASONING_SERVICE_ERROR' | 'CODE_GENERATION_ERROR';
  message: string;
}

export type ExtensionStatus = 'pending' | 'connected' | 'disconnected' | 'error';
export interface TabState {
  tabId: number;
  contentScriptReady: boolean;
  lastUpdated: number;
}
export interface ExtensionMessage<T = unknown> {
  type: string;
  payload?: T;
}
export interface ExtensionStatusResponsePayload {
  status: ExtensionStatus;
  contentScriptConnected: boolean;
  codingPageDetected: boolean;
  tabId?: number;
  message?: string;
}

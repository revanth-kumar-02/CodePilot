import { PageDetectionState } from '../detection/types';
import { ProblemExtractionResult, ExtractionStatus } from '../extraction/types';
import { SupportedLanguage } from '../shared/language-registry';
import { ProblemSession } from '../storage/session-store';

export interface ProblemAnalysisData {
  status: 'success' | 'insufficient_information' | 'failed';
  understanding: string;
  keyObservations: string[];
  algorithmApproach: string;
  algorithmSteps: string[];
  timeComplexity: string;
  spaceComplexity: string;
  edgeCases: string[];
  assumptions: string[];
  confidence: number;
  model: string;
  provider: string;
  generatedAt: number;
}

export interface AIAnalysisState {
  status: 'not-started' | 'pending' | 'success' | 'insufficient-information' | 'failed';
  analysis?: ProblemAnalysisData;
  error?: string;
  lastUpdated?: number;
}

export interface SolutionPlanData {
  status: 'ready' | 'needs-clarification' | 'failed';
  problemUnderstanding: string;
  keyInsights: string[];
  constraintsAnalysis: {
    constraints: string[];
    inputScale: string;
    requiredComplexity: string;
    numericRange: string | null;
    dataStructureImplications: string[];
    risks: string[];
  };
  algorithm: {
    name: string;
    category: string;
    description: string;
    steps: string[];
    alternatives: Array<{ name: string; complexity: string; reasonRejected: string }>;
    selectedBecause: string;
  };
  correctnessReasoning: {
    invariant: string | null;
    argument: string;
    keyCases: string[];
    conclusion: string;
  };
  complexity: {
    time: string;
    space: string;
    explanation: string;
  };
  edgeCases: Array<{ case: string; whyImportant: string; expectedBehavior: string }>;
  implementationRequirements: Array<{ requirement: string; priority: 'required' | 'recommended'; reason: string }>;
  assumptions: string[];
  confidence: number;
  model: string;
  provider: string;
  generatedAt: number;
}

export interface ReasoningValidationData {
  valid: boolean;
  issues: Array<{ field: string; message: string; severity: 'error' | 'warning' }>;
  warnings: string[];
}

export interface ReasoningState {
  status: 'not-started' | 'pending' | 'ready' | 'needs-clarification' | 'failed';
  plan?: SolutionPlanData;
  validation?: ReasoningValidationData;
  error?: string;
  lastUpdated?: number;
}

export type CodeStatus =
  | 'NOT_READY'
  | 'PLAN_READY'
  | 'GENERATING'
  | 'CODE_READY'
  | 'INSERTING'
  | 'INSERTED'
  | 'FAILED';

export interface GeneratedCodeData {
  code: string;
  language: SupportedLanguage;
  version?: string;
  explanation: string[];
  completeness: boolean;
  model: string;
  provider: string;
  generatedAt: number;
  durationMs?: number;
}

export interface CodeGenerationState {
  status: CodeStatus;
  generatedCode?: GeneratedCodeData;
  targetLanguage?: SupportedLanguage;
  detectedVersion?: string | null;
  error?: string;
  errorCode?: 'EDITOR_NOT_FOUND' | 'EDITOR_NOT_ACCESSIBLE' | 'LANGUAGE_MISMATCH' | string;
  detectedEditorLanguage?: string | null;
  lastUpdated?: number;
}

export interface ProblemExtractionState {
  status: 'not-started' | ExtractionStatus;
  result?: ProblemExtractionResult;
  lastUpdated?: number;
}

export interface TabRuntimeState {
  tabId: number;
  windowId: number;
  url: string;
  title: string;
  active: boolean;
  status: 'created' | 'loading' | 'ready' | 'error';
  contentScript: 'unknown' | 'loading' | 'ready' | 'unavailable';
  pageDetection?: PageDetectionState;
  problemExtraction?: ProblemExtractionState;
  aiAnalysis?: AIAnalysisState;
  reasoning?: ReasoningState;
  codeGeneration?: CodeGenerationState;
  problemSession?: ProblemSession | null;
  lastUpdated: number;
}

export interface WindowRuntimeState {
  windowId: number;
  focused: boolean;
  type?: string;
}

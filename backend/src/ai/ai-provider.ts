import { ProblemInput, ProblemAnalysis } from './schemas.js';
import { SolutionPlan } from '../reasoning/schemas.js';
import { GeneratedCode, SupportedLanguage } from './code-schemas.js';

export type AIErrorCode =
  | 'AI_EMPTY_RESPONSE'
  | 'AI_RESPONSE_NOT_JSON'
  | 'AI_RESPONSE_TRUNCATED'
  | 'AI_RESPONSE_SCHEMA_INVALID'
  | 'AI_RESPONSE_INCONSISTENT'
  | 'AI_TIMEOUT'
  | 'AI_UPSTREAM_ERROR'
  | 'AI_RATE_LIMITED'
  | 'AI_CONFIGURATION_ERROR'
  | 'AI_AUTHENTICATION_ERROR'
  | 'AI_INVALID_RESPONSE'
  | 'AI_VALIDATION_ERROR'
  | 'AI_REQUEST_TOO_LARGE'
  | 'CODE_COMMENT_VIOLATION'
  | 'CODE_VALIDATION_ERROR'
  | 'AI_UNKNOWN_ERROR';

export class AIError extends Error {
  public readonly code: AIErrorCode;
  public readonly statusHttp: number;
  public readonly retryable: boolean;

  constructor(code: AIErrorCode, message: string, statusHttp: number = 500, retryable?: boolean) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.statusHttp = statusHttp;

    if (retryable !== undefined) {
      this.retryable = retryable;
    } else {
      // Default retryability based on error code
      switch (code) {
        case 'AI_EMPTY_RESPONSE':
        case 'AI_RESPONSE_NOT_JSON':
        case 'AI_RESPONSE_TRUNCATED':
        case 'AI_RESPONSE_SCHEMA_INVALID':
        case 'AI_RESPONSE_INCONSISTENT':
        case 'AI_TIMEOUT':
        case 'AI_UPSTREAM_ERROR':
        case 'AI_RATE_LIMITED':
          this.retryable = true;
          break;
        case 'AI_CONFIGURATION_ERROR':
        case 'AI_AUTHENTICATION_ERROR':
        case 'AI_REQUEST_TOO_LARGE':
        default:
          this.retryable = false;
          break;
      }
    }
  }
}

export interface AIProvider {
  name: string;
  analyzeProblem(problem: ProblemInput): Promise<ProblemAnalysis>;
  reasonProblem(problem: ProblemInput, isRecoveryAttempt?: boolean): Promise<SolutionPlan>;
  generateCode(problem: ProblemInput, plan: SolutionPlan, targetLanguage: SupportedLanguage): Promise<GeneratedCode>;
}

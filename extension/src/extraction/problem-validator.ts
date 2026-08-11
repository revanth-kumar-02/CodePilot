import { Problem, ExtractionStatus, ExtractionFieldResult } from './types';

export interface ValidationResult {
  status: ExtractionStatus;
  warnings: string[];
  errors: string[];
}

export class ProblemValidator {
  public static validate(
    problem: Partial<Problem> | null,
    _fieldResults: ExtractionFieldResult[]
  ): ValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!problem) {
      return {
        status: 'failed',
        warnings: [],
        errors: ['Problem object is null.'],
      };
    }

    // 1. Title Validation & Fallback
    if (!problem.title || problem.title.trim().length < 2) {
      problem.title = 'Coding Problem';
      warnings.push('Problem title defaulted.');
    }

    // 2. Statement Validation & Fallback
    if (!problem.statement || problem.statement.trim().length < 10) {
      if (problem.examples && problem.examples.length > 0) {
        problem.statement = `Coding problem with ${problem.examples.length} sample test case(s).`;
        warnings.push('Problem statement constructed from sample test cases.');
      } else {
        errors.push('Problem statement could not be reliably extracted.');
      }
    }

    // Check for UI text pollution in statement
    if (problem.statement) {
      const lower = problem.statement.toLowerCase();
      if (lower.startsWith('run code') || lower.startsWith('submit') || lower.includes('copyright all rights reserved')) {
        warnings.push('Problem statement contains UI navigation pollution.');
      }
    }

    if (errors.length > 0) {
      return {
        status: 'failed',
        warnings,
        errors,
      };
    }

    // 3. Optional Fields Assessment
    let missingOptionalCount = 0;
    if (!problem.inputFormat) missingOptionalCount++;
    if (!problem.outputFormat) missingOptionalCount++;
    if (!problem.constraints) missingOptionalCount++;
    if (!problem.examples || problem.examples.length === 0) {
      missingOptionalCount++;
      warnings.push('No sample examples found.');
    }
    if (!problem.language) warnings.push('Programming language not explicitly detected.');

    // Status Determination
    const status: ExtractionStatus = missingOptionalCount > 2 ? 'partial' : 'success';

    return {
      status,
      warnings,
      errors,
    };
  }
}

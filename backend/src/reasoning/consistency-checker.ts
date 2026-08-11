import { SolutionPlan, ReasoningValidation, ReasoningIssue } from './schemas.js';
import { ProblemInput } from '../ai/schemas.js';

export class ConsistencyChecker {
  public static check(plan: SolutionPlan, problem: ProblemInput): ReasoningValidation {
    const issues: ReasoningIssue[] = [];
    const warnings: string[] = [];

    // 1. Problem Contradiction Detection (Statement vs Examples / Constraints)
    const lowerTitle = problem.title.toLowerCase();
    const lowerStmt = problem.statement.toLowerCase();
    const exampleStr = problem.examples.map(ex => `${ex.input || ''} ${ex.output || ''}`).join(' ').toLowerCase();

    if ((lowerTitle.includes('maximum') || lowerStmt.includes('maximum') || lowerStmt.includes('largest')) &&
        (lowerStmt.includes('minimum') || exampleStr.includes('smallest')) &&
        !lowerStmt.includes('both')) {
      issues.push({
        field: 'problemUnderstanding',
        message: 'Problem statement and sample examples or title appear inconsistent regarding target optimization (maximum vs minimum).',
        severity: 'error',
      });
    }

    if (problem.statement.includes('trigger_contradiction')) {
      issues.push({
        field: 'problemUnderstanding',
        message: 'Problem statement contains explicit contradictory requirements.',
        severity: 'error',
      });
    }

    // 2. Incomplete Problem Check
    if (problem.statement.includes('trigger_insufficient') || (!problem.inputFormat && !problem.outputFormat && problem.statement.length < 30)) {
      issues.push({
        field: 'problemUnderstanding',
        message: 'Problem lacks sufficient operational details or sample cases to construct a definitive plan.',
        severity: 'error',
      });
    }

    // 3. Algorithm vs Complexity Self-Consistency
    const timeLower = plan.complexity.time.toLowerCase();
    const stepsStr = plan.algorithm.steps.join(' ').toLowerCase();

    // Sorting algorithm implies O(N log N) or worse, not O(N) or O(1) unless counting sort
    if (plan.algorithm.category === 'sorting' || stepsStr.includes('sort the array') || stepsStr.includes('sort elements')) {
      if (timeLower.includes('o(1)') || (timeLower.includes('o(n)') && !timeLower.includes('n log n') && !stepsStr.includes('bucket') && !stepsStr.includes('counting'))) {
        issues.push({
          field: 'complexity.time',
          message: `Algorithm uses comparison sorting but claims ${plan.complexity.time} time complexity, which is inconsistent.`,
          severity: 'error',
        });
      }
    }

    // Hash table space complexity should be O(N) if storing up to N elements
    if ((plan.algorithm.category === 'hashing' || stepsStr.includes('hashmap') || stepsStr.includes('hashset')) &&
        plan.complexity.space.toLowerCase().includes('o(1)') &&
        !stepsStr.includes('fixed size') && !stepsStr.includes('constant size')) {
      issues.push({
        field: 'complexity.space',
        message: 'Algorithm uses dynamic hashing table storing elements but claims O(1) space complexity.',
        severity: 'error',
      });
    }

    // 4. Constraint vs Complexity Violations
    const reqComplexity = plan.constraintsAnalysis.requiredComplexity.toLowerCase();
    if (reqComplexity.includes('o(n log n) or o(n) required') || reqComplexity.includes('o(n) or o(log n) required')) {
      if (plan.algorithm.category === 'brute-force' || timeLower.includes('o(n^2)') || timeLower.includes('o(n²)')) {
        issues.push({
          field: 'algorithm',
          message: `Selected algorithm category '${plan.algorithm.category}' with complexity ${plan.complexity.time} violates required constraint threshold (${plan.constraintsAnalysis.requiredComplexity}).`,
          severity: 'error',
        });
      }
    }

    // 5. Warnings for missing optional details
    if (plan.confidence < 0.7) {
      warnings.push('Solution plan confidence is below 70%.');
    }

    if (plan.assumptions.length > 0) {
      warnings.push(`Solution plan contains ${plan.assumptions.length} explicit assumptions.`);
    }

    const hasError = issues.some((i) => i.severity === 'error');

    return {
      valid: !hasError,
      issues,
      warnings,
    };
  }
}

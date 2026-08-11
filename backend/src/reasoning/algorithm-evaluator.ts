import { ConstraintAnalysis, AlgorithmCategory } from './schemas.js';
import { ProblemInput } from '../ai/schemas.js';

export class AlgorithmEvaluator {
  public static evaluateConstraints(problem: ProblemInput): ConstraintAnalysis {
    const rawConstraints = problem.constraints ? [problem.constraints] : [];
    let inputScale = 'unknown';
    let requiredComplexity = 'unknown';
    let numericRange: string | null = null;
    const dataStructureImplications: string[] = [];
    const risks: string[] = [];

    const statementAndConstraints = `${problem.statement} ${problem.constraints || ''}`;

    // 1. Determine input scale N from constraints or statement
    const scaleMatch = statementAndConstraints.match(/(?:N|n|array size|length)\s*<=\s*10\^(\d+)|(\d{4,9})/);
    let scaleN = 0;
    if (scaleMatch) {
      if (scaleMatch[1]) {
        scaleN = Math.pow(10, parseInt(scaleMatch[1], 10));
      } else if (scaleMatch[2]) {
        scaleN = parseInt(scaleMatch[2], 10);
      }
    }

    if (scaleN > 0) {
      inputScale = `Up to N = ${scaleN}`;
      if (scaleN <= 20) {
        requiredComplexity = 'O(2^N) or O(N!) acceptable';
      } else if (scaleN <= 1000) {
        requiredComplexity = 'O(N^2) or better required';
      } else if (scaleN <= 100000) {
        requiredComplexity = 'O(N log N) or O(N) required';
      } else {
        requiredComplexity = 'O(N) or O(log N) required';
      }
    } else {
      inputScale = 'Unspecified / Default N <= 10^5';
      requiredComplexity = 'O(N log N) or O(N) recommended';
    }

    // 2. Identify numeric ranges & overflow risks
    if (statementAndConstraints.includes('10^9') || statementAndConstraints.includes('10^12') || statementAndConstraints.includes('10^18') || statementAndConstraints.toLowerCase().includes('large integers')) {
      numericRange = '64-bit integer range (up to 10^18)';
      risks.push('Standard 32-bit integer may overflow during summation or multiplication; 64-bit integers required.');
    } else {
      numericRange = 'Standard 32-bit integer range';
    }

    // 3. Infer required data structures
    const lowerText = statementAndConstraints.toLowerCase();
    if (lowerText.includes('lookup') || lowerText.includes('frequency') || lowerText.includes('distinct') || lowerText.includes('two sum')) {
      dataStructureImplications.push('HashMap / HashSet for O(1) average search/lookup');
    }
    if (lowerText.includes('kth largest') || lowerText.includes('priority') || lowerText.includes('min heap')) {
      dataStructureImplications.push('PriorityQueue / Heap for fast minimum/maximum tracking');
    }
    if (lowerText.includes('range sum') || lowerText.includes('subarray sum')) {
      dataStructureImplications.push('Prefix Sum array / Segment Tree');
    }
    if (lowerText.includes('parentheses') || lowerText.includes('stack') || lowerText.includes('nested')) {
      dataStructureImplications.push('Stack for LIFO structure evaluation');
    }

    return {
      constraints: rawConstraints.length > 0 ? rawConstraints : ['unknown'],
      inputScale,
      requiredComplexity,
      numericRange,
      dataStructureImplications,
      risks,
    };
  }

  public static isCategoryCompatibleWithScale(category: AlgorithmCategory, scaleN: number): boolean {
    if (scaleN > 10000 && (category === 'brute-force' || category === 'backtracking')) {
      return false;
    }
    return true;
  }
}

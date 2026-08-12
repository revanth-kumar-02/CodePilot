import { AIProvider, AIError } from './ai-provider.js';
import { ProblemInput, ProblemAnalysis } from './schemas.js';
import { SolutionPlan } from '../reasoning/schemas.js';
import { GeneratedCode, SupportedLanguage } from './code-schemas.js';
import { AlgorithmEvaluator } from '../reasoning/algorithm-evaluator.js';
import { PlatformRule, PlatformRules } from '../config/platform-rules.js';

export class MockAIProvider implements AIProvider {
  public readonly name = 'mock-provider';

  public async analyzeProblem(problem: ProblemInput): Promise<ProblemAnalysis> {
    if (problem.statement.includes('trigger_timeout')) {
      throw new AIError('AI_TIMEOUT', 'Request to AI provider timed out after 45000ms.', 504);
    }

    if (problem.statement.includes('trigger_rate_limit')) {
      throw new AIError('AI_RATE_LIMITED', 'Rate limit exceeded on AI provider.', 429);
    }

    if (problem.statement.includes('trigger_upstream_error')) {
      throw new AIError('AI_UPSTREAM_ERROR', 'Upstream AI provider error (500).', 502);
    }

    if (problem.statement.includes('trigger_insufficient')) {
      return {
        status: 'insufficient_information',
        understanding: 'The problem statement provided is incomplete.',
        keyObservations: [],
        algorithmApproach: 'N/A',
        algorithmSteps: [],
        timeComplexity: 'N/A',
        spaceComplexity: 'N/A',
        edgeCases: [],
        assumptions: [],
        confidence: 0.2,
        model: 'mock-qwen-model',
        provider: this.name,
        generatedAt: Date.now(),
      };
    }

    return {
      status: 'success',
      understanding: `Analyzed problem "${problem.title}". The goal is to compute the result according to constraints.`,
      keyObservations: [
        'Input format requires standard parsing',
        `Constraints specified: ${problem.constraints || 'Standard limits'}`,
      ],
      algorithmApproach: 'Single-Pass Iterative Scan',
      algorithmSteps: [
        'Initialize state tracking variables',
        'Iterate through input elements once',
        'Apply core transition logic',
        'Return computed result',
      ],
      timeComplexity: 'O(N)',
      spaceComplexity: 'O(1)',
      edgeCases: ['Empty input / single element', 'Negative bounds'],
      assumptions: ['Input fits within memory limits'],
      confidence: 0.95,
      model: 'mock-qwen-model',
      provider: this.name,
      generatedAt: Date.now(),
    };
  }

  public async reasonProblem(problem: ProblemInput, isRecoveryAttempt: boolean = false): Promise<SolutionPlan> {
    if (problem.statement.includes('trigger_timeout')) {
      throw new AIError('AI_TIMEOUT', 'Request to AI provider timed out after 45000ms.', 504, true);
    }

    if (problem.statement.includes('trigger_rate_limit')) {
      throw new AIError('AI_RATE_LIMITED', 'Rate limit exceeded on AI provider.', 429, true);
    }

    if (problem.statement.includes('trigger_upstream_error')) {
      throw new AIError('AI_UPSTREAM_ERROR', 'Upstream AI provider error (500).', 502, true);
    }

    if (problem.statement.includes('trigger_permanent_error')) {
      throw new AIError('AI_AUTHENTICATION_ERROR', 'Invalid API key.', 401, false);
    }

    if (problem.statement.includes('trigger_empty_response')) {
      throw new AIError('AI_EMPTY_RESPONSE', 'No usable content received from AI model.', 502, true);
    }

    if (problem.statement.includes('trigger_truncated_json')) {
      throw new AIError('AI_RESPONSE_TRUNCATED', 'The AI response ended before the SolutionPlan JSON was complete.', 502, true);
    }

    if (problem.statement.includes('trigger_invalid_json') || problem.statement.includes('trigger_malformed_json')) {
      throw new AIError('AI_RESPONSE_NOT_JSON', 'Reasoning engine returned malformed JSON.', 502, true);
    }

    if (problem.statement.includes('trigger_retry_success')) {
      if (!isRecoveryAttempt) {
        throw new AIError('AI_RESPONSE_TRUNCATED', 'The AI response ended prematurely.', 502, true);
      }
      // On recovery attempt, return valid plan below
    }

    if (problem.statement.includes('trigger_retry_failure')) {
      throw new AIError('AI_RESPONSE_TRUNCATED', 'The AI response ended prematurely.', 502, true);
    }

    if (problem.statement.includes('trigger_contradiction') || problem.statement.includes('trigger_insufficient')) {
      return {
        status: 'needs-clarification',
        problemUnderstanding: `Problem "${problem.title}" contains contradictory or insufficient requirements.`,
        keyInsights: ['Ambiguous input bounds'],
        constraintsAnalysis: {
          constraints: ['1 <= N <= 10^5'],
          inputScale: 'Up to N = 10^5',
          requiredComplexity: 'O(N)',
          numericRange: null,
          dataStructureImplications: [],
          risks: ['Contradictory output requirements'],
        },
        algorithm: {
          name: 'Clarification Needed',
          category: 'other',
          description: 'Cannot formulate optimal strategy due to prompt contradiction.',
          steps: ['Request clarification'],
          alternatives: [],
          selectedBecause: 'Ambiguity present',
        },
        correctnessReasoning: {
          invariant: null,
          argument: 'Requires clarified requirements.',
          keyCases: [],
          conclusion: 'Pending clarification.',
        },
        complexity: {
          time: 'N/A',
          space: 'N/A',
          explanation: 'Undefined complexity.',
        },
        edgeCases: [],
        implementationRequirements: [],
        assumptions: [],
        confidence: 0.3,
        model: 'mock-qwen-model',
        provider: this.name,
        generatedAt: Date.now(),
      };
    }

    if (problem.statement.includes('trigger_inconsistent_complexity')) {
      return {
        status: 'ready',
        problemUnderstanding: `Reasoning for problem "${problem.title}" with artificial complexity mismatch.`,
        keyInsights: ['Mismatched claims for testing'],
        constraintsAnalysis: {
          constraints: ['1 <= N <= 10^5'],
          inputScale: 'Up to N = 10^5',
          requiredComplexity: 'O(N log N)',
          numericRange: null,
          dataStructureImplications: [],
          risks: [],
        },
        algorithm: {
          name: 'Merge Sort',
          category: 'sorting',
          description: 'Sort input elements using merge sort.',
          steps: ['Divide array', 'Conquer subarrays', 'Merge results'],
          alternatives: [],
          selectedBecause: 'Sorting target',
        },
        correctnessReasoning: {
          invariant: null,
          argument: 'Elements are ordered.',
          keyCases: ['Sorted array'],
          conclusion: 'Complete.',
        },
        complexity: {
          time: 'O(1)', // Mismatched!
          space: 'O(1)',
          explanation: 'Inconsistent complexity claim.',
        },
        edgeCases: [],
        implementationRequirements: [],
        assumptions: [],
        confidence: 0.9,
        model: 'mock-qwen-model',
        provider: this.name,
        generatedAt: Date.now(),
      };
    }

    if (problem.statement.includes('trigger_brute_force_large')) {
      return {
        status: 'ready',
        problemUnderstanding: `Problem "${problem.title}" requires processing up to N = 100000 elements.`,
        keyInsights: ['N is large'],
        constraintsAnalysis: {
          constraints: ['1 <= N <= 100000'],
          inputScale: 'Up to N = 100000',
          requiredComplexity: 'O(N log N) or O(N) required',
          numericRange: null,
          dataStructureImplications: [],
          risks: [],
        },
        algorithm: {
          name: 'Nested Loop Scan',
          category: 'brute-force',
          description: 'Check all pairs using nested loops.',
          steps: ['Iterate i from 0 to N', 'Iterate j from i+1 to N'],
          alternatives: [],
          selectedBecause: 'Brute force approach',
        },
        correctnessReasoning: {
          invariant: null,
          argument: 'Checks all pairs.',
          keyCases: [],
          conclusion: 'Correct but slow.',
        },
        complexity: {
          time: 'O(N^2)',
          space: 'O(1)',
          explanation: 'Nested loops over N.',
        },
        edgeCases: [],
        implementationRequirements: [],
        assumptions: [],
        confidence: 0.8,
        model: 'mock-qwen-model',
        provider: this.name,
        generatedAt: Date.now(),
      };
    }

    // Default / Valid Problem Reasoning
    const constraintsAnalysis = AlgorithmEvaluator.evaluateConstraints(problem);
    const lowerTitle = problem.title.toLowerCase();

    let category: SolutionPlan['algorithm']['category'] = 'hashing';
    let name = 'HashMap Lookup';
    let description = 'Use a hash map to achieve single-pass O(1) average lookup time.';
    let steps = [
      'Initialize an empty hash map to store seen elements and their indices.',
      'Iterate through the array from left to right.',
      'Compute target complement value.',
      'If complement exists in map, return current index and mapped index.',
      'Otherwise, insert current element and index into map.',
    ];
    let time = 'O(N)';
    let space = 'O(N)';

    if (lowerTitle.includes('maximum') || lowerTitle.includes('largest') || lowerTitle.includes('find max')) {
      category = 'other';
      name = 'Single-Pass Max Scan';
      description = 'Iterate once through the array keeping track of the maximum element found so far.';
      steps = [
        'Initialize maxTracker variable to the first element.',
        'Iterate through remaining elements from index 1 to N-1.',
        'If current element > maxTracker, update maxTracker.',
        'Return maxTracker after loop completes.',
      ];
      time = 'O(N)';
      space = 'O(1)';
    } else if (lowerTitle.includes('sort')) {
      category = 'sorting';
      name = 'Efficient Comparison Sort';
      description = 'Sort the array using an O(N log N) comparison sort algorithm.';
      steps = [
        'Read elements into contiguous array.',
        'Execute dual-pivot quicksort or mergesort.',
        'Return sorted array.',
      ];
      time = 'O(N log N)';
      space = 'O(N)';
    }

    return {
      status: 'ready',
      problemUnderstanding: `The problem "${problem.title}" requires computing the result efficiently for input size N.`,
      keyInsights: [
        'Single pass scan eliminates unnecessary nested iterations.',
        'Using efficient data structures preserves low time complexity.',
      ],
      constraintsAnalysis,
      algorithm: {
        name,
        category,
        description,
        steps,
        alternatives: [
          {
            name: 'Brute-force nested loops',
            complexity: 'O(N^2)',
            reasonRejected: 'Exceeds time limit for large input size N.',
          },
        ],
        selectedBecause: `Optimal balance of time complexity (${time}) and memory footprint (${space}).`,
      },
      correctnessReasoning: {
        invariant: 'At step i, all elements up to i have been evaluated.',
        argument: 'Every element is inspected, ensuring no potential match is missed.',
        keyCases: ['Single element array', 'Array with negative numbers', 'Array with duplicate values'],
        conclusion: 'The algorithm guarantees finding the correct result in a single pass.',
      },
      complexity: {
        time,
        space,
        explanation: `Time is ${time} due to single linear iteration; space is ${space} for auxiliary storage.`,
      },
      edgeCases: [
        {
          case: 'Empty or single-element input',
          whyImportant: 'Prevents out-of-bounds or null pointer access.',
          expectedBehavior: 'Return early or handle base case immediately.',
        },
        {
          case: 'Large numbers / Integer overflow',
          whyImportant: 'Summation may exceed standard 32-bit integer limits.',
          expectedBehavior: 'Use 64-bit integers (long).',
        },
      ],
      implementationRequirements: [
        {
          requirement: 'Use 64-bit integers for accumulator variables if N is large.',
          priority: 'required',
          reason: 'Prevents arithmetic overflow during calculation.',
        },
        {
          requirement: 'Reserve initial capacity for hash structures if N is known.',
          priority: 'recommended',
          reason: 'Avoids costly rehashing operations.',
        },
      ],
      assumptions: ['Input array fits in standard RAM.'],
      confidence: 0.95,
      model: 'mock-qwen-model',
      provider: this.name,
      generatedAt: Date.now(),
    };
  }

  public async generateCode(
    problem: ProblemInput,
    plan: SolutionPlan,
    targetLanguage: SupportedLanguage,
    rule?: PlatformRule,
    retryInstruction?: string
  ): Promise<GeneratedCode> {
    if (problem.statement.includes('trigger_timeout')) {
      throw new AIError('AI_TIMEOUT', 'Request to AI provider timed out after 45000ms.', 504);
    }

    if (problem.statement.includes('trigger_rate_limit')) {
      throw new AIError('AI_RATE_LIMITED', 'Rate limit exceeded on AI provider.', 429);
    }

    if (problem.statement.includes('trigger_upstream_error')) {
      throw new AIError('AI_UPSTREAM_ERROR', 'Upstream AI provider error (500).', 502);
    }

    if (problem.statement.includes('trigger_incomplete_code')) {
      return {
        code: `// TODO: Implement solution for ${problem.title}\nfunction solve() { /* write code here */ }`,
        language: targetLanguage,
        explanation: ['Generated incomplete code placeholder'],
        completeness: false,
        model: 'mock-qwen-model',
        provider: this.name,
        generatedAt: Date.now(),
        durationMs: 5,
      };
    }

    const activeRule = rule || PlatformRules.getRule(problem.source?.hostname || problem.source?.url || problem.source?.platform);

    if (problem.statement.includes('trigger_invalid_class_name')) {
      return {
        code: `public class WrongClassName {\n    public static void main(String[] args) {}\n}`,
        language: targetLanguage,
        explanation: ['Test invalid class name'],
        completeness: true,
        model: 'mock-qwen-model',
        provider: this.name,
        generatedAt: Date.now(),
        durationMs: 5,
      };
    }

    if (problem.statement.includes('trigger_extra_brace')) {
      return {
        code: `public class ${activeRule.className} {\n    public static void main(String[] args) {}\n}\n}`,
        language: targetLanguage,
        explanation: ['Test extra brace'],
        completeness: true,
        model: 'mock-qwen-model',
        provider: this.name,
        generatedAt: Date.now(),
        durationMs: 5,
      };
    }

    if (problem.statement.includes('trigger_missing_brace')) {
      return {
        code: `public class ${activeRule.className} {\n    public static void main(String[] args) {}`,
        language: targetLanguage,
        explanation: ['Test missing brace'],
        completeness: true,
        model: 'mock-qwen-model',
        provider: this.name,
        generatedAt: Date.now(),
        durationMs: 5,
      };
    }

    if (problem.statement.includes('trigger_duplicate_class')) {
      return {
        code: `public class ${activeRule.className} {}\npublic class ${activeRule.className} {}`,
        language: targetLanguage,
        explanation: ['Test duplicate public class'],
        completeness: true,
        model: 'mock-qwen-model',
        provider: this.name,
        generatedAt: Date.now(),
        durationMs: 5,
      };
    }

    if (problem.statement.includes('trigger_nested_class')) {
      return {
        code: `public class ${activeRule.className} {\n    public class ${activeRule.className} {}\n}`,
        language: targetLanguage,
        explanation: ['Test nested class'],
        completeness: true,
        model: 'mock-qwen-model',
        provider: this.name,
        generatedAt: Date.now(),
        durationMs: 5,
      };
    }

    if (problem.statement.includes('trigger_comments')) {
      return {
        code: `public class ${activeRule.className} {\n    // Some comment\n    public static void main(String[] args) {}\n}`,
        language: targetLanguage,
        explanation: ['Test comments violation'],
        completeness: true,
        model: 'mock-qwen-model',
        provider: this.name,
        generatedAt: Date.now(),
        durationMs: 5,
      };
    }

    const javaClass = activeRule.className;
    const problemText = `${problem.title} ${problem.statement}`.toLowerCase();
    
    let javaCode: string;
    if (problemText.includes('parenthesis') || problemText.includes('checkvalidstring')) {
      javaCode = `public class ${javaClass} {\n    public boolean checkValidString(String s) {\n        int low = 0;\n        int high = 0;\n        for (int i = 0; i < s.length(); i++) {\n            char c = s.charAt(i);\n            if (c == '(') {\n                low++;\n                high++;\n            } else if (c == ')') {\n                low--;\n                high--;\n            } else if (c == '*') {\n                low--;\n                high++;\n            }\n            if (high < 0) return false;\n            if (low < 0) low = 0;\n        }\n        return low == 0;\n    }\n}`;
    } else if (activeRule.requiresMain) {
      javaCode = `import java.util.Scanner;\n\npublic class ${javaClass} {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        if (!scanner.hasNextInt()) return;\n        int n = scanner.nextInt();\n        long[] arr = new long[n];\n        for (int i = 0; i < n; i++) {\n            arr[i] = scanner.nextLong();\n        }\n        long maxVal = arr[0];\n        for (int i = 1; i < n; i++) {\n            if (arr[i] > maxVal) {\n                maxVal = arr[i];\n            }\n        }\n        System.out.println(maxVal);\n    }\n}`;
    } else {
      javaCode = `public class ${javaClass} {\n    public int solve(int[] nums) {\n        if (nums == null || nums.length == 0) return 0;\n        int maxVal = nums[0];\n        for (int i = 1; i < nums.length; i++) {\n            if (nums[i] > maxVal) maxVal = nums[i];\n        }\n        return maxVal;\n    }\n}`;
    }

    const mockSnippets: Record<SupportedLanguage, string> = {
      cpp: `#include <iostream>\n#include <vector>\n\nusing namespace std;\n\nint main() {\n    int n;\n    if (!(cin >> n) || n <= 0) return 0;\n    vector<long long> arr(n);\n    for (int i = 0; i < n; i++) {\n        cin >> arr[i];\n    }\n    long long maxVal = arr[0];\n    for (int i = 1; i < n; i++) {\n        if (arr[i] > maxVal) {\n            maxVal = arr[i];\n        }\n    }\n    cout << maxVal << endl;\n    return 0;\n}`,
      python: `import sys\n\ndef solve():\n    input_data = sys.stdin.read().split()\n    if not input_data:\n        return\n    n = int(input_data[0])\n    arr = [int(x) for x in input_data[1:n+1]]\n    max_val = arr[0]\n    for val in arr[1:]:\n        if val > max_val:\n            max_val = val\n    print(max_val)\n\nif __name__ == '__main__':\n    solve()`,
      java: javaCode,
      javascript: `function solve(input) {\n  const tokens = input.trim().split(/\\s+/);\n  if (tokens.length === 0 || !tokens[0]) return;\n  const n = parseInt(tokens[0], 10);\n  const arr = tokens.slice(1, n + 1).map(Number);\n  let maxVal = arr[0];\n  for (let i = 1; i < arr.length; i++) {\n    if (arr[i] > maxVal) maxVal = arr[i];\n  }\n  console.log(maxVal);\n}`,
      typescript: `function solve(input: string): void {\n  const tokens = input.trim().split(/\\s+/);\n  if (tokens.length === 0 || !tokens[0]) return;\n  const n = parseInt(tokens[0], 10);\n  const arr = tokens.slice(1, n + 1).map(Number);\n  let maxVal = arr[0];\n  for (let i = 1; i < arr.length; i++) {\n    if (arr[i] > maxVal) maxVal = arr[i];\n  }\n  console.log(maxVal);\n}`,
      c: `#include <stdio.h>\n\nint main() {\n    int n;\n    if (scanf("%d", &n) != 1 || n <= 0) return 0;\n    long long maxVal;\n    scanf("%lld", &maxVal);\n    for (int i = 1; i < n; i++) {\n        long long val;\n        scanf("%lld", &val);\n        if (val > maxVal) maxVal = val;\n    }\n    printf("%lld\\n", maxVal);\n    return 0;\n}`,
    };

    return {
      code: mockSnippets[targetLanguage] || mockSnippets.python,
      language: targetLanguage,
      explanation: [
        `Implemented algorithm: ${plan.algorithm.name}`,
        `Target time complexity: ${plan.complexity.time}`,
      ],
      completeness: true,
      model: 'mock-qwen-model',
      provider: this.name,
      generatedAt: Date.now(),
      durationMs: 10,
    };
  }
}

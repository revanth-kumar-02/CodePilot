import { AIError, AIProvider, ProviderFactory } from '../ai/index.js';
import { ProblemInput, ErrorAnalysisResult, ErrorAnalysisResultSchema, ErrorClassification } from '../ai/schemas.js';
import { SolutionPlan } from '../reasoning/schemas.js';
import { SupportedLanguage } from '../ai/code-schemas.js';
import { PlatformRules, PlatformRule } from '../config/platform-rules.js';
import { CodeValidator } from './code-validator.js';
import { JsonCleaner } from '../utils/json-cleaner.js';

export interface CodeRepairResult {
  repairedCode: string;
  durationMs: number;
}

export class CodeRepairService {
  private provider: AIProvider;

  constructor(provider?: AIProvider) {
    this.provider = provider || ProviderFactory.getProvider();
  }

  public async analyzeError(
    problem: ProblemInput,
    currentCode: string,
    errorMessage: string,
    testOutput?: string | null,
    overrideProvider?: AIProvider,
    plan?: SolutionPlan | null,
    analysis?: any,
    platform?: string,
    language?: string,
    version?: string
  ): Promise<ErrorAnalysisResult> {
    const activeProvider = overrideProvider || this.provider;
    const errorLower = (errorMessage || '').toLowerCase();

    // Rule-based fast classification for common Java method signature & compile errors
    if (
      errorLower.includes('cannot find symbol') ||
      errorLower.includes('symbol: method') ||
      errorLower.includes('symbol:   method') ||
      errorLower.includes('signature mismatch')
    ) {
      return {
        classification: 'Method Signature',
        explanation: 'Java class method name or parameter signature does not match what the test driver expected.',
        rootCause: errorMessage.trim(),
        suggestedFix: 'Update class method name, parameter types, and return type to match target platform expected signature.',
      };
    }

    if (errorLower.includes('time limit exceeded') || errorLower.includes('tle')) {
      return {
        classification: 'Time Limit',
        explanation: 'Code execution exceeded time limit. Time complexity is too high for test inputs.',
        rootCause: errorMessage.trim() || 'Algorithmic time complexity exceeded limits.',
        suggestedFix: 'Optimize algorithm complexity to O(N) or O(N log N) as planned.',
      };
    }

    if (errorLower.includes('memory limit exceeded') || errorLower.includes('mle') || errorLower.includes('out of memory')) {
      return {
        classification: 'Memory Limit',
        explanation: 'Code execution exceeded maximum allowed memory allocation.',
        rootCause: errorMessage.trim() || 'Excessive memory allocation.',
        suggestedFix: 'Reduce auxiliary data structures and memory allocations.',
      };
    }

    const systemPrompt = `You are CodePilot AI Error Classifier. Analyze the user's code execution error and return JSON.
Valid classifications (MUST BE EXACTLY ONE OF THESE STRINGS):
- "Syntax Error"
- "Compilation Error"
- "Method Signature"
- "Runtime Error"
- "Wrong Answer"
- "Time Limit"
- "Memory Limit"
- "Unknown"

Return ONLY a JSON object with this structure:
{
  "classification": "<one of valid classifications>",
  "explanation": "<short explanation>",
  "rootCause": "<specific reason why error occurred>",
  "suggestedFix": "<short fix action>"
}`;

    const userPrompt = `PROBLEM: ${problem.title}
STATEMENT: ${problem.statement}
${platform ? `PLATFORM: ${platform}` : ''}
${language ? `LANGUAGE: ${language}` : ''}
${version ? `VERSION: ${version}` : ''}

${analysis ? `AI ANALYSIS:\n${JSON.stringify(analysis, null, 2)}\n` : ''}
${plan ? `SOLUTION PLAN ALGORITHM: ${plan.algorithm?.name || 'N/A'}\n` : ''}

CURRENT CODE:
\`\`\`
${currentCode}
\`\`\`

EXECUTION ERROR:
${errorMessage}

${testOutput ? `TEST OUTPUT:\n${testOutput}` : ''}`;

    try {
      let rawText = '';
      if ('generateCode' in activeProvider) {
        const platformRule = PlatformRules.getRule(
          problem.source?.hostname || problem.source?.url,
          platform || problem.source?.platform
        );
        const dummyPlan: SolutionPlan = plan || {
          status: 'ready',
          problemUnderstanding: problem.title,
          keyInsights: ['Error Analysis'],
          constraintsAnalysis: { constraints: [], inputScale: 'Medium', requiredComplexity: 'O(N)', numericRange: null, dataStructureImplications: [], risks: [] },
          algorithm: { name: 'Analysis', category: 'other', description: 'Error classification', steps: [], alternatives: [], selectedBecause: 'Error analysis' },
          correctnessReasoning: { invariant: null, argument: 'Analysis', keyCases: [], conclusion: 'Valid' },
          complexity: { time: 'O(N)', space: 'O(1)', explanation: 'Analysis' },
          edgeCases: [],
          implementationRequirements: [],
          assumptions: [],
          confidence: 1,
          model: 'error-analysis',
          provider: activeProvider.name,
          generatedAt: Date.now(),
        };

        const res = await activeProvider.generateCode(
          problem,
          dummyPlan,
          (language || problem.language || 'java').toLowerCase() as SupportedLanguage,
          platformRule,
          `Analyze execution error and return classification JSON:\n${systemPrompt}\n${userPrompt}`
        );
        rawText = res.code;
      }

      const cleanJson = JsonCleaner.extractAndRepairJson(rawText);
      const parsed = JSON.parse(cleanJson);
      const val = ErrorAnalysisResultSchema.safeParse(parsed);
      if (val.success) {
        return val.data;
      }
    } catch {
      // Rule-based fallback if LLM JSON parsing fails
    }

    let fallbackClass: ErrorClassification = 'Unknown';
    if (errorLower.includes('compile error') || errorLower.includes('error:')) fallbackClass = 'Compilation Error';
    else if (errorLower.includes('runtime error') || errorLower.includes('exception') || errorLower.includes('segmentation fault')) fallbackClass = 'Runtime Error';
    else if (errorLower.includes('wrong answer') || errorLower.includes('failed test')) fallbackClass = 'Wrong Answer';
    else if (errorLower.includes('time limit') || errorLower.includes('tle')) fallbackClass = 'Time Limit';
    else if (errorLower.includes('memory limit') || errorLower.includes('mle')) fallbackClass = 'Memory Limit';
    else if (errorLower.includes('syntax')) fallbackClass = 'Syntax Error';

    return {
      classification: fallbackClass,
      explanation: `Execution failed with ${fallbackClass}.`,
      rootCause: errorMessage.trim() || 'Execution failure detected.',
      suggestedFix: 'Regenerate solution fixing the root cause.',
    };
  }

  public async generateRepair(
    problem: ProblemInput,
    plan: SolutionPlan | null,
    analysis: any | null,
    currentCode: string,
    requestedLanguage: string,
    errorMessage: string,
    testOutput?: string | null,
    classification?: string | null,
    platform?: string,
    version?: string,
    overrideProvider?: AIProvider
  ): Promise<CodeRepairResult> {
    const startTime = performance.now();
    const activeProvider = overrideProvider || this.provider;

    const targetLanguage = (requestedLanguage || problem.language || 'java').toLowerCase() as SupportedLanguage;
    const activePlatform = platform || problem.source?.platform || problem.source?.hostname;
    const platformRule = PlatformRules.getRule(
      problem.source?.hostname || problem.source?.url,
      activePlatform
    );

    let specificDiagnosticNotice = '';
    const errClass = classification || 'Execution Failed';

    switch (errClass) {
      case 'Method Signature':
        specificDiagnosticNotice = `METHOD SIGNATURE ERROR: The method name, parameter types, or return type in the solution does not match what the test driver expected. Identify expected method signature for ${problem.title} on ${platformRule.platform} and update code to match.`;
        break;
      case 'Compilation Error':
      case 'Syntax Error':
        specificDiagnosticNotice = `COMPILATION / SYNTAX ERROR: The code failed to compile. Fix compiler errors, missing types, or syntax issues while maintaining valid class structure.`;
        break;
      case 'Runtime Error':
        specificDiagnosticNotice = `RUNTIME ERROR: Code crashed during test execution (e.g. NullPointer, IndexOutOfBounds, DivideByZero). Fix null checks, boundary checks, and safe object operations.`;
        break;
      case 'Wrong Answer':
        specificDiagnosticNotice = `WRONG ANSWER: Code produced incorrect output for test cases. Compare code logic against problem statement and test case output, and correct the logical error.`;
        break;
      case 'Time Limit':
        specificDiagnosticNotice = `TIME LIMIT EXCEEDED: Code exceeded runtime limit. Replace inefficient loops or exponential time complexity with optimal algorithmic approach.`;
        break;
      case 'Memory Limit':
        specificDiagnosticNotice = `MEMORY LIMIT EXCEEDED: Code used too much memory. Reduce allocations and unnecessary storage structures.`;
        break;
      default:
        specificDiagnosticNotice = `EXECUTION FAILURE: Fix the failure while keeping correct existing logic.`;
        break;
    }

    const retryInstruction = `REPAIR INSTRUCTION (EXECUTION FAILURE FIX):
Execution Failure Type: ${errClass}
Specific Diagnostic: ${specificDiagnosticNotice}

Actual Error Message:
${errorMessage}

${testOutput ? `Test Output:\n${testOutput}\n` : ''}

EXISTING FAULTY CODE:
\`\`\`
${currentCode}
\`\`\`

CRITICAL REPAIR MANDATE:
1. Preserve existing correct logic wherever possible. Do NOT write an unrelated solution from scratch if current code logic is mostly sound. Fix the specific failure.
2. Use required platform class structure:
   - Required class: ${platformRule.className} (${platformRule.className === 'Solution' ? 'class Solution or public class Solution' : 'public class Main'}).
3. Ensure exact method signature, parameter types, and return type matching ${problem.title} expectations.
4. Ensure balanced braces, valid executable source code only.
5. NO comments (no // or /* */ or # comments), NO Markdown code fences, NO explanations, NO placeholders.
6. Provide COMPLETE working code.`;

    const dummyPlan: SolutionPlan = plan || {
      status: 'ready',
      problemUnderstanding: problem.title,
      keyInsights: ['Code Repair execution fix'],
      constraintsAnalysis: {
        constraints: [],
        inputScale: 'Medium',
        requiredComplexity: 'O(N)',
        numericRange: null,
        dataStructureImplications: [],
        risks: [],
      },
      algorithm: {
        name: 'Execution Repair Fix',
        category: 'other',
        description: 'Repairs execution error reported by platform compiler/driver.',
        steps: ['Correct method name and signatures', 'Fix algorithmic error', 'Verify output'],
        alternatives: [],
        selectedBecause: 'Required by platform error diagnostics',
      },
      correctnessReasoning: {
        invariant: null,
        argument: 'Fixes exact platform failure',
        keyCases: [],
        conclusion: 'Code will pass platform checks',
      },
      complexity: {
        time: 'O(N)',
        space: 'O(1)',
        explanation: 'Optimal repair',
      },
      edgeCases: [],
      implementationRequirements: [],
      assumptions: [],
      confidence: 1,
      model: 'code-repair',
      provider: activeProvider.name,
      generatedAt: Date.now(),
    };

    let attempt = 0;
    const maxAttempts = 2;
    let lastIssues: string[] = [];

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const result = await activeProvider.generateCode(
          problem,
          dummyPlan,
          targetLanguage,
          platformRule,
          retryInstruction
        );

        const validation = CodeValidator.parseAndValidate(result.code, targetLanguage, platformRule);
        if (validation.valid) {
          return {
            repairedCode: validation.code,
            durationMs: performance.now() - startTime,
          };
        }
        lastIssues = validation.issues;
      } catch (err) {
        if (attempt >= maxAttempts) throw err;
      }
    }

    throw new AIError(
      'CODE_REPAIR_FAILED',
      `Failed to generate valid repaired code after ${maxAttempts} attempts. Issues: ${lastIssues.join('; ')}`,
      422
    );
  }
}

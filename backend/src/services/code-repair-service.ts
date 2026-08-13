import { AIError, AIProvider, ProviderFactory } from '../ai/index.js';
import { ProblemInput, ErrorAnalysisResult, ErrorAnalysisResultSchema, ErrorClassificationEnum, ErrorClassification } from '../ai/schemas.js';
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
    overrideProvider?: AIProvider
  ): Promise<ErrorAnalysisResult> {
    const activeProvider = overrideProvider || this.provider;

    // Rule-based fast classification for common Java method signature & compile errors
    const errorLower = (errorMessage || '').toLowerCase();
    if (errorLower.includes('cannot find symbol') && (errorLower.includes('method') || errorLower.includes('symbol: method'))) {
      return {
        classification: 'Method Signature',
        explanation: 'Java method name or parameter signature does not match what the test driver expected.',
        rootCause: errorMessage.trim(),
        suggestedFix: 'Update class method name and parameter types to match the target platform definition.',
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
CURRENT CODE:
\`\`\`
${currentCode}
\`\`\`

EXECUTION ERROR:
${errorMessage}

${testOutput ? `TEST OUTPUT:\n${testOutput}` : ''}`;

    try {
      let rawText = '';
      if ('reasonProblem' in activeProvider) {
        // Fallback prompt completion
        rawText = await (activeProvider as any).generateCode(
          problem,
          { status: 'ready', reasoningSteps: [], algorithmChoice: '', targetComplexity: { time: '', space: '' } },
          'java',
          PlatformRules.getRule('leetcode'),
          `Analyze execution error and return classification JSON:\n${systemPrompt}\n${userPrompt}`
        ).then((r: any) => r.code);
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
    else if (errorLower.includes('runtime error') || errorLower.includes('exception')) fallbackClass = 'Runtime Error';
    else if (errorLower.includes('wrong answer')) fallbackClass = 'Wrong Answer';
    else if (errorLower.includes('time limit')) fallbackClass = 'Time Limit';
    else if (errorLower.includes('memory limit')) fallbackClass = 'Memory Limit';

    return {
      classification: fallbackClass,
      explanation: `Execution failed with ${fallbackClass}.`,
      rootCause: errorMessage.trim(),
      suggestedFix: 'Regenerate solution fixing the root cause.',
    };
  }

  public async generateRepair(
    problem: ProblemInput,
    plan: SolutionPlan | null,
    currentCode: string,
    requestedLanguage: string,
    errorMessage: string,
    testOutput?: string | null,
    classification?: string | null,
    overrideProvider?: AIProvider
  ): Promise<CodeRepairResult> {
    const startTime = performance.now();
    const activeProvider = overrideProvider || this.provider;

    const targetLanguage = (requestedLanguage || problem.language || 'java').toLowerCase() as SupportedLanguage;
    const platformRule = PlatformRules.getRule(
      problem.source?.hostname || problem.source?.url,
      problem.source?.platform
    );

    const retryInstruction = `REPAIR INSTRUCTION (EXECUTION FAILURE FIX):
Execution Status / Error Type: ${classification || 'Execution Failed'}
Actual Error Message:
${errorMessage}

${testOutput ? `Test Output:\n${testOutput}\n` : ''}

EXISTING FAULTY CODE:
\`\`\`
${currentCode}
\`\`\`

CRITICAL REPAIR MANDATE:
1. Use platform required structure: exactly one public class named ${platformRule.className}.
2. Ensure the method name and parameter types match the expected platform signature (e.g. for Multiply Strings on LeetCode: public String multiply(String num1, String num2)).
3. Ensure no comments, no extra closing braces, and valid executable code only.`;

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
      502
    );
  }
}

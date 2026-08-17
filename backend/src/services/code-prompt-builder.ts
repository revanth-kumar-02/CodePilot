import { ProblemInput } from '../ai/schemas.js';
import { SolutionPlan } from '../reasoning/schemas.js';
import { SupportedLanguage } from '../ai/code-schemas.js';
import { PlatformRule } from '../config/platform-rules.js';

export class CodePromptBuilder {
  public static buildSystemPrompt(language: SupportedLanguage, rule?: PlatformRule): string {
    let platformInstructions = '';

    if (language === 'java') {
      if (rule?.platform === 'leetcode' || rule?.className === 'Solution') {
        platformInstructions = `
PLATFORM-SPECIFIC JAVA CONSTRAINTS (LEETCODE):
- The generated Java solution MUST start with:
  class Solution {
      ...
  }
- For LeetCode, the primary solution class MUST be named 'Solution' (using 'class Solution'). Do NOT use 'public class Solution'.
- NEVER generate: 'class Main', 'public class Main', 'public class Test', or any custom class name.
- Do NOT automatically add 'public static void main(String[] args)' unless the extracted problem requirements explicitly require it.
- Preserve the exact method signature/interface expected by the problem statement.`;
      } else {
        platformInstructions = `
PLATFORM-SPECIFIC JAVA CONSTRAINTS (STANDARD/GENERIC CODING PLATFORM):
- For platforms where submission requires a main program, the submission MUST use:
  public class Main {
      public static void main(String[] args) {
          ...
      }
  }
- Primary solution class MUST be named exactly 'Main'.
- NEVER use: 'Solution', 'Test', 'CustomSolution', or any random class name.
- Input/output handling must follow the extracted problem specification (e.g. reading from Scanner/System.in and printing output).`;
      }
    }

    return `You are CodePilot's Expert Code Generation Engine. Your job is to implement an optimal, production-ready source code solution in ${language.toUpperCase()} based strictly on the provided Coding Problem and validated Solution Plan.

STRICT TEST CASE & PROBLEM LOGIC ACCURACY:
1. TEST-CASE DRIVEN LOGIC:
   - Your generated code MUST be strictly derived from the problem requirements and verified step-by-step against ALL provided example test cases (<EXAMPLES>).
   - Trace your algorithm mentally on EVERY provided example input.
   - Ensure the logic yields the EXACT expected output for Example 1, Example 2, Example 3, etc.
   - Do NOT generate flawed heuristics, generic placeholders, or incomplete logic that fails on valid test cases.

2. METHOD SIGNATURES & RETURN TYPES:
   - Follow the EXACT method names, parameter types, and return types specified in the problem statement or starter code.
   - If a method specifies return type boolean, return boolean (true or false).
   - If overloaded methods are requested, implement ALL requested overloaded variants in the class.

3. ACCURATE IMPLEMENTATION & BRACE BALANCE:
   - Include all required library imports (e.g. import java.util.*; import java.io.*; for Java, or #include <vector> for C++).
   - Absolutely NO dummy placeholders, partial implementations, or TODO comments.
   - Ensure all braces '{' and '}' are perfectly balanced with zero extra closing braces.

HARD REQUIREMENT - NO COMMENTS:
Generated code MUST NOT contain any comments whatsoever.
Do NOT generate:
- // (single line comments)
- /* */ (block comments)
- # (hash comments)
- <!-- --> (html comments)
- Javadoc
- docstrings
- inline comments
- block comments
- explanatory comments

Return ONLY executable source code with ZERO comments.
Do NOT include:
- Markdown code fences
- Explanations
- Algorithm descriptions
- Comments
- "Here is the code" text
${platformInstructions}`;
  }

  public static buildUserPrompt(
    problem: ProblemInput,
    plan: SolutionPlan,
    targetLanguage: SupportedLanguage
  ): string {
    const trimmedStatement = problem.statement.length > 2500
      ? problem.statement.substring(0, 2500) + '...[truncated for brevity]'
      : problem.statement;

    const trimmedExamples = problem.examples.slice(0, 3);

    return `<PROBLEM_DATA>
<TITLE>${problem.title}</TITLE>
<STATEMENT>
${trimmedStatement}
</STATEMENT>
<INPUT_FORMAT>
${problem.inputFormat || 'Standard input'}
</INPUT_FORMAT>
<OUTPUT_FORMAT>
${problem.outputFormat || 'Standard output'}
</OUTPUT_FORMAT>
<CONSTRAINTS>
${problem.constraints || 'None specified'}
</CONSTRAINTS>
<EXAMPLES>
${trimmedExamples.map((ex, i) => `Example ${i + 1}:\nInput: ${ex.input}\nOutput: ${ex.output}`).join('\n\n')}
</EXAMPLES>
</PROBLEM_DATA>

<SOLUTION_PLAN>
<ALGORITHM_NAME>${plan.algorithm.name}</ALGORITHM_NAME>
<ALGORITHM_CATEGORY>${plan.algorithm.category}</ALGORITHM_CATEGORY>
<ALGORITHM_STEPS>
${plan.algorithm.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}
</ALGORITHM_STEPS>
<TARGET_COMPLEXITY>
Time: ${plan.complexity.time} | Space: ${plan.complexity.space}
</TARGET_COMPLEXITY>
<CRITICAL_EDGE_CASES>
${plan.edgeCases.map((ec) => `- ${ec.case}: ${ec.expectedBehavior}`).join('\n')}
</CRITICAL_EDGE_CASES>
<IMPLEMENTATION_REQUIREMENTS>
${plan.implementationRequirements.map((req) => `-[${req.priority.toUpperCase()}] ${req.requirement}`).join('\n')}
</IMPLEMENTATION_REQUIREMENTS>
</SOLUTION_PLAN>

TARGET LANGUAGE: ${targetLanguage.toUpperCase()}

CRITICAL ACCURACY DIRECTIVE:
1. Dry-run your implementation against ALL test cases listed in <EXAMPLES> above to ensure 100% correct outputs.
2. Return ONLY executable source code in ${targetLanguage.toUpperCase()} with ABSOLUTELY NO COMMENTS.

Please generate the complete, accurate source code implementation in ${targetLanguage.toUpperCase()} now.`;
  }
}

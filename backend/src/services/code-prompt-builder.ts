import { ProblemInput } from '../ai/schemas.js';
import { SolutionPlan } from '../reasoning/schemas.js';
import { SupportedLanguage } from '../ai/code-schemas.js';

export class CodePromptBuilder {
  public static buildSystemPrompt(language: SupportedLanguage): string {
    return `You are CodePilot's Expert Code Generation Engine. Your job is to implement an optimal, production-ready source code solution in ${language.toUpperCase()} based strictly on the provided Coding Problem and validated Solution Plan.

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

Return ONLY the executable source code required by the target platform.
Do NOT include:
- Markdown code fences
- Explanations
- Algorithm descriptions
- Comments
- "Here is the code" text

STRICT CODE GENERATION RULES:
1. Produce complete, working, syntactically correct source code in ${language.toUpperCase()}.
2. Include all necessary library imports and headers (e.g., #include <vector>, import java.util.*, etc.).
3. Write clean, readable code with proper formatting, but ZERO comments.
4. Strictly follow the provided Algorithm Steps, Complexity targets, and Edge Case considerations.
5. Absolutely NO dummy placeholders, partial implementations, or TODO comments.
6. Handle all constraints and edge cases specified in the plan.
7. Return ONLY the source code solution. Do NOT add conversational intro or outro text.`;
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

REMINDER: Return ONLY executable source code in ${targetLanguage.toUpperCase()} with ABSOLUTELY NO COMMENTS.

Please generate the complete source code implementation in ${targetLanguage.toUpperCase()} now.`;
  }
}

import { ProblemExample } from './types';
import { TextNormalizer } from './text-normalizer';

export class TextScraperExtractor {
  public static scrapeFromText(fullText: string): {
    title: string;
    statement: string;
    inputFormat: string | null;
    outputFormat: string | null;
    constraints: string | null;
    examples: ProblemExample[];
  } {
    const text = fullText.replace(/\r\n/g, '\n');

    // 1. Extract Title
    let title = 'Coding Problem';
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    for (const line of lines.slice(0, 10)) {
      if (
        !/^(description|editorial|solutions|submissions|code|testcase|test result|home|dashboard)$/i.test(line) &&
        line.length >= 3 &&
        line.length < 100 &&
        !line.startsWith('http')
      ) {
        title = line;
        break;
      }
    }

    // 2. Extract Examples using regex from visible text
    const examples: ProblemExample[] = [];
    const exampleRegex = /(?:Example\s*\d*:?|Sample\s*Test\s*case\s*\d*:?|Sample\s*Input:?)?\s*Input:\s*([\s\S]*?)\s*Output:\s*([\s\S]*?)(?=\s*Explanation:|\s*Example|\s*Sample|\s*Constraints:|\s*Note:|$)/gi;
    const matches = Array.from(text.matchAll(exampleRegex));

    const seenEx = new Set<string>();
    for (const m of matches) {
      const rawIn = m[1] ? m[1].trim() : '';
      const rawOut = m[2] ? m[2].trim() : '';

      // Extract optional explanation if present right after output
      let explanation: string | null = null;
      const expMatch = text.slice(m.index! + m[0].length).match(/^\s*Explanation:\s*([\s\S]*?)(?=\s*Example|\s*Constraints:|\s*Input:|$)/i);
      if (expMatch && expMatch[1].trim().length > 0) {
        explanation = TextNormalizer.normalize(expMatch[1]);
      }

      const normIn = TextNormalizer.normalize(rawIn);
      const normOut = TextNormalizer.normalize(rawOut);

      if (normIn || normOut) {
        const key = `${normIn}||${normOut}`;
        if (!seenEx.has(key)) {
          seenEx.add(key);
          examples.push({
            input: normIn || 'Sample Input',
            output: normOut || 'Sample Output',
            explanation,
          });
        }
      }
    }

    // 3. Extract Constraints
    let constraints: string | null = null;
    const constraintsMatch = text.match(/Constraints:\s*([\s\S]*?)(?=\s*Copyright|\s*All rights reserved|\s*Follow up:|\s*Example|\s*$\n\n|$)/i);
    if (constraintsMatch && constraintsMatch[1].trim().length > 0) {
      constraints = TextNormalizer.normalize(constraintsMatch[1]);
    }

    // 4. Extract Statement
    let statement = '';
    // Find text between title or start and Example 1 / Constraints
    const exampleOrConstraintIndex = text.search(/Example\s*\d*:?|Sample\s*Input:?|Constraints:/i);
    if (exampleOrConstraintIndex > 0) {
      const rawStatement = text.slice(0, exampleOrConstraintIndex);
      // Strip title from beginning if present
      const cleanStmt = rawStatement.replace(title, '').trim();
      statement = TextNormalizer.normalize(cleanStmt);
    } else {
      statement = TextNormalizer.normalize(text.slice(0, 1500));
    }

    // Fallbacks if input/output formats are not explicitly separated in headers
    const inputFormat = 'Input parameters as specified in problem description and test cases.';
    const outputFormat = 'Return value or output structure matching sample test cases.';

    return {
      title,
      statement: statement.length > 10 ? statement : text.slice(0, 500),
      inputFormat,
      outputFormat,
      constraints: constraints || 'See problem statement and example ranges.',
      examples,
    };
  }
}

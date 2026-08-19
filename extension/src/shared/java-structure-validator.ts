export interface JavaValidationDiagnostics {
  valid: boolean;
  publicClassesCount: number;
  detectedClass: string;
  issues: string[];
}

export class JavaStructureValidator {
  public static validate(code: string, expectedClass: 'Solution' | 'Main' = 'Main'): JavaValidationDiagnostics {
    const issues: string[] = [];
    const cleanCode = code
      .replace(/```[a-z]*\n?/gi, '')
      .replace(/```/g, '')
      .trim();

    // 1. Strip string literals
    const codeWithoutStrings = cleanCode
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/`(?:[^`\\]|\\.)*`/g, '``');

    // 2. Brace Validation
    let depth = 0;
    let bracePass = true;
    for (let i = 0; i < codeWithoutStrings.length; i++) {
      const char = codeWithoutStrings[i];
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth < 0) {
          bracePass = false;
          issues.push('Brace nesting invalid: extra closing brace encountered.');
          break;
        }
      }
    }
    if (bracePass && depth !== 0) {
      issues.push(`Brace nesting invalid: unbalanced braces (depth at end: ${depth}).`);
    }

    // 3. Class Detection & Name Validation
    const isLeetCode = expectedClass === 'Solution';
    const classRegex = /\b(?:public\s+)?class\s+([A-Za-z0-9_$]+)/g;
    const matches = Array.from(codeWithoutStrings.matchAll(classRegex));
    const publicClassMatches = Array.from(codeWithoutStrings.matchAll(/\bpublic\s+class\s+([A-Za-z0-9_$]+)/g));
    const publicClassesCount = publicClassMatches.length;

    const hasExpectedClass = matches.some((m) => m[1] === expectedClass);
    let detectedClass = matches.length > 0 ? matches[0][1] : 'None';
    if (hasExpectedClass) {
      detectedClass = expectedClass;
    }

    if (matches.length === 0) {
      issues.push(`No class found. Required class '${expectedClass}'.`);
    } else if (!hasExpectedClass) {
      issues.push(`Invalid class name: expected class '${expectedClass}', but detected 'class ${detectedClass}'.`);
    } else if (!isLeetCode && publicClassesCount === 0) {
      issues.push(`No public class found. Required public class 'Main'.`);
    } else if (publicClassesCount > 1) {
      issues.push(`Multiple public classes detected (${publicClassesCount}). Exactly one primary class '${expectedClass}' is required.`);
    }

    // 4. Platform-Specific Duplicate / Conflicting Class Checks
    if (isLeetCode) {
      if (/\bclass\s+Main\b|\bpublic\s+class\s+Main\b|\bpublic\s+class\s+Test\b/.test(codeWithoutStrings)) {
        issues.push("LeetCode Java solutions must NOT contain 'Main' or 'Test' class declarations.");
      }
    }

    const mainMatches = Array.from(codeWithoutStrings.matchAll(/\bpublic\s+class\s+Main\b/g));
    if (mainMatches.length > 1) {
      issues.push(`Duplicate 'public class Main' declarations detected (${mainMatches.length}).`);
    }

    const solutionMatches = Array.from(codeWithoutStrings.matchAll(/\b(?:public\s+)?class\s+Solution\b/g));
    if (solutionMatches.length > 1) {
      issues.push(`Duplicate 'Solution' class declarations detected (${solutionMatches.length}).`);
    }

    return {
      valid: issues.length === 0,
      publicClassesCount,
      detectedClass,
      issues,
    };
  }
}

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

    // 3. Public Class Detection & Name Validation
    const publicClassRegex = /\bpublic\s+class\s+([A-Za-z0-9_$]+)/g;
    const publicMatches = Array.from(codeWithoutStrings.matchAll(publicClassRegex));
    const publicClassesCount = publicMatches.length;
    const detectedClass = publicClassesCount > 0 ? publicMatches[0][1] : 'None';

    if (publicClassesCount === 0) {
      issues.push(`No public class found. Required public class '${expectedClass}'.`);
    } else if (publicClassesCount > 1) {
      issues.push(`Multiple public classes detected (${publicClassesCount}). Exactly one public class '${expectedClass}' is required.`);
    } else if (detectedClass !== expectedClass) {
      issues.push(`Invalid public class name: expected 'public class ${expectedClass}', but detected 'public class ${detectedClass}'.`);
    }

    // 4. Duplicate Class Declarations
    const mainMatches = Array.from(codeWithoutStrings.matchAll(/\bpublic\s+class\s+Main\b/g));
    if (mainMatches.length > 1) {
      issues.push(`Duplicate 'public class Main' declarations detected (${mainMatches.length}).`);
    }

    const solutionMatches = Array.from(codeWithoutStrings.matchAll(/\bpublic\s+class\s+Solution\b/g));
    if (solutionMatches.length > 1) {
      issues.push(`Duplicate 'public class Solution' declarations detected (${solutionMatches.length}).`);
    }

    return {
      valid: issues.length === 0,
      publicClassesCount,
      detectedClass,
      issues,
    };
  }
}

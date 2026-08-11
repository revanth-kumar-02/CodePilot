import { SupportedLanguage } from '../ai/code-schemas.js';

export interface CodeValidationResult {
  code: string;
  completeness: boolean;
  valid: boolean;
  hasComments: boolean;
  issues: string[];
}

export class CodeValidator {
  public static stripFences(rawText: string): string {
    let clean = rawText.trim();
    const fenceRegex = /^```(?:[a-zA-Z0-9_+#-]+)?\n([\s\S]*?)\n```$/;
    const match = clean.match(fenceRegex);

    if (match && match[1]) {
      clean = match[1].trim();
    } else {
      if (clean.startsWith('```')) {
        clean = clean.replace(/^```[a-zA-Z0-9_+#-]*\n?/, '');
      }
      if (clean.endsWith('```')) {
        clean = clean.replace(/\n?```$/, '');
      }
      clean = clean.trim();
    }

    return clean;
  }

  public static checkForComments(code: string, language: SupportedLanguage): boolean {
    const cleanCode = this.stripFences(code);

    // Remove string literals first to prevent false positives inside string contents
    const codeWithoutStrings = cleanCode
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/`(?:[^`\\]|\\.)*`/g, '``');

    if (['java', 'cpp', 'c', 'javascript', 'typescript'].includes(language)) {
      // Check for single line comments // or block comments /* */
      if (/\/\//.test(codeWithoutStrings) || /\/\*/.test(codeWithoutStrings)) {
        return true;
      }
    }

    if (language === 'python') {
      // Check for # hash comments
      if (/#/.test(codeWithoutStrings)) {
        return true;
      }
      // Check for Python docstrings (triple quotes """...""" or '''...''')
      if (/"""[\s\S]*?"""/.test(cleanCode) || /'''[\s\S]*?'''/.test(cleanCode)) {
        return true;
      }
    }

    return false;
  }

  public static checkCompleteness(code: string): { complete: boolean; issues: string[] } {
    const issues: string[] = [];
    const forbiddenPatterns = [
      /\/\/\s*todo/i,
      /\/\*\s*todo/i,
      /fixme/i,
      /\/\/\s*write\s+code\s+here/i,
      /\/\/\s*your\s+code\s+here/i,
      /pass\s*#\s*implement/i,
      /throw\s+new\s+(?:UnimplementedException|NotImplementedException)/i,
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(code)) {
        issues.push(`Code contains incomplete placeholder pattern: ${pattern.source}`);
      }
    }

    return {
      complete: issues.length === 0,
      issues,
    };
  }

  public static validateStructure(
    code: string,
    language: SupportedLanguage
  ): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!code || code.trim().length === 0) {
      issues.push('Generated code is empty');
      return { valid: false, issues };
    }

    switch (language) {
      case 'cpp':
        if (!code.includes('#include') && !code.includes('class') && !code.includes('int ') && !code.includes('void ')) {
          issues.push('C++ code appears missing standard headers, classes, or function signatures');
        }
        break;
      case 'c':
        if (!code.includes('#include') && !code.includes('int ') && !code.includes('void ') && !code.includes('struct ')) {
          issues.push('C code appears missing headers or function signatures');
        }
        break;
      case 'java':
        if (!code.includes('class') && !code.includes('public') && !code.includes('static') && !code.includes('void ')) {
          issues.push('Java code appears missing class or method definition');
        }
        break;
      case 'python':
        if (!code.includes('def ') && !code.includes('class ') && !code.includes('import ') && !code.includes('for ') && !code.includes('while ') && !code.includes('return')) {
          issues.push('Python code appears missing function definition or logic structures');
        }
        break;
      case 'javascript':
      case 'typescript':
        if (!code.includes('function') && !code.includes('const') && !code.includes('let') && !code.includes('class') && !code.includes('return') && !code.includes('var')) {
          issues.push('JavaScript/TypeScript code appears missing function or variable statements');
        }
        break;
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  public static parseAndValidate(
    rawOutput: string,
    language: SupportedLanguage
  ): CodeValidationResult {
    const code = this.stripFences(rawOutput);
    const hasComments = this.checkForComments(code, language);
    const completeness = this.checkCompleteness(code);
    const structure = this.validateStructure(code, language);

    const issues = [...completeness.issues, ...structure.issues];
    if (hasComments) {
      issues.push('CODE_COMMENT_VIOLATION: Generated code contains comments.');
    }

    return {
      code,
      completeness: completeness.complete,
      valid: structure.valid && !hasComments,
      hasComments,
      issues,
    };
  }
}

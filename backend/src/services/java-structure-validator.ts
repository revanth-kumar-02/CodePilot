import { PlatformRule } from '../config/platform-rules.js';
import { CodeValidator } from './code-validator.js';

export interface JavaValidationDiagnostics {
  platform: string;
  language: string;
  requiredClass: string;
  detectedClass: string;
  publicClassesCount: number;
  braceValidation: 'PASS' | 'FAIL';
  commentValidation: 'PASS' | 'FAIL';
  structureValidation: 'PASS' | 'FAIL';
  finalStatus: 'PASS' | 'FAIL';
  issues: string[];
}

export class JavaStructureValidator {
  public static validate(code: string, rule: PlatformRule): JavaValidationDiagnostics {
    const issues: string[] = [];
    const cleanCode = CodeValidator.stripFences(code);

    // 1. Strip string literals to prevent string content interfering with structural inspection
    const codeWithoutStrings = cleanCode
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/`(?:[^`\\]|\\.)*`/g, '``');

    // 2. Brace Validation (Nesting Depth Tracking)
    let bracePass = true;
    let depth = 0;

    for (let i = 0; i < codeWithoutStrings.length; i++) {
      const char = codeWithoutStrings[i];
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth < 0) {
          bracePass = false;
          issues.push('Brace nesting invalid: extra closing brace encountered.');
          break;
        }
      }
    }

    if (bracePass && depth !== 0) {
      bracePass = false;
      issues.push(`Brace nesting invalid: unbalanced braces (depth at end: ${depth}).`);
    }

    // 3. Public Class Detection & Name Validation
    const publicClassRegex = /\bpublic\s+class\s+([A-Za-z0-9_$]+)/g;
    const publicMatches = Array.from(codeWithoutStrings.matchAll(publicClassRegex));
    const publicClassesCount = publicMatches.length;

    let detectedClass = 'None';
    if (publicClassesCount > 0) {
      detectedClass = publicMatches[0][1];
    }

    let structurePass = true;

    if (publicClassesCount === 0) {
      structurePass = false;
      issues.push(`No public class found. Required public class '${rule.className}'.`);
    } else if (publicClassesCount > 1) {
      structurePass = false;
      issues.push(
        `Multiple public classes detected (${publicClassesCount}). Exactly one public class '${rule.className}' is required.`
      );
    } else if (detectedClass !== rule.className) {
      structurePass = false;
      issues.push(
        `Invalid public class name: expected 'public class ${rule.className}', but detected 'public class ${detectedClass}'.`
      );
    }

    // 4. Nested Duplicate Class Check
    const allClassRegex = /\b(?:public\s+)?class\s+([A-Za-z0-9_$]+)/g;
    const classMatches = Array.from(codeWithoutStrings.matchAll(allClassRegex));
    const classNameCounts: Record<string, number> = {};

    for (const match of classMatches) {
      const name = match[1];
      classNameCounts[name] = (classNameCounts[name] || 0) + 1;
      if (classNameCounts[name] > 1 && (name === 'Solution' || name === 'Main')) {
        structurePass = false;
        issues.push(`Duplicate or nested class declaration detected for class '${name}'.`);
      }
    }

    // Check for nested duplicate Solution/Main class structure
    if (rule.className === 'Solution') {
      const nestedSolutionRegex = /\bpublic\s+class\s+Solution\s*\{[\s\S]*?\bpublic\s+class\s+Solution\b/;
      if (nestedSolutionRegex.test(codeWithoutStrings)) {
        structurePass = false;
        issues.push('Nested duplicate Solution class detected.');
      }
    } else if (rule.className === 'Main') {
      const nestedMainRegex = /\bpublic\s+class\s+Main\s*\{[\s\S]*?\bpublic\s+class\s+Main\b/;
      if (nestedMainRegex.test(codeWithoutStrings)) {
        structurePass = false;
        issues.push('Nested duplicate Main class detected.');
      }
    }

    // 5. Platform Specific Code Requirements
    if (rule.platform === 'leetcode') {
      if (/\bclass\s+Main\b|\bpublic\s+class\s+Main\b|\bpublic\s+class\s+Test\b/.test(codeWithoutStrings)) {
        structurePass = false;
        issues.push("LeetCode Java solutions must NOT contain 'Main' or 'Test' class declarations.");
      }
    } else if (rule.requiresMain) {
      if (!/\bpublic\s+static\s+void\s+main\s*\(/.test(codeWithoutStrings)) {
        structurePass = false;
        issues.push(`Platform '${rule.platform}' requires 'public static void main(String[] args)' in class Main.`);
      }
    }

    // 6. Check for code outside the main class wrapper (excluding imports & package)
    const codeWithoutPackageImports = codeWithoutStrings
      .replace(/\bpackage\s+[\w.]+;/g, '')
      .replace(/\bimport\s+[\w.*]+;/g, '')
      .trim();

    if (codeWithoutPackageImports.length > 0 && !codeWithoutPackageImports.startsWith('public class')) {
      structurePass = false;
      issues.push('Found executable code or statements outside the primary public class declaration.');
    }

    // 7. Comment Validation Check
    const hasComments = CodeValidator.checkForComments(cleanCode, 'java');
    const commentPass = !hasComments;
    if (hasComments) {
      issues.push('Generated code contains comments.');
    }

    const braceValidation = bracePass ? 'PASS' : 'FAIL';
    const commentValidation = commentPass ? 'PASS' : 'FAIL';
    const structureValidation = structurePass ? 'PASS' : 'FAIL';
    const finalStatus = bracePass && commentPass && structurePass ? 'PASS' : 'FAIL';

    return {
      platform: rule.platform,
      language: 'Java',
      requiredClass: rule.className,
      detectedClass,
      publicClassesCount,
      braceValidation,
      commentValidation,
      structureValidation,
      finalStatus,
      issues,
    };
  }
}

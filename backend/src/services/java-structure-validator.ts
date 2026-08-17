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

    // 3. Class Detection & Name Validation
    const isLeetCode = rule.platform === 'leetcode';
    const classRegex = /\b(?:public\s+)?class\s+([A-Za-z0-9_$]+)/g;
    const matches = Array.from(codeWithoutStrings.matchAll(classRegex));
    const publicClassMatches = Array.from(codeWithoutStrings.matchAll(/\bpublic\s+class\s+([A-Za-z0-9_$]+)/g));
    const publicClassesCount = publicClassMatches.length;

    let detectedClass = 'None';
    if (matches.length > 0) {
      detectedClass = matches[0][1];
    }

    let structurePass = true;

    if (matches.length === 0) {
      structurePass = false;
      issues.push(`No class found. Required class '${rule.className}'.`);
    } else if (detectedClass !== rule.className) {
      structurePass = false;
      issues.push(
        `Invalid class name: expected 'class ${rule.className}', but detected 'class ${detectedClass}'.`
      );
    } else if (!isLeetCode && publicClassesCount === 0) {
      structurePass = false;
      issues.push(`No public class found. Required public class '${rule.className}'.`);
    } else if (publicClassesCount > 1) {
      structurePass = false;
      issues.push(
        `Multiple public classes detected (${publicClassesCount}). Exactly one primary class '${rule.className}' is required.`
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
      const nestedSolutionRegex = /\b(?:public\s+)?class\s+Solution\s*\{[\s\S]*?\b(?:public\s+)?class\s+Solution\b/;
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

    if (codeWithoutPackageImports.length > 0 && !codeWithoutPackageImports.startsWith('public class') && !codeWithoutPackageImports.startsWith('class')) {
      structurePass = false;
      issues.push('Found executable code or statements outside the primary class declaration.');
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

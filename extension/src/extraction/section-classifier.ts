import { FieldName } from './types';

export interface SemanticSectionMatch {
  field: FieldName;
  confidence: number;
}

export class SectionClassifier {
  private static patterns: Record<FieldName, string[]> = {
    title: ['problem', 'question', 'challenge', 'task'],
    statement: ['problem statement', 'description', 'task description', 'question description', 'overview'],
    input: ['input format', 'input description', 'input'],
    output: ['output format', 'output description', 'output'],
    constraints: ['constraints', 'conditions', 'limits'],
    examples: ['example', 'examples', 'sample', 'sample input', 'sample output', 'test case', 'test cases'],
    notes: ['note', 'notes', 'explanation', 'important', 'hint', 'hints'],
    language: ['language', 'programming language', 'select language'],
  };

  public static classifyHeader(headerText: string): SemanticSectionMatch | null {
    if (!headerText) return null;
    const cleanText = headerText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

    // Exact matches
    if (cleanText === 'input format' || cleanText === 'input') {
      return { field: 'input', confidence: 0.95 };
    }
    if (cleanText === 'output format' || cleanText === 'output') {
      return { field: 'output', confidence: 0.95 };
    }
    if (cleanText === 'constraints' || cleanText === 'conditions') {
      return { field: 'constraints', confidence: 0.95 };
    }
    if (cleanText.includes('sample input') || cleanText.includes('sample output') || cleanText.startsWith('example') || cleanText.startsWith('sample')) {
      return { field: 'examples', confidence: 0.9 };
    }
    if (cleanText === 'problem statement' || cleanText === 'description' || cleanText === 'task description') {
      return { field: 'statement', confidence: 0.95 };
    }
    if (cleanText === 'note' || cleanText === 'notes' || cleanText === 'explanation') {
      return { field: 'notes', confidence: 0.88 };
    }

    // Fuzzy matching against pattern dictionary
    for (const [field, keywords] of Object.entries(this.patterns) as [FieldName, string[]][]) {
      for (const kw of keywords) {
        if (cleanText === kw || cleanText.startsWith(kw) || cleanText.endsWith(kw)) {
          return { field, confidence: 0.8 };
        }
      }
    }

    return null;
  }
}

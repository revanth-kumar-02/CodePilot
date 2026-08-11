export interface Problem {
  id: string;
  title: string;
  statement: string;
  inputFormat: string | null;
  outputFormat: string | null;
  constraints: string | null;
  examples: ProblemExample[];
  notes: string | null;
  language: string | null;
  source: ProblemSource;
  metadata: ProblemMetadata;
}

export interface ProblemExample {
  input: string | null;
  output: string | null;
  explanation: string | null;
}

export interface ProblemSource {
  url: string;
  hostname: string;
  platform: string | null;
  detectedAt: number;
}

export interface ProblemMetadata {
  extractedAt: number;
  extractionMethod: string;
  confidence: number;
  characterCount: number;
}

export type ExtractionStatus = 'pending' | 'success' | 'partial' | 'failed';

export type FieldName =
  | 'title'
  | 'statement'
  | 'input'
  | 'output'
  | 'constraints'
  | 'examples'
  | 'notes'
  | 'language';

export type FieldStatus = 'found' | 'missing' | 'uncertain';

export interface ExtractionFieldResult {
  field: FieldName;
  status: FieldStatus;
  confidence: number;
  method: string;
}

export interface ProblemExtractionResult {
  status: ExtractionStatus;
  problem: Problem | null;
  confidence: number;
  fields: ExtractionFieldResult[];
  warnings: string[];
  errors: string[];
  durationMs: number;
}

export interface ExtractionDOMSnapshot {
  url: string;
  hostname: string;
  pageTitle: string;
  headings: Array<{ level: number; text: string; selector?: string }>;
  blocks: Array<{ tag: string; text: string; headingContext?: string }>;
  preCodeBlocks: Array<{ text: string; context?: string }>;
  languageHints: string[];
  candidateContainers: CandidateContainer[];
}

export interface CandidateContainer {
  id: string;
  tag: string;
  score: number;
  text: string;
  headings: string[];
  preCount: number;
}

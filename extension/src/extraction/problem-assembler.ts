import { Problem, ProblemExample, ProblemSource, ProblemMetadata } from './types';

export interface RawExtractedFields {
  title: string;
  statement: string;
  inputFormat: string | null;
  outputFormat: string | null;
  constraints: string | null;
  examples: ProblemExample[];
  notes: string | null;
  language: string | null;
  url: string;
  hostname: string;
  confidence: number;
}

export class ProblemAssembler {
  public static assemble(fields: RawExtractedFields): Problem {
    const id = `prob-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const characterCount = (fields.title + ' ' + fields.statement + ' ' + (fields.inputFormat || '')).length;

    const source: ProblemSource = {
      url: fields.url,
      hostname: fields.hostname,
      platform: null, // Platform adapters in later phases
      detectedAt: Date.now(),
    };

    const metadata: ProblemMetadata = {
      extractedAt: Date.now(),
      extractionMethod: 'universal-heuristic-extractor',
      confidence: fields.confidence,
      characterCount,
    };

    return {
      id,
      title: fields.title,
      statement: fields.statement,
      inputFormat: fields.inputFormat,
      outputFormat: fields.outputFormat,
      constraints: fields.constraints,
      examples: fields.examples,
      notes: fields.notes,
      language: fields.language,
      source,
      metadata,
    };
  }
}

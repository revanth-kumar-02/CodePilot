import { z } from 'zod';

export const ProblemExampleSchema = z.object({
  input: z.string().nullable(),
  output: z.string().nullable(),
  explanation: z.string().nullable(),
});

export const ProblemSourceSchema = z.object({
  url: z.string(),
  hostname: z.string(),
  platform: z.string().nullable(),
  detectedAt: z.number(),
});

export const ProblemMetadataSchema = z.object({
  extractedAt: z.number(),
  extractionMethod: z.string(),
  confidence: z.number(),
  characterCount: z.number(),
});

export const ProblemSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required'),
  statement: z.string().min(10, 'Statement is required'),
  inputFormat: z.string().nullable(),
  outputFormat: z.string().nullable(),
  constraints: z.string().nullable(),
  examples: z.array(ProblemExampleSchema),
  notes: z.string().nullable(),
  language: z.string().nullable(),
  source: ProblemSourceSchema,
  metadata: ProblemMetadataSchema,
});

export type ProblemInput = z.infer<typeof ProblemSchema>;

export const ProblemAnalysisStatusSchema = z.enum([
  'success',
  'insufficient_information',
  'failed',
]);

export const ProblemAnalysisSchema = z.object({
  status: ProblemAnalysisStatusSchema,
  understanding: z.string(),
  keyObservations: z.array(z.string()),
  algorithmApproach: z.string(),
  algorithmSteps: z.array(z.string()),
  timeComplexity: z.string(),
  spaceComplexity: z.string(),
  edgeCases: z.array(z.string()),
  assumptions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  model: z.string(),
  provider: z.string(),
  generatedAt: z.number(),
});

export type ProblemAnalysis = z.infer<typeof ProblemAnalysisSchema>;

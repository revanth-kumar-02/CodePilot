import { z } from 'zod';
import { ProblemSchema } from './schemas.js';
import { SolutionPlanSchema } from '../reasoning/schemas.js';

export const SupportedLanguageSchema = z.enum([
  'java',
  'cpp',
  'c',
  'python',
  'javascript',
  'typescript',
]);

export type SupportedLanguage = z.infer<typeof SupportedLanguageSchema>;

export const GeneratedCodeSchema = z.object({
  code: z.string().min(1, 'Generated code cannot be empty'),
  language: SupportedLanguageSchema,
  version: z.string().optional(),
  explanation: z.array(z.string()).default([]),
  completeness: z.boolean().default(true),
  model: z.string(),
  provider: z.string(),
  generatedAt: z.number(),
  durationMs: z.number().optional(),
});

export type GeneratedCode = z.infer<typeof GeneratedCodeSchema>;

export const CodeGenerationRequestSchema = z.object({
  problem: ProblemSchema,
  plan: SolutionPlanSchema,
  targetLanguage: SupportedLanguageSchema.optional(),
  targetVersion: z.string().optional(),
});

export type CodeGenerationRequest = z.infer<typeof CodeGenerationRequestSchema>;

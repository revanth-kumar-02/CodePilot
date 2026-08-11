import { z } from 'zod';

export const SolutionPlanStatusSchema = z.enum([
  'ready',
  'needs-clarification',
  'failed',
]);
export type SolutionPlanStatus = z.infer<typeof SolutionPlanStatusSchema>;

export const ConstraintAnalysisSchema = z.object({
  constraints: z.array(z.string()),
  inputScale: z.string(),
  requiredComplexity: z.string(),
  numericRange: z.string().nullable(),
  dataStructureImplications: z.array(z.string()),
  risks: z.array(z.string()),
});
export type ConstraintAnalysis = z.infer<typeof ConstraintAnalysisSchema>;

export const AlgorithmCategorySchema = z.enum([
  'brute-force',
  'two-pointers',
  'sliding-window',
  'binary-search',
  'sorting',
  'hashing',
  'prefix-sum',
  'greedy',
  'dynamic-programming',
  'graph',
  'tree',
  'heap',
  'stack',
  'queue',
  'recursion',
  'backtracking',
  'math',
  'number-theory',
  'string',
  'simulation',
  'other',
]);
export type AlgorithmCategory = z.infer<typeof AlgorithmCategorySchema>;

export const AlgorithmAlternativeSchema = z.object({
  name: z.string(),
  complexity: z.string(),
  reasonRejected: z.string(),
});
export type AlgorithmAlternative = z.infer<typeof AlgorithmAlternativeSchema>;

export const AlgorithmPlanSchema = z.object({
  name: z.string().min(1, 'Algorithm name is required'),
  category: AlgorithmCategorySchema,
  description: z.string(),
  steps: z.array(z.string()).min(1, 'Algorithm steps cannot be empty'),
  alternatives: z.array(AlgorithmAlternativeSchema),
  selectedBecause: z.string(),
});
export type AlgorithmPlan = z.infer<typeof AlgorithmPlanSchema>;

export const CorrectnessReasoningSchema = z.object({
  invariant: z.string().nullable(),
  argument: z.string(),
  keyCases: z.array(z.string()),
  conclusion: z.string(),
});
export type CorrectnessReasoning = z.infer<typeof CorrectnessReasoningSchema>;

export const ComplexityAnalysisSchema = z.object({
  time: z.string(),
  space: z.string(),
  explanation: z.string(),
});
export type ComplexityAnalysis = z.infer<typeof ComplexityAnalysisSchema>;

export const EdgeCaseSchema = z.object({
  case: z.string(),
  whyImportant: z.string(),
  expectedBehavior: z.string(),
});
export type EdgeCase = z.infer<typeof EdgeCaseSchema>;

export const ImplementationRequirementSchema = z.object({
  requirement: z.string(),
  priority: z.enum(['required', 'recommended']),
  reason: z.string(),
});
export type ImplementationRequirement = z.infer<typeof ImplementationRequirementSchema>;

export const SolutionPlanSchema = z.object({
  status: SolutionPlanStatusSchema,
  problemUnderstanding: z.string().min(1, 'Problem understanding is required'),
  keyInsights: z.array(z.string()),
  constraintsAnalysis: ConstraintAnalysisSchema,
  algorithm: AlgorithmPlanSchema,
  correctnessReasoning: CorrectnessReasoningSchema,
  complexity: ComplexityAnalysisSchema,
  edgeCases: z.array(EdgeCaseSchema),
  implementationRequirements: z.array(ImplementationRequirementSchema),
  assumptions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  model: z.string(),
  provider: z.string(),
  generatedAt: z.number(),
});
export type SolutionPlan = z.infer<typeof SolutionPlanSchema>;

export const ReasoningIssueSeveritySchema = z.enum(['error', 'warning']);
export type ReasoningIssueSeverity = z.infer<typeof ReasoningIssueSeveritySchema>;

export const ReasoningIssueSchema = z.object({
  field: z.string(),
  message: z.string(),
  severity: ReasoningIssueSeveritySchema,
});
export type ReasoningIssue = z.infer<typeof ReasoningIssueSchema>;

export const ReasoningValidationSchema = z.object({
  valid: z.boolean(),
  issues: z.array(ReasoningIssueSchema),
  warnings: z.array(z.string()),
});
export type ReasoningValidation = z.infer<typeof ReasoningValidationSchema>;

import { ProblemExtractionResult, ExtractionFieldResult } from './types';
import { PageDetectionResult } from '../detection/types';
import { CandidateDetector } from './candidate-detector';
import { TitleExtractor } from './extractors/title-extractor';
import { StatementExtractor } from './extractors/statement-extractor';
import { InputExtractor } from './extractors/input-extractor';
import { OutputExtractor } from './extractors/output-extractor';
import { ConstraintsExtractor } from './extractors/constraints-extractor';
import { ExamplesExtractor } from './extractors/examples-extractor';
import { NotesExtractor } from './extractors/notes-extractor';
import { LanguageExtractor } from './extractors/language-extractor';
import { ConfidenceCalculator } from './confidence-calculator';
import { ProblemAssembler } from './problem-assembler';
import { ProblemValidator } from './problem-validator';
import { TextScraperExtractor } from './text-scraper-extractor';
import { CodeChefProblemExtractor } from './extractors/codechef-extractor';
import { LearnLogicifyProblemExtractor } from './extractors/learnlogicify-extractor';

export class ProblemExtractor {
  public static extract(
    doc?: Document,
    detectionResult?: PageDetectionResult
  ): ProblemExtractionResult {
    const startTime = performance.now();
    const targetDoc = doc || (typeof document !== 'undefined' ? document : undefined);

    if (!targetDoc) {
      const endTime = performance.now();
      return {
        status: 'failed',
        problem: null,
        confidence: 0,
        fields: [],
        warnings: ['DOM Document object unavailable in background worker context.'],
        errors: ['DOM document object is required for problem extraction.'],
        durationMs: Number((endTime - startTime).toFixed(2)),
      };
    }

    // 1. Extraction Eligibility Check
    if (detectionResult && detectionResult.type === 'normal') {
      const bodyText = (targetDoc.body ? targetDoc.body.innerText : '') || targetDoc.body?.textContent || '';
      const hasProblemKeywords = /example|sample|input:|output:|constraints|problem/i.test(bodyText);
      if (!hasProblemKeywords && bodyText.length < 100) {
        const endTime = performance.now();
        return {
          status: 'failed',
          problem: null,
          confidence: 0,
          fields: [],
          warnings: [],
          errors: ['Page is not classified as a coding environment.'],
          durationMs: Number((endTime - startTime).toFixed(2)),
        };
      }
    }

    // 2. Dedicated LearnLogicify & CodeChef Extraction Routes
    if (LearnLogicifyProblemExtractor.isLearnLogicify(targetDoc)) {
      const learnLogicifyResult = LearnLogicifyProblemExtractor.extract(targetDoc);
      if (learnLogicifyResult.status === 'success') {
        return learnLogicifyResult;
      }
    }

    if (CodeChefProblemExtractor.isCodeChef(targetDoc)) {
      const codeChefResult = CodeChefProblemExtractor.extract(targetDoc);
      if (codeChefResult.status === 'success') {
        return codeChefResult;
      }
    }

    // 2. Identify candidate container
    const container = CandidateDetector.findBestContainer(targetDoc);
    const url = targetDoc.location ? targetDoc.location.href : '';
    const hostname = targetDoc.location ? targetDoc.location.hostname : '';

    const fields: ExtractionFieldResult[] = [];

    // 3. Field Extraction via Heuristics
    let titleRes = TitleExtractor.extract(container, targetDoc);
    let statementRes = StatementExtractor.extract(container, targetDoc);
    let inputRes = InputExtractor.extract(container);
    let outputRes = OutputExtractor.extract(container);
    let constraintsRes = ConstraintsExtractor.extract(container);
    let examplesRes = ExamplesExtractor.extract(container, targetDoc);
    const notesRes = NotesExtractor.extract(container);
    const languageRes = LanguageExtractor.extract(targetDoc);

    // 4. Web-Scraping Text Fallback (if DOM heuristics miss examples or problem statement)
    if (examplesRes.examples.length === 0 || !statementRes.statement || statementRes.statement.length < 80 || !constraintsRes.constraints) {
      const textToScrape =
        (container as HTMLElement).innerText ||
        (targetDoc.body ? targetDoc.body.innerText : '') ||
        container.textContent ||
        '';

      if (textToScrape.length > 50) {
        const scraped = TextScraperExtractor.scrapeFromText(textToScrape);

        if (examplesRes.examples.length === 0 && scraped.examples.length > 0) {
          examplesRes = {
            examples: scraped.examples,
            fieldResult: {
              field: 'examples',
              status: 'found',
              confidence: 0.85,
              method: 'text-scraper-fallback',
            },
          };
        }

        if ((!statementRes.statement || statementRes.statement.length < 80) && scraped.statement) {
          statementRes = {
            statement: scraped.statement,
            fieldResult: {
              field: 'statement',
              status: 'found',
              confidence: 0.85,
              method: 'text-scraper-fallback',
            },
          };
        }

        if (!constraintsRes.constraints && scraped.constraints) {
          constraintsRes = {
            constraints: scraped.constraints,
            fieldResult: {
              field: 'constraints',
              status: 'found',
              confidence: 0.8,
              method: 'text-scraper-fallback',
            },
          };
        }

        if (titleRes.title === 'Coding Problem' && scraped.title) {
          titleRes = {
            title: scraped.title,
            fieldResult: {
              field: 'title',
              status: 'found',
              confidence: 0.8,
              method: 'text-scraper-fallback',
            },
          };
        }
      }
    }

    fields.push(titleRes.fieldResult);
    fields.push(statementRes.fieldResult);
    fields.push(inputRes.fieldResult);
    fields.push(outputRes.fieldResult);
    fields.push(constraintsRes.fieldResult);
    fields.push(examplesRes.fieldResult);
    fields.push(notesRes.fieldResult);
    fields.push(languageRes.fieldResult);

    // 5. Calculate Confidence
    const confidence = ConfidenceCalculator.calculateOverall(fields);

    // 6. Assemble Candidate Problem Object
    const candidateProblem = ProblemAssembler.assemble({
      title: titleRes.title,
      statement: statementRes.statement,
      inputFormat: inputRes.inputFormat,
      outputFormat: outputRes.outputFormat,
      constraints: constraintsRes.constraints,
      examples: examplesRes.examples,
      notes: notesRes.notes,
      language: languageRes.language,
      url,
      hostname,
      confidence,
    });

    // 7. Validation
    const validation = ProblemValidator.validate(candidateProblem, fields);

    const endTime = performance.now();
    const durationMs = Number((endTime - startTime).toFixed(2));

    if (validation.status === 'failed') {
      return {
        status: 'failed',
        problem: null,
        confidence: 0,
        fields,
        warnings: validation.warnings,
        errors: validation.errors,
        durationMs,
      };
    }

    return {
      status: validation.status,
      problem: candidateProblem,
      confidence,
      fields,
      warnings: validation.warnings,
      errors: validation.errors,
      durationMs,
    };
  }
}

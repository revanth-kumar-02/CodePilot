import { AIError } from '../ai/ai-provider.js';

export interface ExtractionResult {
  jsonString: string;
  parserMethod: 'DIRECT_JSON' | 'MARKDOWN_NORMALIZED' | 'OBJECT_EXTRACTED';
}

export class JsonCleaner {
  /**
   * Normalizes raw AI response text by removing markdown code fences and trimming.
   * Throws AI_EMPTY_RESPONSE if content is missing or whitespace only.
   */
  public static normalizeAIResponse(raw: string | null | undefined): string {
    if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
      throw new AIError(
        'AI_EMPTY_RESPONSE',
        'No usable content received from AI model.',
        502,
        true
      );
    }

    let text = raw.trim();

    // Remove markdown code fences if wrapped in ```json ... ``` or ``` ... ```
    if (text.startsWith('```')) {
      const firstNewline = text.indexOf('\n');
      if (firstNewline !== -1) {
        text = text.substring(firstNewline + 1);
      }
      if (text.endsWith('```')) {
        text = text.substring(0, text.length - 3);
      }
      text = text.trim();
    }

    return text;
  }

  /**
   * String-aware balanced-brace scanner.
   * Locates the first complete JSON object in the input string.
   * Correctly ignores braces inside strings and handles escaped characters.
   */
  public static extractJsonObject(raw: string): ExtractionResult {
    const normalized = JsonCleaner.normalizeAIResponse(raw);

    // Test for Direct pure JSON
    if (normalized.startsWith('{') && normalized.endsWith('}')) {
      try {
        // Quick verify if valid JSON directly
        JSON.parse(normalized);
        return {
          jsonString: normalized,
          parserMethod: raw.trim().startsWith('```') ? 'MARKDOWN_NORMALIZED' : 'DIRECT_JSON',
        };
      } catch {
        // Fall through to balanced brace extraction if parse fails (e.g. text after closing brace inside fence)
      }
    }

    let inString = false;
    let escaped = false;
    let braceCount = 0;
    let firstBraceIndex = -1;

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
      } else {
        if (char === '"') {
          inString = true;
        } else if (char === '{') {
          if (firstBraceIndex === -1) {
            firstBraceIndex = i;
          }
          braceCount++;
        } else if (char === '}') {
          if (firstBraceIndex !== -1) {
            braceCount--;
            if (braceCount === 0) {
              const extracted = normalized.substring(firstBraceIndex, i + 1);
              return {
                jsonString: extracted,
                parserMethod: 'OBJECT_EXTRACTED',
              };
            }
          }
        }
      }
    }

    // Truncation detection: opening brace was found, but braces were unclosed or text ended inside a string
    if (firstBraceIndex !== -1) {
      if (braceCount > 0 || inString) {
        throw new AIError(
          'AI_RESPONSE_TRUNCATED',
          'The AI response ended before the SolutionPlan JSON was complete.',
          502,
          true
        );
      }
    }

    // No JSON object structure found
    throw new AIError(
      'AI_RESPONSE_NOT_JSON',
      'The AI response did not contain a valid JSON object structure.',
      502,
      true
    );
  }

  public static extractAndRepairJson(raw: string): string {
    const { jsonString } = JsonCleaner.extractJsonObject(raw);
    return jsonString;
  }

  /**
   * Helper method for parsing & validating raw AI string safely.
   */
  public static parseJsonSafely(raw: string): { data: unknown; parserMethod: 'DIRECT_JSON' | 'MARKDOWN_NORMALIZED' | 'OBJECT_EXTRACTED' } {
    const { jsonString, parserMethod } = JsonCleaner.extractJsonObject(raw);

    try {
      const data = JSON.parse(jsonString);
      return { data, parserMethod };
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      
      // If JSON.parse reports unterminated string or unexpected end of input, map to AI_RESPONSE_TRUNCATED
      if (
        errMessage.includes('Unterminated string') ||
        errMessage.includes('Unexpected end of JSON input') ||
        errMessage.includes('Unexpected end of data')
      ) {
        throw new AIError(
          'AI_RESPONSE_TRUNCATED',
          `The AI response ended before the SolutionPlan JSON was complete: ${errMessage}`,
          502,
          true
        );
      }

      throw new AIError(
        'AI_RESPONSE_NOT_JSON',
        `Reasoning engine returned malformed JSON: ${errMessage}`,
        502,
        true
      );
    }
  }
}

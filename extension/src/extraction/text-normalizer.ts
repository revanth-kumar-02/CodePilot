export class TextNormalizer {
  public static normalize(text: string | null | undefined): string {
    if (!text) return '';

    let cleaned = text;

    // 1. Replace non-breaking spaces and special zero-width chars
    cleaned = cleaned.replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ');

    // 2. Decode basic HTML entities if present
    cleaned = cleaned
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // 3. Normalize carriage returns to standard line breaks
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 4. Remove leading/trailing spaces per line while keeping line structure
    const lines = cleaned.split('\n').map((line) => line.trimEnd());

    // 5. Replace 3 or more consecutive blank lines with a double newline
    const collapsedLines: string[] = [];
    let blankCount = 0;

    for (const line of lines) {
      if (line.trim() === '') {
        blankCount++;
        if (blankCount <= 2) {
          collapsedLines.push('');
        }
      } else {
        blankCount = 0;
        // Trim leading indentation unless code block (handled specifically)
        collapsedLines.push(line);
      }
    }

    return collapsedLines.join('\n').trim();
  }

  public static normalizeInline(text: string | null | undefined): string {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  public static calculateSimilarity(str1: string, str2: string): number {
    const s1 = this.normalizeInline(str1).toLowerCase();
    const s2 = this.normalizeInline(str2).toLowerCase();
    if (s1 === s2) return 1.0;
    if (!s1 || !s2) return 0.0;

    const lengthRatio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
    if (lengthRatio < 0.5) return 0.0;

    const commonPrefixLength = Array.from(s1).findIndex((char, idx) => char !== s2[idx]);
    if (commonPrefixLength > 0 && commonPrefixLength / Math.max(s1.length, s2.length) > 0.8) {
      return 0.85;
    }

    return s1.includes(s2) || s2.includes(s1) ? 0.75 : 0.0;
  }
}

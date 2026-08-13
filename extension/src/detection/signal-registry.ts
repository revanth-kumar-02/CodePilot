import { PageSnapshot, DetectionSignal, EditorDetection } from './types';

export class SignalRegistry {
  public static extractSignals(snapshot: PageSnapshot, editor: EditorDetection): DetectionSignal[] {
    const signals: DetectionSignal[] = [];

    // Add Editor Signals
    signals.push(...editor.signals);

    const fullText = (snapshot.title + ' ' + snapshot.headings.join(' ') + ' ' + snapshot.visibleTextSample).toLowerCase();

    // 1. Content Signals
    const contentKeywords = [
      { key: 'problem statement', id: 'content-problem-statement', score: 0.25 },
      { key: 'input format', id: 'content-input-format', score: 0.25 },
      { key: 'output format', id: 'content-output-format', score: 0.25 },
      { key: 'constraints', id: 'content-constraints', score: 0.2 },
      { key: 'sample input', id: 'content-sample-input', score: 0.25 },
      { key: 'sample output', id: 'content-sample-output', score: 0.25 },
      { key: 'test cases', id: 'content-test-cases', score: 0.2 },
      { key: 'explanation', id: 'content-explanation', score: 0.1 },
      { key: 'example 1', id: 'content-example-1', score: 0.3 },
      { key: 'example 2', id: 'content-example-2', score: 0.2 },
      { key: 'example:', id: 'content-example-colon', score: 0.25 },
      { key: 'examples', id: 'content-examples', score: 0.2 },
      { key: 'input:', id: 'content-input-colon', score: 0.2 },
      { key: 'output:', id: 'content-output-colon', score: 0.2 },
      { key: 'description', id: 'content-description', score: 0.15 },
      { key: 'time complexity', id: 'content-time-complexity', score: 0.15 },
      { key: 'space complexity', id: 'content-space-complexity', score: 0.15 },
    ];

    contentKeywords.forEach((item) => {
      if (fullText.includes(item.key)) {
        signals.push({
          id: item.id,
          category: 'content',
          score: item.score,
          evidence: `Detected problem content phrase "${item.key}"`,
        });
      }
    });

    // 2. Interaction / Controls Signals (Run, Compile, Test, Submit)
    const runControlKeywords = ['run', 'run code', 'compile', 'test', 'submit'];
    const matchedButtons = snapshot.buttons.filter((btn) =>
      runControlKeywords.some((keyword) => btn.toLowerCase().includes(keyword))
    );

    if (matchedButtons.length > 0) {
      signals.push({
        id: 'interaction-run-control',
        category: 'interaction',
        score: 0.25,
        evidence: `Detected action button(s): ${matchedButtons.join(', ')}`,
      });
    }

    // 3. Programming Language Selector / Hints
    const languageKeywords = ['java', 'python', 'c++', 'javascript', 'typescript', 'rust', 'go', 'golang', 'kotlin'];
    const foundLanguages = languageKeywords.filter((lang) => fullText.includes(lang));
    if (foundLanguages.length > 0 && foundLanguages.length < 5) {
      signals.push({
        id: 'language-hints',
        category: 'language',
        score: 0.15,
        evidence: `Detected programming language reference(s): ${foundLanguages.slice(0, 3).join(', ')}`,
      });
    }

    // 4. URL Pattern Signals (HackerRank, LeetCode, CodeChef, Codeforces, GeeksforGeeks, etc.)
    const urlLower = snapshot.url.toLowerCase();
    const isProblemUrl =
      urlLower.includes('logicify') ||
      urlLower.includes('hackerrank.com/test/') ||
      urlLower.includes('hackerrank.com/challenges/') ||
      urlLower.includes('leetcode.com/problems/') ||
      urlLower.includes('codechef.com/problems/') ||
      urlLower.includes('codeforces.com/problemset/problem/') ||
      urlLower.includes('codeforces.com/contest/') ||
      urlLower.includes('geeksforgeeks.org/problems/') ||
      urlLower.includes('atcoder.jp/contests/') ||
      urlLower.includes('/problems/') ||
      urlLower.includes('/problem/') ||
      urlLower.includes('/questions/') ||
      urlLower.includes('/question/') ||
      urlLower.includes('/challenges/') ||
      urlLower.includes('/challenge/') ||
      urlLower.includes('/tasks/') ||
      urlLower.includes('/task/') ||
      urlLower.includes('/assessment/') ||
      urlLower.includes('/coding/') ||
      urlLower.includes('/lab/') ||
      urlLower.includes('/practice/');

    if (isProblemUrl) {
      signals.push({
        id: 'url-platform-problem',
        category: 'content',
        score: 0.6,
        evidence: 'URL matches coding platform problem pattern',
      });
    }

    return signals;
  }
}

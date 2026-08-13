import test from 'node:test';
import assert from 'node:assert/strict';
import { CodeChefProblemExtractor } from '../src/extraction/extractors/codechef-extractor.ts';
import { ProblemExtractor } from '../src/extraction/problem-extractor.ts';

function createMockElement(tagName: string, text: string, classList: string[] = [], children: any[] = []): any {
  const element = {
    tagName: tagName.toUpperCase(),
    textContent: text,
    classList: {
      contains: (cls: string) => classList.includes(cls),
    },
    className: classList.join(' '),
    closest: (sel: string) => {
      if (sel.includes('editor') && classList.some(c => c.includes('editor'))) return element;
      return null;
    },
    querySelector: (sel: string) => {
      for (const child of children) {
        if (matchesSelector(child, sel)) return child;
        const sub = child.querySelector ? child.querySelector(sel) : null;
        if (sub) return sub;
      }
      return null;
    },
    querySelectorAll: (sel: string) => {
      const results: any[] = [];
      for (const child of children) {
        if (matchesSelector(child, sel)) results.push(child);
        if (child.querySelectorAll) {
          results.push(...child.querySelectorAll(sel));
        }
      }
      return results;
    },
    cloneNode: () => element,
    remove: () => {},
  };
  return element;
}

function matchesSelector(el: any, sel: string): boolean {
  if (!el || !el.tagName) return false;
  if (sel.startsWith('.') && el.className.includes(sel.slice(1))) return true;
  if (sel.startsWith('#') && el.className.includes(sel.slice(1))) return true;
  if (sel.includes('problem-statement') && el.className.includes('problem-statement')) return true;
  if (sel.includes('problem-name') && el.className.includes('problem-name')) return true;
  if (sel === 'h1' && el.tagName === 'H1') return true;
  if (sel === 'h2' && el.tagName === 'H2') return true;
  if (sel === 'p' && el.tagName === 'P') return true;
  if (sel === 'table' && el.tagName === 'TABLE') return true;
  return false;
}

function createMockDocument(url: string, title: string, bodyChildren: any[]): any {
  const body = createMockElement('body', bodyChildren.map(c => c.textContent).join('\n'), [], bodyChildren);
  const doc = {
    location: { href: url, hostname: 'www.codechef.com' },
    title,
    body,
    querySelector: (sel: string) => body.querySelector(sel),
    querySelectorAll: (sel: string) => body.querySelectorAll(sel),
  };
  return doc;
}

test('CodeChef Extraction - Valid Problem Statement (Print Squares)', () => {
  const pName = createMockElement('div', 'Print Squares', ['problem-name']);
  const stmt = createMockElement('p', 'Write a program to output the squares (using multiplication) of numbers from 1 to 5 on separate lines.');
  const inTitle = createMockElement('h3', 'Input Format');
  const inBody = createMockElement('p', 'There is no input for this problem.');
  const outTitle = createMockElement('h3', 'Output Format');
  const outBody = createMockElement('p', 'Print the square of each number from 1 to 5 on a new line.');
  const cTitle = createMockElement('h3', 'Constraints');
  const cBody = createMockElement('p', '1 <= N <= 5');

  const container = createMockElement('div', 'Print Squares Write a program to output the squares of numbers from 1 to 5 on separate lines. Input Format There is no input. Output Format Print the square of each number. Constraints 1 <= N <= 5', ['problem-statement'], [pName, stmt, inTitle, inBody, outTitle, outBody, cTitle, cBody]);

  const doc = createMockDocument(
    'https://www.codechef.com/practice/course/java/LPJAAS01/problems/JAAS05',
    'Print Squares Practice Problem in Java - CodeChef',
    [container]
  );

  const isCC = CodeChefProblemExtractor.isCodeChef(doc);
  assert.equal(isCC, true);

  const result = ProblemExtractor.extract(doc);
  assert.equal(result.status, 'success');
  assert.ok(result.problem);
  assert.equal(result.problem?.title, 'Print Squares');
  assert.ok(result.problem?.statement.includes('squares'));
  assert.equal(result.problem?.source.platform, 'CodeChef');
});

test('CodeChef Extraction - Fails on Incomplete Content (<50 chars)', () => {
  const container = createMockElement('div', 'Short text', ['problem-statement']);
  const doc = createMockDocument('https://www.codechef.com/problems/TEST', 'Test - CodeChef', [container]);

  const result = CodeChefProblemExtractor.extract(doc);
  assert.equal(result.status, 'failed');
  assert.equal(result.problem, null);
  assert.ok(result.errors.some(e => e.includes('EXTRACTION_INCOMPLETE')));
});

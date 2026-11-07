// Test-change classifier (docs/specs/test-change-review.md, AC-1 to AC-3). Given the old and new
// text of a test file, reports whether the change weakens the tests in it, and how, or only adds to
// them (additive), or changes nothing they check (neutral). JavaScript and TypeScript tests (Vitest,
// Jest, Playwright, node:test) and Python tests (pytest, unittest) are read; any other file, or one
// that cannot be read, is "unclear". Snapshot files and visual baselines are always weakening.
//
// A change is neutral only when it can be shown to be neutral: identifiers renamed consistently
// across the file, import paths, TypeScript types, test titles, formatting, or comments. Any other
// removed token counts as weakening ("unexplained-change"), so the classifier errs towards asking.
// A known gap: renaming an imported name everywhere (add to sub) reads as a consistent rename, so it
// is neutral here; the pull request review (AC-9) still checks the change.
//
// Plain Node, no dependencies, no network: the session hooks run it on every test edit.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const JS_EXT = /\.(?:[cm]?[jt]sx?)$/;
const TS_EXT = /\.(?:[cm]?ts)$/;
const PY_EXT = /\.py$/;
const SNAPSHOT = /(\.snap$|__snapshots__\/|-snapshots\/|__screenshots__\/|\.png$)/;
const MAX_CELLS = 4_000_000;

export function classifyTestChange({ file, before, after }) {
  const path = String(file ?? '').replace(/\\/g, '/');
  if (SNAPSHOT.test(path)) {
    return { result: 'weakening', findings: [{ kind: 'snapshot', line: 1, message: 'a snapshot or visual baseline changed, which rewrites expected values' }] };
  }
  const lang = JS_EXT.test(path) ? 'js' : PY_EXT.test(path) ? 'py' : null;
  if (!lang) return unclear(`no classifier for ${path.split('/').pop() || 'this file'}`);
  if (before === after) return { result: 'neutral', findings: [] };
  let a;
  let b;
  try {
    a = lang === 'js' ? readJs(before, TS_EXT.test(path)) : readPy(before);
    b = lang === 'js' ? readJs(after, TS_EXT.test(path)) : readPy(after);
  } catch (e) {
    return unclear(`could not read the file (${e.message})`);
  }
  try {
    return compare(a, b, lang);
  } catch (e) {
    return unclear(e.message);
  }
}

const unclear = message => ({ result: 'unclear', findings: [{ kind: 'unclear', line: 1, message }] });

// ---------------------------------------------------------------- tokens

const key = t => `${t.t}:${t.v}`;

function balance(tokens) {
  const stack = [];
  const pairs = { ')': '(', ']': '[', '}': '{' };
  for (const t of tokens) {
    if (t.t !== 'p') continue;
    if (t.v === '(' || t.v === '[' || t.v === '{') stack.push(t);
    else if (pairs[t.v]) {
      const open = stack.pop();
      if (!open || open.v !== pairs[t.v]) throw new Error(`unbalanced "${t.v}" on line ${t.line}`);
    }
  }
  if (stack.length) throw new Error(`unclosed "${stack.at(-1).v}" from line ${stack.at(-1).line}`);
}

const JS_OPS = ['===', '!==', '...', '**=', '&&=', '||=', '??=', '=>', '?.', '??', '&&', '||', '==', '!=', '<=', '>=', '++', '--', '**', '+=', '-=', '*=', '/=', '%=', '<<', '>>'];
const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof', 'yield', 'await']);
const REGEX_AFTER_PUNCT = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^', '=>', '&&', '||', '??', '==', '===', '!=', '!==']);

function stripTypes(code) {
  let strip;
  try { ({ stripTypeScriptTypes: strip } = require('node:module')); } catch { /* older Node */ }
  if (typeof strip !== 'function') return code;
  const emit = process.emitWarning;
  process.emitWarning = () => {};
  try {
    return strip(code, { mode: 'strip' });
  } catch (e) {
    throw new Error(`TypeScript syntax: ${String(e.message).split('\n')[0]}`);
  } finally {
    process.emitWarning = emit;
  }
}

function tokenizeJs(src) {
  const tokens = [];
  const comments = [];
  let i = 0;
  let line = 1;
  const n = src.length;
  const push = (t, v, at) => tokens.push({ t, v, line: at });
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      comments.push({ text: src.slice(i + 2, end === -1 ? n : end), line });
      i = end === -1 ? n : end;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end === -1) throw new Error(`unclosed comment on line ${line}`);
      const text = src.slice(i + 2, end);
      text.split('\n').forEach((l, k) => comments.push({ text: l.replace(/^\s*\*?/, ''), line: line + k }));
      line += (text.match(/\n/g) ?? []).length;
      i = end + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const start = line;
      let v = '';
      i++;
      while (i < n && src[i] !== c) {
        if (src[i] === '\n') throw new Error(`unclosed string on line ${start}`);
        if (src[i] === '\\') { v += src[i + 1] ?? ''; i += 2; continue; }
        v += src[i++];
      }
      if (i >= n) throw new Error(`unclosed string on line ${start}`);
      i++;
      push('s', v, start);
      continue;
    }
    if (c === '`') {
      const start = line;
      let v = '';
      let depth = 0;
      i++;
      while (i < n) {
        const d = src[i];
        if (d === '\\') { v += src.slice(i, i + 2); i += 2; continue; }
        if (d === '\n') line++;
        if (depth === 0 && d === '`') break;
        if (d === '$' && src[i + 1] === '{') { depth++; v += '${'; i += 2; continue; }
        if (depth > 0 && d === '{') depth++;
        if (depth > 0 && d === '}') depth--;
        v += d;
        i++;
      }
      if (i >= n) throw new Error(`unclosed template on line ${start}`);
      i++;
      push('s', v, start);
      continue;
    }
    const num = /^(?:0[xob][\da-f_]+|\d[\d_]*(?:\.\d*)?(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)n?/i.exec(src.slice(i, i + 40));
    if (num && (/\d/.test(c) || (c === '.' && /\d/.test(src[i + 1] ?? '')))) {
      push('n', num[0].replace(/_/g, '').toLowerCase(), line);
      i += num[0].length;
      continue;
    }
    const word = /^[A-Za-z_$][\w$]*/.exec(src.slice(i, i + 200));
    if (word) {
      push('i', word[0], line);
      i += word[0].length;
      continue;
    }
    if (c === '/') {
      const prev = tokens.at(-1);
      const regex = !prev || (prev.t === 'p' && REGEX_AFTER_PUNCT.has(prev.v)) || (prev.t === 'i' && REGEX_AFTER_WORD.has(prev.v));
      if (regex) {
        let j = i + 1;
        let cls = false;
        while (j < n && src[j] !== '\n') {
          if (src[j] === '\\') { j += 2; continue; }
          if (src[j] === '[') cls = true;
          else if (src[j] === ']') cls = false;
          else if (src[j] === '/' && !cls) break;
          j++;
        }
        if (j >= n || src[j] !== '/') throw new Error(`unclosed regular expression on line ${line}`);
        j++;
        while (j < n && /[a-z]/i.test(src[j])) j++;
        push('r', src.slice(i, j), line);
        i = j;
        continue;
      }
    }
    const op = JS_OPS.find(o => src.startsWith(o, i)) ?? c;
    push('p', op, line);
    i += op.length;
  }
  balance(tokens);
  return { tokens, comments };
}

const PY_OPS = ['**=', '//=', '>>=', '<<=', '...', '==', '!=', '<=', '>=', '**', '//', '->', ':=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>'];

function tokenizePy(src) {
  const tokens = [];
  const comments = [];
  let i = 0;
  let line = 1;
  let depth = 0;
  const n = src.length;
  const push = (t, v, at) => tokens.push({ t, v, line: at });
  while (i < n) {
    const c = src[i];
    if (c === '\n') {
      if (depth === 0 && tokens.length && tokens.at(-1).t !== 'nl') push('nl', '', line);
      line++;
      i++;
      continue;
    }
    if (c === '\\' && src[i + 1] === '\n') { line++; i += 2; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '#') {
      const end = src.indexOf('\n', i);
      comments.push({ text: src.slice(i + 1, end === -1 ? n : end), line });
      i = end === -1 ? n : end;
      continue;
    }
    const str = /^([rbuf]{0,2})("""|'''|"|')/i.exec(src.slice(i, i + 5));
    if (str) {
      const quote = str[2];
      const start = line;
      let j = i + str[0].length;
      let v = '';
      while (j < n && !src.startsWith(quote, j)) {
        if (src[j] === '\n') {
          if (quote.length === 1) throw new Error(`unclosed string on line ${start}`);
          line++;
        }
        if (src[j] === '\\') { v += src[j + 1] ?? ''; if (src[j + 1] === '\n') line++; j += 2; continue; }
        v += src[j++];
      }
      if (j >= n) throw new Error(`unclosed string on line ${start}`);
      push('s', v, start);
      i = j + quote.length;
      continue;
    }
    const num = /^(?:0[xob][\da-f_]+|\d[\d_]*(?:\.\d*)?(?:e[+-]?\d+)?j?|\.\d+(?:e[+-]?\d+)?j?)/i.exec(src.slice(i, i + 40));
    if (num && (/\d/.test(c) || (c === '.' && /\d/.test(src[i + 1] ?? '')))) {
      push('n', num[0].replace(/_/g, '').toLowerCase(), line);
      i += num[0].length;
      continue;
    }
    const word = /^[A-Za-z_]\w*/.exec(src.slice(i, i + 200));
    if (word) {
      push('i', word[0], line);
      i += word[0].length;
      continue;
    }
    const op = PY_OPS.find(o => src.startsWith(o, i)) ?? c;
    if (op === '(' || op === '[' || op === '{') depth++;
    if (op === ')' || op === ']' || op === '}') depth = Math.max(0, depth - 1);
    push('p', op, line);
    i += op.length;
  }
  push('nl', '', line);
  balance(tokens);
  return { tokens, comments };
}

// ---------------------------------------------------------------- reading tests

const TEST_BASES = new Set(['test', 'it', 'describe', 'suite', 'context', 'specify', 'xit', 'xtest', 'xdescribe', 'fit', 'fdescribe', 'bench']);
const DESCRIBE_BASES = new Set(['describe', 'suite', 'context', 'xdescribe', 'fdescribe']);
const TEST_MEMBERS = new Set(['skip', 'only', 'todo', 'fixme', 'fail', 'fails', 'failing', 'concurrent', 'sequential', 'each', 'slow', 'describe', 'serial', 'parallel', 'skipIf', 'runIf']);
const SKIP_MEMBERS = new Set(['skip', 'only', 'todo', 'fixme', 'fail', 'fails', 'failing', 'skipIf']);
const MODULE_CALLS = new Set(['require', 'import', 'mock', 'doMock', 'unmock', 'unstable_mockModule', 'importActual', 'importMock', 'requireActual', 'module']);
const MOCK_CALLS = new Set(['mock', 'doMock', 'unstable_mockModule', 'module']);

// JavaScript matchers, ranked by how much they pin down: a change to a lower rank loosens the test.
const JS_RANK = {
  toStrictEqual: 3,
  toBe: 2, toEqual: 2, toBeCloseTo: 2, toHaveLength: 2, toHaveBeenCalledWith: 2, toHaveBeenCalledTimes: 2,
  toHaveBeenLastCalledWith: 2, toHaveBeenNthCalledWith: 2, toHaveReturnedWith: 2, toMatchSnapshot: 2,
  toMatchInlineSnapshot: 2, toHaveText: 2, toHaveURL: 2, toHaveTitle: 2, toHaveValue: 2, toHaveCount: 2,
  toHaveAttribute: 2, toBeNull: 2, toBeUndefined: 2, toBeNaN: 2, toHaveScreenshot: 2, toThrow: 2, toThrowError: 2,
  toMatchObject: 1, toContain: 1, toContainEqual: 1, toMatch: 1, toHaveProperty: 1, toBeGreaterThan: 1,
  toBeGreaterThanOrEqual: 1, toBeLessThan: 1, toBeLessThanOrEqual: 1, toBeInstanceOf: 1, toHaveBeenCalled: 1,
  toContainText: 1, toBeVisible: 1, toBeEnabled: 1, toBeChecked: 1, toBeAttached: 1, toHaveClass: 1, toBeTypeOf: 1,
  toBeTruthy: 0, toBeFalsy: 0, toBeDefined: 0,
};
const PY_RANK = {
  assertEqual: 2, assertEquals: 2, assertIs: 2, assertIsNone: 2, assertDictEqual: 2, assertListEqual: 2, assertCountEqual: 2,
  assertAlmostEqual: 2, assertRaisesRegex: 2, assertSetEqual: 2, assertTupleEqual: 2, assertSequenceEqual: 2, assertNotEqual: 1,
  assertIn: 1, assertNotIn: 1, assertGreater: 1, assertGreaterEqual: 1, assertLess: 1, assertLessEqual: 1, assertIsInstance: 1,
  assertRaises: 2, assertRegex: 1, assertIsNot: 1, assertTrue: 0, assertFalse: 0, assertIsNotNone: 0,
};
// Numeric settings whose rise (or, for precision, fall) loosens a test.
const LOOSE_UP = new Set(['timeout', 'testTimeout', 'retries', 'retry', 'tolerance', 'delta', 'rel', 'abs', 'epsilon', 'threshold', 'maxDiffPixels', 'maxDiffPixelRatio']);
const LOOSE_DOWN = new Set(['places', 'precision', 'digits', 'numDigits']);
const CONTROL = new Set(['if', 'return', 'try', 'catch', 'except', 'else', 'continue', 'break', 'finally', 'pass']);

function matchClose(tokens, open) {
  let depth = 0;
  for (let k = open; k < tokens.length; k++) {
    const v = tokens[k].t === 'p' ? tokens[k].v : '';
    if (v === '(' || v === '[' || v === '{') depth++;
    else if (v === ')' || v === ']' || v === '}') { depth--; if (depth === 0) return k; }
  }
  return tokens.length - 1;
}

// Top-level elements of the array literal at tokens[open] (a '[').
function arrayRows(tokens, open) {
  if (tokens[open]?.v !== '[') {
    // A tagged template table: one row per line after the header.
    const t = tokens[open];
    if (t?.t === 's') return Math.max(0, t.v.split('\n').filter(l => l.trim()).length - 1);
    return 0;
  }
  const close = matchClose(tokens, open);
  let rows = 0;
  let depth = 0;
  let item = false;
  for (let k = open + 1; k < close; k++) {
    const v = tokens[k].t === 'p' ? tokens[k].v : '';
    if (v === '(' || v === '[' || v === '{') depth++;
    if (v === ')' || v === ']' || v === '}') depth--;
    if (depth === 0 && v === ',') { if (item) rows++; item = false; continue; }
    item = true;
  }
  return rows + (item ? 1 : 0);
}

// Names the file declares: imports, const/let/var, functions, classes, and "as" aliases. Only these
// can be renamed neutrally; a name read from elsewhere (a property, a global) cannot.
function declaredJs(tokens) {
  const names = new Set();
  let inImport = false;
  tokens.forEach((t, k) => {
    t.k = k;
    if (t.t === 'i' && t.v === 'import' && tokens[k - 1]?.v !== '.' && tokens[k + 1]?.v !== '(') inImport = true;
    if (inImport && t.t === 'i' && t.v === 'from') inImport = false;
    if (inImport && t.t === 's') inImport = false;
    if (t.t !== 'i') return;
    const prev = tokens[k - 1];
    if (inImport && !['import', 'as', 'type', 'from'].includes(t.v) && tokens[k + 1]?.v !== 'as') names.add(t.v);
    if (prev?.t === 'i' && ['const', 'let', 'var', 'function', 'class', 'as'].includes(prev.v)) names.add(t.v);
  });
  return names;
}

function declaredPy(tokens) {
  const names = new Set();
  let importLine = false;
  tokens.forEach((t, k) => {
    t.k = k;
    if (t.t === 'nl') { importLine = false; return; }
    if (t.t === 'i' && t.v === 'import') { importLine = true; return; }
    if (t.t !== 'i') return;
    const prev = tokens[k - 1];
    if (importLine && t.v !== 'as' && tokens[k + 1]?.v !== 'as') names.add(t.v);
    if (prev?.t === 'i' && ['def', 'class', 'as', 'for'].includes(prev.v)) names.add(t.v);
    if ((!prev || prev.t === 'nl') && tokens[k + 1]?.v === '=') names.add(t.v);
  });
  return names;
}

function readJs(text, ts) {
  const { tokens, comments } = tokenizeJs(ts ? stripTypes(text) : text);
  const declared = declaredJs(tokens);
  const tests = [];
  const describes = [];
  const modules = new Set();
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    // Module paths: from '...', import '...', require('...'), vi.mock('...').
    if (t.t === 's') {
      const p1 = tokens[k - 1];
      const p2 = tokens[k - 2];
      if ((p1?.t === 'i' && (p1.v === 'from' || p1.v === 'import')) || (p1?.v === '(' && p2?.t === 'i' && MODULE_CALLS.has(p2.v))) {
        t.role = 'module';
        if (p1.v !== '(' || p2.v === 'require' || p2.v === 'import') modules.add(t.v);
      }
    }
    if (t.t !== 'i' || !TEST_BASES.has(t.v) || tokens[k - 1]?.v === '.') continue;
    const members = [];
    let j = k + 1;
    while (tokens[j]?.v === '.' && tokens[j + 1]?.t === 'i') { members.push(tokens[j + 1].v); j += 2; }
    if (members.some(m => !TEST_MEMBERS.has(m)) || tokens[j]?.v !== '(') continue;
    let rows = null;
    let rowsAt = null;
    if (members.includes('each')) {
      rowsAt = j + 1;
      rows = arrayRows(tokens, rowsAt);
      j = matchClose(tokens, j) + 1;
      if (tokens[j]?.v !== '(') continue;
    } else if (members.includes('skipIf') || members.includes('runIf')) {
      j = matchClose(tokens, j) + 1;
      if (tokens[j]?.v !== '(') continue;
    }
    const close = matchClose(tokens, j);
    const title = tokens[j + 1];
    if (!title || title.t !== 's') continue;
    title.role = 'title';
    const entry = {
      title: title.v, start: k, end: close, line: t.line,
      skips: members.filter(m => SKIP_MEMBERS.has(m)).concat(/^[xf]/.test(t.v) ? [t.v[0]] : []),
      rows, rowsAt: rowsAt === null ? null : tokens[rowsAt]?.line,
    };
    if (DESCRIBE_BASES.has(t.v) || members.includes('describe')) describes.push(entry);
    else tests.push(entry);
  }
  for (const test of tests) {
    const path = describes.filter(d => d.start < test.start && d.end > test.end).sort((x, y) => x.start - y.start).map(d => d.title);
    test.key = [...path, test.title].join(' > ');
    test.describeSkips = describes.filter(d => d.start < test.start && d.end > test.end).flatMap(d => d.skips);
  }
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.t === 'i' && t.v === 'toMatchInlineSnapshot' && tokens[k + 1]?.v === '(') {
      const close = matchClose(tokens, k + 1);
      for (let j = k + 2; j < close; j++) tokens[j].role = 'inline-snapshot';
    }
  }
  return { lang: 'js', tokens, comments, tests, modules, declared };
}

function readPy(text) {
  const { tokens, comments } = tokenizePy(text);
  const declared = declaredPy(tokens);
  const lines = text.split('\n');
  const indent = l => l.match(/^[ \t]*/)[0].length;
  const tests = [];
  const classes = [];
  lines.forEach((l, idx) => {
    const m = /^([ \t]*)class\s+(\w+)/.exec(l);
    if (m) classes.push({ name: m[2], indent: m[1].length, line: idx + 1 });
  });
  lines.forEach((l, idx) => {
    const m = /^([ \t]*)(?:async\s+)?def\s+(test\w*)\s*\(/.exec(l);
    if (!m) return;
    const own = m[1].length;
    // Decorators above the def, including ones that span several lines (a parametrize table).
    let first = idx;
    for (let k = idx - 1; k >= 0; k--) {
      const l = lines[k];
      if (!l.trim()) break;
      if (/^\s*@/.test(l) && indent(l) === own) { first = k; continue; }
      if (indent(l) > own || (indent(l) === own && /^\s*[)\]}]/.test(l))) continue;
      break;
    }
    let last = idx;
    for (let k = idx + 1; k < lines.length; k++) {
      if (!lines[k].trim() || /^\s*#/.test(lines[k])) continue;
      if (indent(lines[k]) <= own) break;
      last = k;
    }
    const owner = classes.filter(c => c.line - 1 < idx && c.indent < own).at(-1);
    tests.push({ title: m[2], key: owner ? `${owner.name}.${m[2]}` : m[2], firstLine: first + 1, line: idx + 1, lastLine: last + 1 });
  });
  const modules = new Set();
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.t !== 'i') continue;
    if ((t.v === 'from' || t.v === 'import') && (k === 0 || tokens[k - 1].t === 'nl')) {
      let j = k + 1;
      let mod = '';
      while (tokens[j] && (tokens[j].t === 'i' || tokens[j].v === '.') && tokens[j].v !== 'import') { mod += tokens[j].v; j++; }
      if (mod) modules.add(mod);
      if (t.v === 'from' && tokens[j]?.v === 'import') {
        for (let q = j + 1; tokens[q] && tokens[q].t !== 'nl'; q++) if (tokens[q].t === 'i' && tokens[q].v !== 'as') modules.add(`${mod}.${tokens[q].v}`);
      }
    }
    if (t.v === 'def' && tokens[k + 1]?.t === 'i' && /^test/.test(tokens[k + 1].v)) tokens[k + 1].role = 'title';
  }
  for (const test of tests) {
    test.start = tokens.findIndex(t => t.line >= test.firstLine);
    let end = tokens.length - 1;
    while (end > test.start && tokens[end].line > test.lastLine) end--;
    test.end = end;
    const decorators = lines.slice(test.firstLine - 1, test.line - 1).join('\n');
    test.skips = [...decorators.matchAll(/\b(skipif|skip|xfail|expectedFailure)\b/g)].map(m => m[1]);
    test.describeSkips = [];
    const param = tokens.slice(test.start, test.end + 1).findIndex((t, q, arr) => t.v === 'parametrize' && arr[q + 1]?.v === '(');
    if (param !== -1) {
      const open = test.start + param + 1;
      const close = matchClose(tokens, open);
      let list = -1;
      for (let q = open + 1; q < close; q++) if (tokens[q].v === '[' ) { list = q; break; }
      test.rows = list === -1 ? null : arrayRows(tokens, list);
      test.rowsAt = tokens[open].line;
    } else {
      test.rows = null;
    }
  }
  return { lang: 'py', tokens, comments, tests, modules, declared };
}

// ---------------------------------------------------------------- facts about each test

function testFacts(doc, test) {
  const { tokens } = doc;
  const facts = { assertions: 0, matchers: [], settings: [], catches: [], mocks: [], skipCalls: 0 };
  const body = tokens.slice(test.start, test.end + 1);
  for (let q = 0; q < body.length; q++) {
    const t = body[q];
    const prev = body[q - 1];
    const next = body[q + 1];
    if (t.t === 'i') {
      if (doc.lang === 'js') {
        if (t.v === 'expect' && prev?.v !== '.' && (next?.v === '(' || (next?.v === '.' && /^(soft|poll)$/.test(body[q + 2]?.v)))) facts.assertions++;
        if (t.v === 'assert' && (next?.v === '(' || next?.v === '.') && (prev?.v !== '.' || body[q - 2]?.v === 't')) facts.assertions++;
        if (prev?.v === '.' && t.v in JS_RANK && next?.v === '(') {
          let rank = JS_RANK[t.v];
          if ((t.v === 'toThrow' || t.v === 'toThrowError') && body[q + 2]?.v === ')') rank = 1;
          facts.matchers.push({ name: t.v, rank, line: t.line });
          t.role = t.role ?? 'matcher';
        }
        if (t.v === 'toBeCloseTo' && next?.v === '(') {
          const close = matchClose(body, q + 1);
          const second = body.slice(q + 2, close).findIndex((x, z, arr) => x.v === ',' && arr[z + 1]?.t === 'n');
          if (second !== -1) { const num = body[q + 2 + second + 1]; num.role = 'setting'; facts.settings.push({ name: 'digits', value: Number(num.v), line: num.line }); }
        }
        if (t.v === 'catch') facts.catches.push(t.line);
        // test.skip(...) inside a test body; the test's own .skip modifier is at q = 2.
        if (t.v === 'skip' && prev?.v === '.' && next?.v === '(' && q > 2) facts.skipCalls++;
      } else {
        if (t.v === 'assert' && prev?.t !== 'p') {
          facts.assertions++;
          let end = q + 1;
          while (body[end] && body[end].t !== 'nl') end++;
          const stmt = body.slice(q + 1, end).map(x => x.v);
          const rank = stmt.some(v => v === '==' || v === 'is' || v === '!=') ? 2 : stmt.some(v => ['in', '<', '>', '<=', '>='].includes(v)) ? 1 : 0;
          facts.matchers.push({ name: 'assert', rank, line: t.line });
          t.role = 'matcher';
        }
        if (prev?.v === '.' && t.v in PY_RANK) {
          facts.assertions++;
          const generic = t.v === 'assertRaises' && /^(Exception|BaseException)$/.test(body[q + 2]?.v ?? '');
          facts.matchers.push({ name: t.v, rank: generic ? 0 : PY_RANK[t.v], line: t.line });
          t.role = 'matcher';
        }
        if (t.v === 'raises' && prev?.v === '.' && next?.v === '(') {
          facts.assertions++;
          const close = matchClose(body, q + 1);
          const args = body.slice(q + 2, close);
          const generic = args[0]?.t === 'i' && /^(Exception|BaseException)$/.test(args[0].v);
          const rank = (generic ? 0 : 1) + (args.some(x => x.v === 'match') ? 1 : 0);
          facts.matchers.push({ name: 'raises', rank, line: t.line });
          t.role = 'matcher';
        }
        if (t.v === 'except' || (t.v === 'suppress' && next?.v === '(')) facts.catches.push(t.line);
        if ((t.v === 'skip' || t.v === 'xfail' || t.v === 'skipTest') && prev?.v === '.' && next?.v === '(' && t.line > test.line) facts.skipCalls++;
      }
      // Named numeric settings: timeout: 5000, rel=1e-3, places=3.
      if ((LOOSE_UP.has(t.v) || LOOSE_DOWN.has(t.v)) && (next?.v === ':' || next?.v === '=') && body[q + 2]?.t === 'n') {
        body[q + 2].role = 'setting';
        facts.settings.push({ name: t.v, value: Number(body[q + 2].v), line: body[q + 2].line });
      }
      // Mocks of a module the file imports.
      const call = doc.lang === 'js' ? (MOCK_CALLS.has(t.v) && prev?.v === '.' && next?.v === '(' ? body[q + 2] : null)
        : ((t.v === 'patch' || (t.v === 'setattr' && prev?.v === '.')) && next?.v === '(' ? body[q + 2] : null);
      if (call?.t === 's' && mocksImport(doc, call.v)) facts.mocks.push({ target: call.v, line: t.line });
    }
  }
  // A timeout passed as the last argument of the test call: test('x', () => {...}, 5000).
  if (doc.lang === 'js') {
    const last = tokens[test.end - 1];
    if (last?.t === 'n' && tokens[test.end - 2]?.v === ',' && tokens[test.end - 3]?.v === '}') {
      last.role = 'setting';
      facts.settings.push({ name: 'timeout', value: Number(last.v), line: last.line });
    }
  }
  return facts;
}

function mocksImport(doc, target) {
  if (doc.lang === 'js') return doc.modules.has(target);
  return [...doc.modules].some(m => target === m || target.startsWith(`${m}.`));
}

// Mocks, catches, and skips outside any test (module-level vi.mock, decorators on helpers) count too.
function fileFacts(doc) {
  const inTest = new Set();
  for (const t of doc.tests) for (let k = t.start; k <= t.end; k++) inTest.add(k);
  const outside = { tests: [{ start: 0, end: doc.tokens.length - 1, line: 1 }] };
  const facts = testFacts({ ...doc, ...outside }, outside.tests[0]);
  facts.mocks = facts.mocks.filter(m => !doc.tests.some(t => doc.tokens[t.start].line <= m.line && doc.tokens[t.end].line >= m.line));
  return facts;
}


// Assertion statements: expect(...).matcher(...) chains and assert calls (JavaScript); assert
// statements and assertX(...)/pytest.raises(...) calls (Python). Each is [start, end] token indices.
// Also returns the names an assertion compares against (matcher arguments, the expected side), so a
// change to a constant the tests expect can be told from a change to input data.
function assertionSpans(doc) {
  const { tokens, lang } = doc;
  const spans = [];
  const expected = new Set();
  // Mark the expected side, and remember the names on it.
  const idsIn = (from, to) => { for (let q = from; q <= to; q++) { if (!tokens[q]) continue; tokens[q].side = 'expected'; if (tokens[q].t === 'i') expected.add(tokens[q].v); } };
  const afterFirstComma = (open, close) => {
    let depth = 0;
    for (let q = open + 1; q < close; q++) {
      const v = tokens[q].t === 'p' ? tokens[q].v : '';
      if (v === '(' || v === '[' || v === '{') depth++;
      if (v === ')' || v === ']' || v === '}') depth--;
      if (depth === 0 && v === ',') return q + 1;
    }
    return close;
  };
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    const prev = tokens[k - 1];
    if (t.t !== 'i') continue;
    if (lang === 'js') {
      if (t.v === 'expect' && prev?.v !== '.' && tokens[k + 1]?.v === '(') {
        let end = matchClose(tokens, k + 1);
        while (tokens[end + 1]?.v === '.' && tokens[end + 2]?.t === 'i') {
          const j = end + 2;
          if (tokens[j + 1]?.v === '(') {
            const close = matchClose(tokens, j + 1);
            if (/^to[A-Z]/.test(tokens[j].v)) idsIn(j + 2, close - 1);
            end = close;
          } else end = j;
        }
        spans.push([k, end]);
      } else if (t.v === 'assert' && (prev?.v !== '.' || tokens[k - 2]?.v === 't')) {
        let j = k + 1;
        if (tokens[j]?.v === '.' && tokens[j + 1]?.t === 'i') j += 2;
        if (tokens[j]?.v !== '(') continue;
        const close = matchClose(tokens, j);
        idsIn(afterFirstComma(j, close), close - 1);
        spans.push([k, close]);
      }
    } else {
      if (t.v === 'assert' && (!prev || prev.t === 'nl' || prev.v === ':')) {
        let end = k + 1;
        while (tokens[end] && tokens[end].t !== 'nl') end++;
        const cmp = tokens.slice(k + 1, end).findIndex(x => ['==', '!=', 'is', 'in', '<', '>', '<=', '>='].includes(x.v));
        if (cmp !== -1) idsIn(k + 2 + cmp, end - 1);
        spans.push([k, end - 1]);
      } else if (prev?.v === '.' && (t.v in PY_RANK || t.v === 'raises') && tokens[k + 1]?.v === '(') {
        const close = matchClose(tokens, k + 1);
        if (t.v !== 'raises') idsIn(afterFirstComma(k + 1, close), close - 1);
        spans.push([k, close]);
      }
    }
  }
  return { spans, expected };
}

// Top-level declarations: name -> [start, end] token indices (const X = ..., X = ... in Python).
function declarations(doc) {
  const { tokens, lang } = doc;
  const decls = new Map();
  let depth = 0;
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.t === 'p' && (t.v === '(' || t.v === '[' || t.v === '{')) depth++;
    if (t.t === 'p' && (t.v === ')' || t.v === ']' || t.v === '}')) depth--;
    if (depth !== 0 || t.t !== 'i') continue;
    let nameAt = -1;
    if (lang === 'js' && ['const', 'let', 'var'].includes(t.v) && tokens[k + 1]?.t === 'i' && tokens[k + 2]?.v === '=') nameAt = k + 1;
    if (lang === 'py' && (k === 0 || tokens[k - 1].t === 'nl') && tokens[k + 1]?.v === '=') nameAt = k;
    if (nameAt === -1) continue;
    const valueAt = nameAt + 2;
    let end = valueAt;
    if (['(', '[', '{'].includes(tokens[valueAt]?.v)) end = matchClose(tokens, valueAt);
    else while (tokens[end + 1] && tokens[end + 1].line === tokens[valueAt].line && tokens[end + 1].v !== ';' && tokens[end + 1].t !== 'nl') end++;
    decls.set(tokens[nameAt].v, [valueAt, end]);
  }
  return decls;
}

// Whether xs is a subsequence of ys (ys only adds to xs).
function isSubsequence(xs, ys) {
  let i = 0;
  for (const y of ys) if (i < xs.length && xs[i] === y) i++;
  return i === xs.length;
}

// ---------------------------------------------------------------- comparing

function lcsOps(a, b) {
  let pre = 0;
  while (pre < a.length && pre < b.length && key(a[pre]) === key(b[pre])) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && key(a[a.length - 1 - suf]) === key(b[b.length - 1 - suf])) suf++;
  const x = a.slice(pre, a.length - suf);
  const y = b.slice(pre, b.length - suf);
  if (x.length * y.length > MAX_CELLS) throw new Error('change too large to compare token by token');
  const m = x.length;
  const n = y.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) dp[i][j] = key(x[i]) === key(y[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  for (let k = 0; k < pre; k++) ops.push({ op: '=', a: a[k], b: b[k] });
  let i = 0;
  let j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && key(x[i]) === key(y[j])) { ops.push({ op: '=', a: x[i], b: y[j] }); i++; j++; }
    else if (j < n && (i >= m || dp[i][j + 1] >= dp[i + 1][j])) { ops.push({ op: '+', b: y[j] }); j++; }
    else { ops.push({ op: '-', a: x[i] }); i++; }
  }
  for (let k = suf; k > 0; k--) ops.push({ op: '=', a: a[a.length - k], b: b[b.length - k] });
  return ops;
}

function regionTokens(doc, test) {
  return doc.tokens.slice(test.start, test.end + 1).filter(t => t.t !== 'nl');
}

function outsideTokens(doc) {
  const skip = new Set();
  for (const t of doc.tests) for (let k = t.start; k <= t.end; k++) skip.add(k);
  return doc.tokens.filter((t, k) => !skip.has(k) && t.t !== 'nl');
}

function pairTests(a, b) {
  const pairs = [];
  const bByKey = new Map(b.tests.map(t => [t.key, t]));
  const used = new Set();
  const left = [];
  for (const t of a.tests) {
    const m = bByKey.get(t.key);
    if (m && !used.has(m)) { pairs.push([t, m]); used.add(m); } else left.push(t);
  }
  const right = b.tests.filter(t => !used.has(t));
  // Renamed tests: pair in order when the counts agree, otherwise by an identical body.
  if (left.length && left.length === right.length) {
    left.forEach((t, k) => pairs.push([t, right[k]]));
    return { pairs, removed: [], added: [] };
  }
  const sig = (doc, t) => regionTokens(doc, t).filter(x => x.role !== 'title').map(x => (x.t === 'i' ? 'i' : key(x))).join(' ');
  const removed = [];
  const free = new Set(right);
  for (const t of left) {
    const s = sig(a, t);
    const m = [...free].find(r => sig(b, r) === s);
    if (m) { pairs.push([t, m]); free.delete(m); } else removed.push(t);
  }
  return { pairs, removed, added: [...free] };
}

function multisetMinus(xs, ys, id) {
  const count = new Map();
  for (const y of ys) count.set(id(y), (count.get(id(y)) ?? 0) + 1);
  return xs.filter(x => { const c = count.get(id(x)) ?? 0; if (c > 0) { count.set(id(x), c - 1); return false; } return true; });
}

function compare(a, b, lang) {
  const findings = [];
  // Each finding names the test it belongs to (its key in the new file), when it belongs to one.
  let owner = null;
  const add = (kind, line, message, key = owner) => findings.push({ kind, line, message, ...(key ? { key } : {}) });
  const { pairs, removed, added } = pairTests(a, b);
  for (const t of removed) add('test-removed', t.line, `test "${t.key}" was removed`, null);

  // Facts compared per paired test.
  const regionOps = [];
  let changedTests = false;
  for (const [x, y] of pairs) {
    owner = y.key;
    const fx = testFacts(a, x);
    const fy = testFacts(b, y);
    if (fy.assertions < fx.assertions) add('fewer-assertions', x.line, `test "${x.key}" has ${fx.assertions - fy.assertions} fewer assertion(s)`);
    const newSkips = multisetMinus([...y.skips, ...y.describeSkips], [...x.skips, ...x.describeSkips], s => s);
    if (newSkips.length || fy.skipCalls > fx.skipCalls) add('skip-added', y.line, `test "${y.key}" is now marked ${newSkips[0] ?? 'skipped'}`);
    const ops = lcsOps(regionTokens(a, x), regionTokens(b, y));
    const removedLines = new Set(ops.filter(o => o.op === '-').map(o => o.a.line));
    const addedLines = new Set(ops.filter(o => o.op === '+').map(o => o.b.line));
    // Match untouched matchers first, so the ones left over are on the lines the edit touched.
    const touchedLast = (list, lines) => [...list].sort((p, q) => Number(lines.has(p.line)) - Number(lines.has(q.line)));
    const lost = multisetMinus(touchedLast(fx.matchers, removedLines), fy.matchers, m => `${m.name}:${m.rank}`);
    const gained = multisetMinus(touchedLast(fy.matchers, addedLines), fx.matchers, m => `${m.name}:${m.rank}`);
    if (lost.length && gained.length && Math.max(...gained.map(m => m.rank)) < Math.max(...lost.map(m => m.rank))) {
      const from = [...lost].sort((p, q) => Number(removedLines.has(q.line)) - Number(removedLines.has(p.line)) || q.rank - p.rank)[0];
      const to = gained.sort((p, q) => q.rank - p.rank)[0];
      add('looser-matcher', from.line, `${from.name} was replaced by the looser ${to.name}`);
    }
    for (const s of fx.settings) {
      const peers = fy.settings.filter(o => o.name === s.name);
      const peer = peers[fx.settings.filter(o => o.name === s.name).indexOf(s)];
      if (!peer) continue;
      if ((LOOSE_DOWN.has(s.name) && peer.value < s.value) || (!LOOSE_DOWN.has(s.name) && peer.value > s.value)) {
        add('loosened-number', s.line, `${s.name} went from ${s.value} to ${peer.value}`);
      }
    }
    if (fy.catches.length > fx.catches.length) add('error-swallowed', fy.catches.at(-1), `test "${y.key}" now catches an error`);
    if (x.rows !== null && y.rows !== null && y.rows < x.rows) add('cases-removed', x.rowsAt ?? x.line, `test "${x.key}" has ${x.rows - y.rows} fewer case(s) in its table`);
    for (const m of multisetMinus(fy.mocks, fx.mocks, z => z.target)) add('module-mocked', m.line, `${m.target}, which the file imports, is now mocked`);
    regionOps.push({ ops, test: true, key: y.key, pair: [x, y] });
    owner = null;
  }
  const fa = fileFacts(a);
  const fb = fileFacts(b);
  for (const m of multisetMinus(fb.mocks, fa.mocks, z => z.target)) add('module-mocked', m.line, `${m.target}, which the file imports, is now mocked`);
  regionOps.push({ ops: lcsOps(outsideTokens(a), outsideTokens(b)), test: false });

  // Commented-out tests.
  const oldComments = new Set(a.comments.map(c => c.text.trim()));
  const testLike = lang === 'js' ? /^\s*(test|it|describe)(\.\w+)*\s*\(/ : /^\s*(async\s+)?def\s+test|^\s*@pytest/;
  for (const c of b.comments) if (testLike.test(c.text) && !oldComments.has(c.text.trim())) { add('test-commented-out', c.line, 'a test was commented out'); break; }

  // Identifier renames: a removed identifier replaced by an added one, where the old name is gone
  // from the new file and the new name was not in the old one, the same way everywhere.
  const namesA = new Set(a.tokens.filter(t => t.t === 'i').map(t => t.v));
  const namesB = new Set(b.tokens.filter(t => t.t === 'i').map(t => t.v));
  const rename = new Map();
  const conflict = new Set();
  for (const { ops } of regionOps) {
    for (let k = 0; k < ops.length; k++) {
      if (ops[k].op === '=') continue;
      // A run of changes between two unchanged tokens, in whatever order the diff listed them.
      const dels = [];
      const ins = [];
      while (ops[k] && ops[k].op !== '=') {
        if (ops[k].op === '-') dels.push(ops[k].a); else ins.push(ops[k].b);
        k++;
      }
      k--;
      if (dels.length !== ins.length) continue;
      dels.forEach((d, z) => {
        const n = ins[z];
        if (d.t !== 'i' || n.t !== 'i' || namesB.has(d.v) || namesA.has(n.v)) return;
        if (!a.declared.has(d.v) || a.tokens[d.k - 1]?.v === '.' || a.tokens[d.k - 1]?.v === '?.') return;
        if (rename.has(d.v) && rename.get(d.v) !== n.v) conflict.add(d.v);
        rename.set(d.v, n.v);
      });
    }
  }
  for (const c of conflict) rename.delete(c);
  for (const name of [...rename.keys()]) {
    if (a.tokens.some(t => t.t === 'i' && t.v === name && (a.tokens[t.k - 1]?.v === '.' || a.tokens[t.k - 1]?.v === '?.'))) rename.delete(name);
  }
  const renamedTo = new Set(rename.values());

  // Changed expectations: an existing assertion, or a constant the assertions compare against, that
  // only gained tokens. A wrong extra output can be made to pass that way, so it is not additive.
  // (A change that also removes something is reported by the token comparison below.)
  const norm = (doc, from, to, mapped) => doc.tokens.slice(from, to + 1)
    .filter(t => t.t !== 'nl' && !(t.t === 'p' && (t.v === ',' || t.v === ';')))
    .map(t => (mapped && t.t === 'i' && rename.has(t.v) ? `i:${rename.get(t.v)}` : key(t)));
  const firstNewDiff = (doc, from, to, oldKeys) => {
    const toks = doc.tokens.slice(from, to + 1).filter(t => t.t !== 'nl' && !(t.t === 'p' && (t.v === ',' || t.v === ';')));
    return toks[toks.findIndex((t, z) => key(t) !== oldKeys[z])] ?? toks[0];
  };
  const sa = assertionSpans(a);
  const sb = assertionSpans(b);
  for (const [x, y] of pairs) {
    owner = y.key;
    const inside = (spans, t) => spans.filter(([p, q]) => p >= t.start && q <= t.end);
    const oldSpans = inside(sa.spans, x).map(([p, q]) => ({ keys: norm(a, p, q, true) }));
    const newSpans = inside(sb.spans, y).map(([p, q]) => ({ keys: norm(b, p, q, false), p, q }));
    const oldOnly = multisetMinus(oldSpans, newSpans, z => z.keys.join(' '));
    const newOnly = multisetMinus(newSpans, oldSpans, z => z.keys.join(' '));
    oldOnly.forEach((o, z) => {
      const n = newOnly[z];
      if (!n || !isSubsequence(o.keys, n.keys)) return;
      const at = firstNewDiff(b, n.p, n.q, o.keys);
      if (at.side === 'expected') add('expected-value-changed', at.line, 'an existing assertion now expects something different');
      else add('assertion-changed', at.line, 'an existing assertion now checks something different (its subject or options changed)');
    });
  }
  owner = null;
  const da = declarations(a);
  const db = declarations(b);
  for (const name of sa.expected) {
    const before = da.get(name);
    const after = db.get(rename.get(name) ?? name);
    if (!before || !after) continue;
    const ok = norm(a, before[0], before[1], true);
    const nk = norm(b, after[0], after[1], false);
    if (ok.join(' ') !== nk.join(' ') && isSubsequence(ok, nk)) add('expected-value-changed', firstNewDiff(b, after[0], after[1], ok).line, `${name}, which an assertion compares against, gained entries`);
  }

  // Removed and added tokens that nothing above explains.
  let additions = added.length > 0;
  const explainedRemoval = t => t.role === 'title' || t.role === 'module' || t.role === 'matcher' || t.role === 'setting'
    || (t.t === 'p' && (t.v === ',' || t.v === ';')) || (t.t === 'i' && rename.has(t.v));
  for (const { ops, test, key: regionKey } of regionOps) {
    owner = regionKey ?? null;
    for (const o of ops) {
      if (o.op === '-' && !explainedRemoval(o.a)) {
        changedTests ||= test;
        const t = o.a;
        if (t.role === 'inline-snapshot') add('inline-snapshot-changed', t.line, 'an inline snapshot changed');
        else if (t.t === 's' || t.t === 'n' || t.t === 'r') add('expected-literal-changed', t.line, `the value ${t.t === 's' ? JSON.stringify(t.v) : t.v} was changed or removed`);
        else add('unexplained-change', t.line, `"${t.v}" was changed or removed, and the change is not a rename, an import path, a type, or formatting`);
      }
      if (o.op === '+') {
        const t = o.b;
        if (t.role === 'title' || t.role === 'module' || (t.t === 'i' && renamedTo.has(t.v)) || (t.t === 'p' && (t.v === ',' || t.v === ';'))) continue;
        additions = true;
        if (test && t.t === 'i' && CONTROL.has(t.v)) add('unexplained-change', t.line, `"${t.v}" was added to an existing test, which can stop it from checking anything`);
      }
    }
  }

  // One finding per line and kind; a specific finding hides a generic one on the same line.
  const specific = new Set(findings.filter(f => !['expected-literal-changed', 'unexplained-change'].includes(f.kind)).map(f => f.line));
  const seen = new Set();
  const kept = findings.filter(f => {
    if ((f.kind === 'expected-literal-changed' || f.kind === 'unexplained-change') && specific.has(f.line)) return false;
    const id = `${f.kind}:${f.line}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).sort((p, q) => p.line - q.line);
  owner = null;
  // Test cases the change modified: paired tests whose tokens differ, with the kinds of finding in each.
  const cases = regionOps.filter(r => r.test && r.ops.some(o => o.op !== '=')).map(({ pair: [, y] }) => ({
    key: y.key, title: y.title, line: y.line,
    kinds: [...new Set(kept.filter(f => f.key === y.key).map(f => f.kind))],
  }));
  if (kept.length) return { result: 'weakening', findings: kept, cases };
  return { result: additions ? 'additive' : 'neutral', findings: [], cases };
}

// Exposed for the hooks and the pull request review.
// The test cases a change modifies in an existing test file: [{ key, title, line, kinds }], where
// line is the case's line in the new file and kinds are the classifier's findings in it. Empty for
// a file the classifier cannot read.
export function changedTestCases({ file, before, after }) {
  return classifyTestChange({ file, before, after }).cases ?? [];
}

export const _internal = { readJs, readPy };

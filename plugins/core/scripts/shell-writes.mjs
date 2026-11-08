// Which files a shell command writes, moves, or deletes, for guard-commands (TEST-001). Reads the
// command the way a POSIX shell splits it (quotes, operators, redirections, heredocs), then looks
// at what each simple command writes: redirection targets, tee, sed -i and perl -i, mv, cp, rm,
// git rm and git mv, find -delete or -exec, xargs, and, in scripts run by an interpreter (python,
// node, and others, inline or from a heredoc), whole string literals that name a path when the
// script calls a file-writing function. A path that is only run, read, or mentioned in text is not
// a write target. Returns null when the command cannot be read (an unclosed quote, for one), and
// the caller then falls back to a broader check.

const SEPARATORS = new Set(['\n', ';', ';;', '&&', '||', '|', '|&', '&', '(', ')']);
const REDIRECTS = ['&>>', '&>', '<<<', '<<-', '<<', '>>', '>|', '>&', '<&', '<>', '>', '<'];
const WRITE_REDIRECTS = new Set(['>', '>>', '>|', '&>', '&>>', '<>']);
const STOP = new Set([' ', '\t', '\r', '\n', ';', '&', '|', '(', ')', '<', '>']);

function lex(src) {
  const tokens = [];
  const pending = [];
  let i = 0;
  const n = src.length;

  function readWord() {
    let text = '';
    let started = false;
    while (i < n && !STOP.has(src[i])) {
      const c = src[i];
      started = true;
      if (c === "'") {
        const end = src.indexOf("'", i + 1);
        if (end === -1) throw new Error('unclosed quote');
        text += src.slice(i + 1, end);
        i = end + 1;
      } else if (c === '"') {
        i++;
        while (i < n && src[i] !== '"') {
          if (src[i] === '\\' && i + 1 < n && '"\\$`\n'.includes(src[i + 1])) { text += src[i + 1]; i += 2; continue; }
          text += src[i++];
        }
        if (i >= n) throw new Error('unclosed quote');
        i++;
      } else if (c === '\\') {
        if (src[i + 1] === '\n') { i += 2; continue; }
        text += src[i + 1] ?? '';
        i += 2;
      } else if (c === '$' && src[i + 1] === '(') {
        let depth = 0;
        const start = i;
        for (; i < n; i++) {
          if (src[i] === '(') depth++;
          else if (src[i] === ')' && --depth === 0) { i++; break; }
        }
        text += src.slice(start, i);
      } else if (c === '`') {
        const end = src.indexOf('`', i + 1);
        if (end === -1) throw new Error('unclosed backtick');
        text += src.slice(i, end + 1);
        i = end + 1;
      } else {
        text += c;
        i++;
      }
    }
    return started ? text : null;
  }

  function readHeredocs() {
    for (const doc of pending.splice(0)) {
      const lines = [];
      while (i < n) {
        let end = src.indexOf('\n', i);
        if (end === -1) end = n;
        const line = src.slice(i, end);
        i = Math.min(end + 1, n);
        if ((doc.strip ? line.replace(/^\t+/, '') : line) === doc.delim) break;
        lines.push(line);
      }
      doc.body = lines.join('\n');
    }
  }

  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '\n') {
      tokens.push({ t: 'sep', v: '\n' });
      i++;
      readHeredocs();
      continue;
    }
    if (c === '#') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    const redirect = REDIRECTS.find(op => src.startsWith(op, i));
    if (redirect) {
      i += redirect.length;
      while (src[i] === ' ' || src[i] === '\t') i++;
      if (redirect === '<<' || redirect === '<<-') {
        const delim = readWord();
        if (delim === null) throw new Error('heredoc without a delimiter');
        const doc = { t: 'heredoc', delim, strip: redirect === '<<-', body: '' };
        tokens.push(doc);
        pending.push(doc);
      } else {
        tokens.push({ t: 'redir', v: redirect, target: readWord() ?? '' });
      }
      continue;
    }
    const sep = ['&&', '||', '|&', ';;'].find(op => src.startsWith(op, i)) ?? (';&|()'.includes(c) ? c : null);
    if (sep) {
      tokens.push({ t: 'sep', v: sep });
      i += sep.length;
      continue;
    }
    const word = readWord();
    if (word === null) { i++; continue; }
    // A file descriptor written right before a redirection (2>, 1>>) belongs to it.
    if (/^\d+$/.test(word) && (src[i] === '>' || src[i] === '<')) continue;
    tokens.push({ t: 'word', v: word });
  }
  readHeredocs();
  return tokens;
}

// Simple commands: { words, redirects: [{ op, target }], scripts: [heredoc or here-string text] }.
export function parseCommand(command) {
  let tokens;
  try { tokens = lex(command); } catch { return null; }
  const commands = [];
  let current = { words: [], redirects: [], scripts: [] };
  const flush = () => {
    if (current.words.length || current.redirects.length || current.scripts.length) commands.push(current);
    current = { words: [], redirects: [], scripts: [] };
  };
  for (const token of tokens) {
    if (token.t === 'sep') flush();
    else if (token.t === 'word') current.words.push(token.v);
    else if (token.t === 'heredoc') current.scripts.push(token);
    else if (token.v === '<<<') current.scripts.push({ body: token.target });
    else current.redirects.push({ op: token.v, target: token.target });
  }
  flush();
  // Heredoc bodies are read after the command line, so resolve them now.
  for (const cmd of commands) cmd.scripts = cmd.scripts.map(s => s.body ?? '');
  return commands;
}

const PREFIXES = new Set(['sudo', 'command', 'env', 'time', 'nohup', 'exec', 'nice', 'builtin']);
const INTERPRETERS = /^(python[\d.]*|node|nodejs|deno|bun|ruby|perl|php|tsx|ts-node)$/;
const SHELLS = /^(bash|sh|zsh|dash|ksh)$/;
const INLINE_FLAGS = new Set(['-c', '-e', '--eval', '-p', '--print', '-r']);
// File-writing calls in Python, JavaScript, Ruby, and Perl scripts.
const WRITE_API = new RegExp([
  /\bopen\s*\([^,)]*,\s*(?:mode\s*=\s*)?['"][rbt]*[wax][+bt]*['"]/.source,
  /\.open\s*\(\s*['"][rbt]*[wax]/.source,
  /\.write_(?:text|bytes)\s*\(/.source,
  /\.(?:unlink|rename|replace|rmdir)\s*\(/.source,
  /\bos\.(?:remove|unlink|rename|replace|truncate)\s*\(/.source,
  /\bshutil\.\w+\s*\(/.source,
  /\b(?:write|append)File(?:Sync)?\s*\(/.source,
  /\bcreateWriteStream\s*\(/.source,
  /\b(?:unlink|rm|rename|copyFile|truncate|cp)(?:Sync)?\s*\(/.source,
  /\bFile\.(?:write|open|delete)\b/.source,
  /\bopen\s*\(\s*(?:my\s+)?\$?\w+\s*,\s*['"][+>]/.source,
].join('|'));
const LITERAL = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
// Backticks quote strings only in JavaScript; elsewhere they are Markdown in text the script writes.
const LITERAL_NO_BACKTICK = /(['"])((?:\\.|(?!\1)[^\\\n])*)\1/g;
const PATH_LIKE = /^[\w./*?{},@+-]+$/;
const JS_INTERPRETERS = /^(node|nodejs|deno|bun|tsx|ts-node)$/;
const isPath = s => PATH_LIKE.test(s) && /[/.]/.test(s);

// The path literals a script writes to. A path counts when it is a literal on a line that calls a
// file-writing function, or a literal assigned to a variable that such a line uses
// (`p = 'a.test.ts'` ... `open(p, 'w')`). A path that appears only in other text, such as the
// content a script writes into a changelog, is not a target. When a writing line names its file in
// a way this cannot follow (a loop variable, a computed path), every path literal in the script is
// a candidate, which keeps the check on the safe side.
function literalPaths(script, js = false) {
  if (!WRITE_API.test(script)) return [];
  const re = js ? LITERAL : LITERAL_NO_BACKTICK;
  const pathsIn = text => [...text.matchAll(re)].map(m => m[2]).filter(isPath);
  const assigned = new Map();
  for (const m of script.matchAll(/\b([A-Za-z_$][\w$]*)\s*:?=\s*(['"`])([^'"`\n]*)\2/g)) {
    if (isPath(m[3]) && (js || m[2] !== '`')) assigned.set(m[1], [...(assigned.get(m[1]) ?? []), m[3]]);
  }
  const found = [];
  for (const line of script.split('\n')) {
    if (!WRITE_API.test(line)) continue;
    const direct = pathsIn(line);
    const viaVariables = [...line.matchAll(/[A-Za-z_$][\w$]*/g)].flatMap(m => assigned.get(m[0]) ?? []);
    if (!direct.length && !viaVariables.length) return pathsIn(script);
    found.push(...direct, ...viaVariables);
  }
  return [...new Set(found)];
}

const IN_PLACE = /^-[a-zA-Z]*i|^--in-place/;
const operands = words => words.filter(w => !w.startsWith('-'));

// Paths that a command writes, moves, or deletes, as [{ path, op }] where op is 'write', 'move',
// or 'remove'. Pipelines into xargs, and find with -delete or -exec, write files the command line
// does not name; every word of the command is then a candidate, which keeps the check on the safe
// side. Returns null when the command cannot be read.
export function writeTargetEntries(command, depth = 0) {
  const commands = parseCommand(command);
  if (!commands) return null;
  const targets = [];
  const put = (op, paths) => { for (const p of paths) targets.push({ path: p, op }); };
  let broad = null;
  const allWords = commands.flatMap(c => c.words);

  for (const { words: raw, redirects, scripts } of commands) {
    for (const r of redirects) if (WRITE_REDIRECTS.has(r.op) && r.target) put('write', [r.target]);
    let k = 0;
    while (k < raw.length && (PREFIXES.has(raw[k]) || /^\w+=/.test(raw[k]))) k++;
    const words = raw.slice(k);
    if (!words.length) continue;
    const cmd = words[0].split('/').pop();
    const args = words.slice(1);

    if (cmd === 'tee') put('write', operands(args));
    else if ((cmd === 'sed' || cmd === 'perl') && args.some(a => IN_PLACE.test(a))) {
      // The files after the script; the script is the first operand unless -e or -f gave it.
      const files = [];
      let hasScript = false;
      for (let a = 0; a < args.length; a++) {
        if (['-e', '-f', '--expression', '--file'].includes(args[a]) || (cmd === 'perl' && /^-[a-zA-Z]*e$/.test(args[a]))) { hasScript = true; a++; continue; }
        if (!args[a].startsWith('-')) files.push(args[a]);
      }
      put('write', hasScript ? files : files.slice(1));
    } else if (cmd === 'mv') put('move', operands(args));
    else if (['rm', 'unlink', 'truncate', 'shred'].includes(cmd)) put('remove', operands(args));
    else if (['cp', 'install', 'rsync'].includes(cmd)) {
      const t = args.indexOf('-t');
      const ops = operands(args);
      if (t !== -1 && args[t + 1]) put('write', [args[t + 1]]);
      else if (ops.length > 1) put('write', [ops[ops.length - 1]]);
    } else if (cmd === 'dd') put('write', args.filter(a => a.startsWith('of=')).map(a => a.slice(3)));
    else if (cmd === 'git') {
      let s = 0;
      while (s < args.length && args[s].startsWith('-')) s += args[s] === '-C' || args[s] === '-c' ? 2 : 1;
      const sub = args[s];
      if (sub === 'rm') put('remove', operands(args.slice(s + 1)));
      if (sub === 'mv') put('move', operands(args.slice(s + 1)));
      if (sub === 'apply' || sub === 'am') for (const body of scripts) put('write', patchedFiles(body));
    } else if (cmd === 'patch') for (const body of scripts) put('write', patchedFiles(body));
    else if (cmd === 'find') {
      if (args.includes('-delete')) put('remove', args);
      else {
        const x = args.findIndex(a => a === '-exec' || a === '-execdir');
        if (x !== -1 && writes(args.slice(x + 1))) put(opOf(args.slice(x + 1)), args);
      }
    } else if (cmd === 'xargs') {
      const sub = args.findIndex(a => !a.startsWith('-'));
      if (sub !== -1 && writes(args.slice(sub))) broad = opOf(args.slice(sub));
    } else if (SHELLS.test(cmd) && depth < 3) {
      const c = args.indexOf('-c');
      const inner = [...(c !== -1 && args[c + 1] ? [args[c + 1]] : []), ...scripts];
      for (const text of inner) {
        const nested = writeTargetEntries(text, depth + 1);
        if (nested === null) return null;
        targets.push(...nested);
      }
    } else if (INTERPRETERS.test(cmd)) {
      const texts = [...scripts];
      for (let a = 0; a < args.length; a++) if (INLINE_FLAGS.has(args[a]) && args[a + 1] !== undefined) texts.push(args[a + 1]);
      for (const text of texts) put('write', literalPaths(text, JS_INTERPRETERS.test(cmd)));
    }
  }
  if (broad) put(broad, allWords);
  return targets;
}

// Just the paths, for callers that do not care how they change.
export function writeTargets(command) {
  const entries = writeTargetEntries(command);
  return entries === null ? null : entries.map(e => e.path);
}

function opOf(words) {
  const cmd = (words[0] ?? '').split('/').pop();
  if (cmd === 'rm' || cmd === 'unlink' || cmd === 'shred' || (cmd === 'git' && words.includes('rm'))) return 'remove';
  if (cmd === 'mv' || (cmd === 'git' && words.includes('mv'))) return 'move';
  return 'write';
}

// Whether the words of a command (as after find -exec or xargs) start a command that writes files.
function writes(words) {
  const cmd = (words[0] ?? '').split('/').pop();
  if (['rm', 'mv', 'cp', 'tee', 'truncate', 'shred', 'unlink', 'dd'].includes(cmd)) return true;
  if (cmd === 'sed' || cmd === 'perl') return words.some(w => IN_PLACE.test(w));
  if (cmd === 'git') return words.includes('rm') || words.includes('mv');
  return SHELLS.test(cmd) || INTERPRETERS.test(cmd);
}

function patchedFiles(body) {
  return [...body.matchAll(/^(?:\+\+\+|---) (?:[ab]\/)?(\S+)/gm)].map(m => m[1]).filter(f => f !== '/dev/null');
}

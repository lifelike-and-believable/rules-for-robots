#!/usr/bin/env node
// Guard replay (docs/specs/guard-tiers.md, AC-8). Replays recorded tool calls through two versions of
// the rfr guard hooks and counts how often each asks, refuses, or allows with context.
//
//   node checks/guard-replay.mjs extract <transcript.jsonl>... --root <project path> --out <calls.jsonl>
//     Reads Claude Code session transcripts (a session's .jsonl and its subagents' files) and writes
//     the tool calls the guards see (Bash, PowerShell, Edit, Write, MultiEdit, NotebookEdit, Vercel
//     MCP), anonymised: the project path becomes $REPO, the home folder $HOME, the temp folder
//     $TMP, and email addresses and session links are replaced.
//
//   node checks/guard-replay.mjs run <calls.jsonl>... --base <commit> [--baseline <commit>] [--specs <commit>] [--repo <path>] [--out <dir>] [--limit <n>]
//     Clones the repository (default: this one) at <commit>, once clean and once with an
//     uncommitted change and an untracked file, and sends every call through the PreToolUse hooks
//     of the baseline plugins (rfr-core at --baseline, default rfr-core 3.1.1) and of the plugins
//     in this checkout (rfr-core, rfr-web, rfr-unreal). Hooks only decide; no call is executed, so
//     edits and writes are applied to the clone in order. --specs takes docs/specs/ from a later
//     commit, for spec changes the session made through the shell. Writes summary.json and report.md
//     to --out, or prints the summary.
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
// rfr-core 3.1.1 (#144): the guards before the tier changes, the baseline AC-8 names.
export const BASELINE = '27b849a6fedc6e6e0f29cacd012cbf1b5d0d7ffa';
export const GUARDED = /^(Bash|PowerShell|Edit|Write|MultiEdit|NotebookEdit)$|^mcp__.*[Vv]ercel/;
const KEEP = {
  Bash: ['command'],
  PowerShell: ['command'],
  Edit: ['file_path', 'old_string', 'new_string', 'replace_all'],
  MultiEdit: ['file_path', 'edits'],
  Write: ['file_path', 'content'],
  NotebookEdit: ['notebook_path', 'new_source', 'cell_id', 'cell_type', 'edit_mode'],
};

// --- extract ---------------------------------------------------------------------------------

// The ways a session writes a folder. On Windows, a drive path appears as C:\x, C:/x, and Git
// Bash's /c/x; a path that already starts with / (from a POSIX transcript) is kept as it is.
export function pathForms(p, platform = process.platform) {
  if (!p) return [];
  if (platform !== 'win32') return [path.posix.resolve(p)];
  if (/^[\\/]/.test(p) && !/^[\\/]{2}/.test(p)) return [p.replace(/\\/g, '/')];
  const native = path.win32.resolve(p);
  const forward = native.replace(/\\/g, '/');
  return [native, forward, forward.replace(/^([A-Za-z]):/, (m, d) => `/${d.toLowerCase()}`)];
}

export function anonymiser(root, { home = os.homedir(), tmp = os.tmpdir(), platform = process.platform } = {}) {
  const swaps = [
    ...pathForms(root, platform).map(p => [p, '$REPO']),
    ...pathForms(tmp, platform).map(p => [p, '$TMP']),
    ['/tmp', '$TMP'],
    ...pathForms(home, platform).map(p => [p, '$HOME']),
  ].filter(([from]) => from && from !== '/');
  // Longest first, so the project path wins over the home folder that contains it.
  swaps.sort((a, b) => b[0].length - a[0].length);
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(swaps.map(([from]) => `${escape(from)}(?=$|[/\\\\\\s'"\`;:,)\\]}])`).join('|'), 'g');
  const to = new Map(swaps);
  const text = s => s
    .replace(pattern, m => to.get(m))
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, m => (/@(example\.(com|org)|anthropic\.com|users\.noreply\.github\.com)$/.test(m) ? m : 'user@example.com'))
    .replace(/session_[A-Za-z0-9]{8,}/g, 'session_REDACTED')
    .replace(/\b(gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9-]{20,}|xox[abpr]-[A-Za-z0-9-]{10,})\b/g, 'REDACTED_TOKEN');
  const value = v => (typeof v === 'string' ? text(v) : Array.isArray(v) ? v.map(value) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, value(x)])) : v);
  return value;
}

export function extractCalls(files, root) {
  const anon = anonymiser(root);
  const calls = [];
  for (const file of files) {
    const agent = path.basename(file).startsWith('agent-') ? 'subagent' : 'main';
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let e;
      try {
        e = JSON.parse(line);
      } catch {
        continue;
      }
      const content = e?.message?.content;
      if (e?.type !== 'assistant' || !Array.isArray(content)) continue;
      for (const block of content) {
        if (block?.type !== 'tool_use' || !GUARDED.test(block.name ?? '')) continue;
        const keep = KEEP[block.name];
        const input = keep ? Object.fromEntries(keep.filter(k => block.input?.[k] !== undefined).map(k => [k, block.input[k]])) : block.input ?? {};
        calls.push({ time: e.timestamp ?? null, agent, cwd: anon(e.cwd ?? root), tool_name: block.name, tool_input: anon(input) });
      }
    }
  }
  calls.sort((a, b) => String(a.time).localeCompare(String(b.time)));
  return calls.map((c, i) => ({ i, ...c }));
}

// --- run -------------------------------------------------------------------------------------

const git = (cwd, args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

// The PreToolUse hooks of each plugin folder: [{ matcher, script, root }].
export function hooksOf(pluginDirs) {
  const hooks = [];
  for (const dir of pluginDirs) {
    const file = path.join(dir, 'hooks', 'hooks.json');
    if (!fs.existsSync(file)) continue;
    for (const entry of JSON.parse(fs.readFileSync(file, 'utf8')).hooks?.PreToolUse ?? []) {
      for (const h of entry.hooks ?? []) {
        const m = /node "\$\{CLAUDE_PLUGIN_ROOT\}\/([^"]+)"/.exec(h.command ?? '');
        if (m) hooks.push({ matcher: new RegExp(`^(?:${entry.matcher})$`), script: path.join(dir, m[1]), root: dir });
      }
    }
  }
  return hooks;
}

// The plugins as they were at a commit, unpacked into a folder.
function pluginsAt(commit, repo, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const archive = spawnSync('git', ['archive', '--format=tar', commit, 'plugins'], { cwd: repo, maxBuffer: 1 << 28 });
  if (archive.status !== 0) throw new Error(`git archive ${commit}: ${archive.stderr}`);
  // tar runs in the destination: GNU tar reads a C: path given to -C as a remote host.
  const untar = spawnSync('tar', ['-x'], { cwd: dest, input: archive.stdout });
  if (untar.status !== 0) throw new Error(`tar: ${untar.stderr}`);
  return fs.readdirSync(path.join(dest, 'plugins')).map(p => path.join(dest, 'plugins', p));
}

// A clone of repo at base, with origin/main at base too, so a file that existed at base is an
// existing file to the guards. 'dirty' adds an uncommitted change and an untracked file.
//
// specs: a later commit whose docs/specs/ replace the clone's. A session records spec changes, such
// as an unlocks entry for a test it then edits, through shell commands the replay does not run; the
// specs as they stood when the session's work merged stand in for them, in both arms.
export function fixture(repo, base, state, dir, { specs } = {}) {
  git(os.tmpdir(), ['clone', '-q', '--no-checkout', '--no-hardlinks', repo, dir]);
  git(dir, ['checkout', '-q', '--detach', base]);
  git(dir, ['update-ref', 'refs/remotes/origin/main', base]);
  git(dir, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main']);
  if (specs) {
    fs.rmSync(path.join(dir, 'docs', 'specs'), { recursive: true, force: true });
    const archive = spawnSync('git', ['archive', '--format=tar', specs, 'docs/specs'], { cwd: repo, maxBuffer: 1 << 26 });
    if (archive.status !== 0) throw new Error(`git archive ${specs}: ${archive.stderr}`);
    spawnSync('tar', ['-x'], { cwd: dir, input: archive.stdout });
    git(dir, ['add', '--', 'docs/specs']);
    git(dir, ['-c', 'user.name=replay', '-c', 'user.email=replay@example.com', 'commit', '-q', '--allow-empty', '-m', 'replay: specs']);
    git(dir, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  }
  if (state === 'dirty') {
    const tracked = git(dir, ['ls-files', '--', 'README.md']) || git(dir, ['ls-files']).split('\n').find(f => !/test|spec/i.test(f));
    fs.appendFileSync(path.join(dir, tracked), '\nreplay: an uncommitted change\n');
    fs.writeFileSync(path.join(dir, 'replay-notes.txt'), 'replay: an untracked file\n');
  }
  return dir;
}

const fill = (v, map) => (typeof v === 'string' ? v.replace(/\$(REPO|TMP|HOME)\b/g, (_, k) => map[k]) : Array.isArray(v) ? v.map(x => fill(x, map)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x, map)])) : v);

function runHook(hook, input, env) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [hook.script], { env: { ...env, CLAUDE_PLUGIN_ROOT: hook.root }, stdio: ['pipe', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.on('close', () => {
      let o = null;
      try {
        o = out.trim() ? JSON.parse(out).hookSpecificOutput : null;
      } catch {
        o = null;
      }
      // A refusal that sends the agent to ask the person in chat is the person's decision, as an ask
      // was before default-allow AC-10: it counts as an ask.
      if (o?.permissionDecision === 'deny' && /needs the person's decision|is the person's review/.test(o.permissionDecisionReason ?? '')) resolve({ decision: 'ask', reason: o.permissionDecisionReason });
      else if (o?.permissionDecision === 'ask' || o?.permissionDecision === 'deny') resolve({ decision: o.permissionDecision, reason: o.permissionDecisionReason ?? '' });
      else if (o?.additionalContext) resolve({ decision: 'inform', reason: o.additionalContext });
      else resolve({ decision: 'allow', reason: '' });
    });
    child.stdin.end(JSON.stringify(input));
  });
}

const RANK = { deny: 3, ask: 2, inform: 1, allow: 0 };
// One character per call in summary.json: . allowed, i allowed with context, ? asked, x refused.
export const CODE = { allow: '.', inform: 'i', ask: '?', deny: 'x' };

// Applies an edit or write to the clone after its decision, so later edits find the text they
// change. Shell commands are not run. Returns false when the edit no longer applies.
export function applyEdit(c, input) {
  const file = input.tool_input.file_path;
  if (typeof file !== 'string') return false;
  const abs = path.resolve(input.cwd, file);
  try {
    if (c.tool_name === 'Write') {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, input.tool_input.content ?? '');
      return true;
    }
    let text = fs.readFileSync(abs, 'utf8');
    const edits = c.tool_name === 'MultiEdit' ? input.tool_input.edits ?? [] : [input.tool_input];
    for (const e of edits) {
      if (typeof e.old_string !== 'string' || !text.includes(e.old_string)) return false;
      text = e.replace_all ? text.split(e.old_string).join(e.new_string) : text.replace(e.old_string, () => e.new_string);
    }
    fs.writeFileSync(abs, text);
    return true;
  } catch {
    return false;
  }
}

// Every call through every matching hook, in order; the call's decision is the strongest (deny over
// ask over inform), as Claude Code combines them. Edits and writes inside the clone are then applied
// unless refused, so the files change as they did in the session.
async function replayCalls(calls, hooks, map, env, { keepSpecs = false } = {}) {
  const results = new Array(calls.length);
  {
    for (let k = 0; k < calls.length; k++) {
      const c = calls[k];
      const input = { session_id: 'replay', tool_use_id: `replay-${c.i}`, hook_event_name: 'PreToolUse', tool_name: c.tool_name, tool_input: fill(c.tool_input, map), cwd: fill(c.cwd, map) };
      if (!fs.existsSync(input.cwd)) input.cwd = map.REPO;
      let best = { decision: 'allow', reason: '' };
      for (const hook of hooks.filter(h => h.matcher.test(c.tool_name))) {
        const r = await runHook(hook, input, env);
        if (RANK[r.decision] > RANK[best.decision]) best = r;
      }
      results[k] = { i: c.i, tool: c.tool_name, ...best };
      if (best.decision !== 'deny' && ['Edit', 'MultiEdit', 'Write'].includes(c.tool_name)) {
        const abs = path.resolve(input.cwd, input.tool_input.file_path ?? '');
        // With specs from a later commit, the session's own edits to them would put back older text.
        const spec = abs.startsWith(path.join(map.REPO, 'docs', 'specs') + path.sep);
        if (abs.startsWith(map.REPO + path.sep) && !(keepSpecs && spec)) applyEdit(c, input);
      }
    }
  }
  return results;
}

// The first words of a reason, without paths or line numbers, to group decisions.
export const reasonKey = r => r.replace(/\s+/g, ' ').replace(/(\$REPO|\/)[^\s:]*\//g, '…/').replace(/\b(line \d+|[0-9a-f]{7,40})\b/g, '#').slice(0, 110).trim();

function tally(results) {
  const counts = { ask: 0, deny: 0, inform: 0, allow: 0 };
  const reasons = {};
  for (const r of results) {
    counts[r.decision]++;
    if (r.decision === 'allow') continue;
    const key = `${r.decision}: ${reasonKey(r.reason)}`;
    reasons[key] = (reasons[key] ?? 0) + 1;
  }
  return { ...counts, reasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([reason, n]) => ({ reason, n })) };
}

export async function replay(calls, { repo = ROOT, base, baseline = BASELINE, states = ['clean', 'dirty'], current = ROOT, specs } = {}) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-replay-'));
  try {
    const tiered = hooksOf(['core', 'web', 'unreal'].map(p => path.join(current, 'plugins', p)));
    // tiered-defer: the tiered guards with testWeakening set to defer (guard tiers AC-5).
    const versions = { baseline: hooksOf(pluginsAt(baseline, ROOT, path.join(work, 'baseline'))), tiered, 'tiered-defer': tiered };
    const out = { calls: calls.length, base, baseline, specs: specs ?? null, states: {} };
    const arms = [];
    for (const state of states) {
      out.states[state] = {};
      for (const [name, hooks] of Object.entries(versions)) arms.push({ state, name, hooks });
    }
    await Promise.all(arms.map(async ({ state, name, hooks }) => {
      {
        const dir = fixture(repo, base, state, path.join(work, `${state}-${name}`, 'repo'), { specs });
        if (name === 'tiered-defer') {
          fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
          fs.writeFileSync(path.join(dir, '.claude', 'rfr.json'), '{ "testWeakening": "defer" }\n');
        }
        const tmp = fs.mkdtempSync(path.join(work, 'tmp-'));
        const home = fs.mkdtempSync(path.join(work, 'home-'));
        const data = fs.mkdtempSync(path.join(work, 'data-'));
        const map = { REPO: dir, TMP: tmp, HOME: home };
        const env = { ...process.env, CLAUDE_PROJECT_DIR: dir, CLAUDE_PLUGIN_DATA: data, RFR_GUARD_LOG: '0' };
        const results = await replayCalls(calls, hooks, map, env, { keepSpecs: Boolean(specs) });
        out.states[state][name] = { ...tally(results), decisions: results.map(r => CODE[r.decision]).join('') };
      }
    }));
    for (const state of states) {
      const s = out.states[state];
      s.reduction = s.baseline.ask ? 1 - s.tiered.ask / s.baseline.ask : null;
      s.reductionDefer = s.baseline.ask ? 1 - s['tiered-defer'].ask / s.baseline.ask : null;
    }
    return out;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

export const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const pct = x => (x === null ? 'n/a' : `${Math.round(x * 100)}%`);

export function formatReport(summary) {
  const lines = ['# Guard replay', '', `${summary.calls} recorded tool calls from ${summary.sources.map(s => `\`${s.file}\``).join(', ')}, replayed on a clone of this repository at \`${summary.base.slice(0, 7)}\`. Baseline: rfr-core 3.1.1 (\`${summary.baseline.slice(0, 7)}\`). Tiered: rfr-core ${summary.version} with rfr-web and rfr-unreal. Edits and writes are applied to the clone in order; shell commands are not run.${summary.specs ? ` The clone's \`docs/specs/\` come from \`${summary.specs.slice(0, 7)}\`, so spec changes the session made through the shell (such as \`unlocks\` entries) are in place for both versions.` : ''}`, ''];
  lines.push('| State | Version | Asks | Refusals | Allowed with context | Allowed |', '|---|---|---|---|---|---|');
  for (const [state, s] of Object.entries(summary.states)) {
    for (const v of ['baseline', 'tiered', 'tiered-defer']) lines.push(`| ${state} | ${v} | ${s[v].ask} | ${s[v].deny} | ${s[v].inform} | ${s[v].allow} |`);
  }
  lines.push('');
  for (const [state, s] of Object.entries(summary.states)) lines.push(`- ${state}: asks fall by ${pct(s.reduction)} with the default setting (${s.baseline.ask} to ${s.tiered.ask}), and by ${pct(s.reductionDefer)} with \`testWeakening: defer\` (${s.baseline.ask} to ${s['tiered-defer'].ask}).`);
  for (const [state, s] of Object.entries(summary.states)) {
    for (const v of ['baseline', 'tiered', 'tiered-defer']) {
      lines.push('', `## ${state}, ${v}: decisions by reason`, '');
      if (!s[v].reasons.length) lines.push('None.');
      for (const r of s[v].reasons) lines.push(`- ${r.n} × ${r.reason}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const opts = { files: [] };
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k];
    if (a.startsWith('--')) opts[a.slice(2)] = argv[++k];
    else opts.files.push(a);
  }
  return opts;
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  const opts = parseArgs(rest);
  if (cmd === 'extract' && opts.files.length && opts.root && opts.out) {
    const calls = extractCalls(opts.files, opts.root);
    fs.mkdirSync(path.dirname(opts.out), { recursive: true });
    fs.writeFileSync(opts.out, calls.map(c => JSON.stringify(c)).join('\n') + '\n');
    console.log(`${calls.length} calls written to ${opts.out}`);
    return;
  }
  if (cmd === 'run' && opts.files.length && opts.base) {
    let calls = opts.files.flatMap(f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)));
    if (opts.limit) calls = calls.slice(0, Number(opts.limit));
    const result = await replay(calls, { repo: opts.repo ? path.resolve(opts.repo) : ROOT, base: git(opts.repo ?? ROOT, ['rev-parse', opts.base]), baseline: opts.baseline ?? BASELINE, specs: opts.specs ? git(opts.repo ?? ROOT, ['rev-parse', opts.specs]) : undefined });
    const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'plugins/core/.claude-plugin/plugin.json'), 'utf8')).version;
    const summary = { version, sources: opts.files.map(f => ({ file: path.relative(ROOT, path.resolve(f)).split(path.sep).join('/'), sha256: sha256(f) })), ...result };
    if (opts.out) {
      fs.mkdirSync(opts.out, { recursive: true });
      fs.writeFileSync(path.join(opts.out, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
      fs.writeFileSync(path.join(opts.out, 'report.md'), formatReport(summary));
      console.log(`Wrote ${path.join(opts.out, 'report.md')}`);
    }
    for (const [state, s] of Object.entries(summary.states)) console.log(`${state}: asks ${s.baseline.ask} -> ${s.tiered.ask} (${pct(s.reduction)} fewer), ${s['tiered-defer'].ask} with defer (${pct(s.reductionDefer)} fewer); refusals ${s.baseline.deny} -> ${s.tiered.deny} (${s['tiered-defer'].deny} with defer); allowed with context ${s.tiered.inform}`);
    return;
  }
  console.error('Usage: guard-replay.mjs extract <transcript.jsonl>... --root <path> --out <calls.jsonl>\n       guard-replay.mjs run <calls.jsonl>... --base <commit> [--baseline <commit>] [--specs <commit>] [--repo <path>] [--out <dir>] [--limit <n>]');
  process.exit(2);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));

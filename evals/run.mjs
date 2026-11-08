#!/usr/bin/env node
// Rule-set eval harness (Phase 2 seed; R35 to R39).
//
// For each case, model, arm, and run: copy the case fixture to a temp repo, add the
// arm's rules and hooks, run headless Claude Code on the case prompt, then grade the
// resulting repo and transcript with the case's deterministic grader.
//
// Arms:
//   none        fixture only
//   rules       fixture + core rules in .claude/rules/
//   rules+hooks rules + the rfr-core plugin (hooks), and any plugins the case names, via --plugin-dir
//   rules+agents  rules + the rfr-core plugin, and each prompt starts by naming the case's
//               `agent` (case.json), so the main session delegates to it; compare with `rules`
//               to see what the agent adds. Not in the default arms, pass it with --arms
//   rules+candidate  rules + the case's draft rules from evals/candidates/ (meta.candidates);
//               a candidate with `replaces: <ID>` in its frontmatter removes that core rule;
//               not in the default arms, pass it with --arms
//
// A case's bin/ folder, if present, goes first on PATH (for fake CLIs such as gh). It stays
// outside the workspace so the agent sees the commands, not their source.
//
// A suite (evals/suites/<name>.json, docs/specs/model-adaptation.md) fixes the cases, arms,
// and runs for a recurring round such as the model-release run; --cases narrows it.
// --max-cost stops starting runs once the finished runs have cost that much; runs already
// started finish, so the total can pass the cap by up to --concurrency runs.
//
// Each run record has the model the session reported and the Claude Code version, read
// from the stream's init event, so an alias or a fallback shows in the results.
//
// Usage:
//   node evals/run.mjs [--cases a,b] [--models claude-sonnet-5-5,claude-opus-5-5]
//                      [--arms none,rules,rules+hooks] [--runs 3] [--concurrency 4]
//                      [--effort medium] [--out evals/results/<stamp>]
//                      [--suite model-release] [--max-cost 40]
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASES = path.join(ROOT, 'evals', 'cases');
const CANDIDATES = path.join(ROOT, 'evals', 'candidates');
const SUITES = path.join(ROOT, 'evals', 'suites');
const ALL_ARMS = ['none', 'rules', 'rules+hooks'];
export const KNOWN_ARMS = [...ALL_ARMS, 'rules+agents', 'rules+candidate'];

export function parseArgs(argv) {
  const opts = { runs: 3, runsGiven: false, concurrency: 4, models: ['claude-sonnet-5-5', 'claude-opus-5-5'], arms: ALL_ARMS, effort: null, cases: null, suite: null, maxCost: null };
  for (let i = 0; i < argv.length; i++) {
    const [key, value] = [argv[i], argv[i + 1]];
    if (key === '--runs') opts.runs = Number(value), opts.runsGiven = true, i++;
    else if (key === '--suite') opts.suite = value, i++;
    else if (key === '--max-cost') opts.maxCost = Number(value), i++;
    else if (key === '--concurrency') opts.concurrency = Number(value), i++;
    else if (key === '--models') opts.models = value.split(','), i++;
    else if (key === '--arms') opts.arms = value.split(','), i++;
    else if (key === '--cases') opts.cases = value.split(','), i++;
    else if (key === '--effort') opts.effort = value, i++;
    else if (key === '--out') opts.out = value, i++;
  }
  return opts;
}

// A case has prompt.md (one prompt) or prompts/*.md (several prompts sent in file order in
// one session, each after the previous turn's result, for long-session cases). A
// prompts/<name>.before.mjs file runs in the workspace just before prompt <name>.md is
// sent, to change the repository between turns. case.json `newSessionAt` lists 1-based
// prompt numbers that start a fresh session in the same workspace.
export function loadCase(dir) {
  const promptsDir = path.join(dir, 'prompts');
  const prompts = [];
  const before = {};
  if (fs.existsSync(promptsDir)) {
    const files = fs.readdirSync(promptsDir);
    for (const f of files.filter(f => f.endsWith('.md')).sort()) {
      const hook = path.join(promptsDir, f.replace(/\.md$/, '.before.mjs'));
      if (fs.existsSync(hook)) before[prompts.length] = async workspace => (await import(pathToFileURL(hook))).default(workspace);
      prompts.push(fs.readFileSync(path.join(promptsDir, f), 'utf8'));
    }
  } else {
    prompts.push(fs.readFileSync(path.join(dir, 'prompt.md'), 'utf8'));
  }
  return { name: path.basename(dir), dir, meta: JSON.parse(fs.readFileSync(path.join(dir, 'case.json'), 'utf8')), prompts, before };
}

// Groups prompt indexes into sessions; newSessionAt holds 1-based prompt numbers.
export function splitSessions(prompts, newSessionAt = []) {
  const groups = [[]];
  prompts.forEach((_, i) => {
    if (i > 0 && newSessionAt.includes(i + 1)) groups.push([]);
    groups.at(-1).push(i);
  });
  return groups;
}

// Cost is cumulative within a session, so add the last result of each session.
export function sessionCost(events) {
  let total = 0;
  let last = null;
  for (const e of events) {
    if (e.type === 'result') last = e.total_cost_usd ?? 0;
    if (e.type === 'rfr_session_break') { total += last ?? 0; last = null; }
  }
  return total + (last ?? 0);
}

// One entry per turn (result event): its final text, the tool calls made during it, and
// the session it belongs to.
export function turnsOf(events) {
  const turns = [];
  let tools = [];
  let session = 0;
  for (const e of events) {
    if (e.type === 'rfr_session_break') { session++; continue; }
    if (e.type === 'assistant') {
      for (const block of e.message?.content ?? []) if (block.type === 'tool_use') tools.push({ name: block.name, input: block.input });
    }
    if (e.type === 'result') { turns.push({ text: e.result ?? '', tools, session }); tools = []; }
  }
  return turns;
}

export function loadCases(filter) {
  return fs.readdirSync(CASES, { withFileTypes: true })
    .filter(e => e.isDirectory() && (!filter || filter.includes(e.name)))
    .map(e => loadCase(path.join(CASES, e.name)));
}

// A suite file: { description, runs, maxCostUsd, entries: [{ case, arms, reason }] }.
// Returns the problems found, so a test can check every suite in the repository.
export function suiteProblems(suite, caseNames) {
  const problems = [];
  if (!Array.isArray(suite?.entries) || !suite.entries.length) return ['entries must be a non-empty list'];
  if (suite.runs !== undefined && !(Number.isInteger(suite.runs) && suite.runs > 0)) problems.push('runs must be a positive whole number');
  if (suite.maxCostUsd !== undefined && !(typeof suite.maxCostUsd === 'number' && suite.maxCostUsd > 0)) problems.push('maxCostUsd must be a positive number');
  const seen = new Set();
  for (const [i, e] of suite.entries.entries()) {
    const at = `entry ${i + 1}${e?.case ? ` (${e.case})` : ''}`;
    if (!e?.case || !caseNames.includes(e.case)) problems.push(`${at}: no case named "${e?.case ?? ''}" in evals/cases/`);
    if (seen.has(e?.case)) problems.push(`${at}: listed twice`);
    seen.add(e?.case);
    if (!Array.isArray(e?.arms) || !e.arms.length) problems.push(`${at}: arms must be a non-empty list`);
    else for (const a of e.arms) if (!KNOWN_ARMS.includes(a)) problems.push(`${at}: unknown arm "${a}"`);
    if (typeof e?.reason !== 'string' || !e.reason.trim()) problems.push(`${at}: needs a reason`);
  }
  return problems;
}

export function loadSuite(name, dir = SUITES) {
  const suite = JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8'));
  return { name, ...suite };
}

// The jobs for one invocation. With a suite, its entries give the cases and arms (narrowed by
// --cases), and its runs apply unless --runs was given; otherwise every case runs every arm.
export function planJobs(cases, opts, suite = null) {
  const jobs = [];
  if (suite) {
    const runs = opts.runsGiven ? opts.runs : (suite.runs ?? opts.runs);
    const byName = new Map(cases.map(c => [c.name, c]));
    for (const entry of suite.entries) {
      if (opts.cases && !opts.cases.includes(entry.case)) continue;
      const testCase = byName.get(entry.case);
      if (!testCase) throw new Error(`suite ${suite.name}: no case named ${entry.case}`);
      for (const model of opts.models) for (const arm of entry.arms) {
        for (let run = 1; run <= runs; run++) jobs.push({ testCase, model, arm, run });
      }
    }
    return jobs;
  }
  for (const testCase of cases) for (const model of opts.models) for (const arm of opts.arms) {
    for (let run = 1; run <= opts.runs; run++) jobs.push({ testCase, model, arm, run });
  }
  return jobs;
}

// What the session said about itself: the model from the first init event (an alias such as
// "opus" is reported as the ID it resolved to), else the model with the largest cost in the
// last result's usage, and the Claude Code version from the init event.
export function reportedRun(events) {
  const init = events.find(e => e.type === 'system' && e.subtype === 'init');
  let model = init?.model ?? null;
  if (!model) {
    const usage = [...events].reverse().find(e => e.type === 'result' && e.modelUsage)?.modelUsage ?? {};
    model = Object.entries(usage).sort((a, b) => (b[1]?.costUSD ?? 0) - (a[1]?.costUSD ?? 0))[0]?.[0] ?? null;
  }
  return { reportedModel: model, claudeCode: init?.claude_code_version ?? null };
}

function parseEvents(text) {
  return text.split('\n').filter(Boolean).flatMap(line => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

// Runs one session with streamed input: sends each prompt as a user message once the
// previous turn's result event arrives, then closes stdin.
export function runSession({ cwd, command, args, prompts, timeoutMs, env = process.env, before, offset = 0 }) {
  return new Promise(resolve => {
    const started = Date.now();
    const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], env });
    let stdout = '';
    let stderr = '';
    let pending = '';
    let next = 0;
    const send = async () => {
      if (next >= prompts.length) return child.stdin.end();
      const i = next++;
      try { await before?.(i + offset); } catch (err) { stderr += `before hook for prompt ${i + offset + 1} failed: ${err}\n`; }
      child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: prompts[i] } }) + '\n');
    };
    child.stdout.on('data', d => {
      stdout += d;
      pending += d;
      let i;
      while ((i = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, i);
        pending = pending.slice(i + 1);
        try { if (JSON.parse(line).type === 'result') send(); } catch {}
      }
    });
    child.stderr.on('data', d => { stderr += d; });
    child.stdin.on('error', () => {});
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ code, events: parseEvents(stdout), stderr, seconds: (Date.now() - started) / 1000 });
    });
    send();
  });
}

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

// Build the workspace: fixture plus the arm's rules committed as the starting point,
// then the case's setup.mjs (if any) for uncommitted state.
export async function prepareWorkspace(testCase, arm) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `rfr-eval-${testCase.name}-`));
  // A case can start from a shared base kept elsewhere ("fixtureFrom" in case.json, a path from the
  // repository root, such as a profile's template repo). The case's own fixture/ folder, if it has one,
  // is laid over the base.
  if (testCase.meta.fixtureFrom) fs.cpSync(path.join(ROOT, testCase.meta.fixtureFrom), dir, { recursive: true });
  const own = path.join(testCase.dir, 'fixture');
  if (fs.existsSync(own)) fs.cpSync(own, dir, { recursive: true });
  // Rules are part of the committed starting state, so graders that inspect
  // `git status` see only the agent's changes.
  if (arm !== 'none') {
    fs.cpSync(path.join(ROOT, 'rules', 'core'), path.join(dir, '.claude', 'rules', 'core'), { recursive: true });
    for (const pack of testCase.meta.packs ?? []) {
      fs.cpSync(path.join(ROOT, 'rules', 'packs', pack), path.join(dir, '.claude', 'rules', 'packs', pack), { recursive: true });
    }
  }
  if (arm === 'rules+candidate') {
    for (const id of testCase.meta.candidates ?? []) {
      fs.mkdirSync(path.join(dir, '.claude', 'rules', 'candidates'), { recursive: true });
      const file = path.join(CANDIDATES, `${id}.md`);
      fs.copyFileSync(file, path.join(dir, '.claude', 'rules', 'candidates', `${id}.md`));
      // A candidate that rewrites a core rule names it in `replaces:`; drop the core
      // version so the agent sees only one.
      const replaces = /^replaces:\s*(\S+)\s*$/m.exec(fs.readFileSync(file, 'utf8').split(/^---\s*$/m)[1] ?? '')?.[1];
      if (replaces) {
        for (const f of fs.readdirSync(path.join(dir, '.claude', 'rules', 'core'), { recursive: true })) {
          if (path.basename(f).startsWith(`${replaces}-`)) fs.rmSync(path.join(dir, '.claude', 'rules', 'core', f));
        }
      }
    }
  }
  // Cases can share an installed node_modules instead of installing per run. Hard-link
  // it (a symlink out of the project root makes Turbopack fail); copy if that fails.
  if (testCase.meta.nodeModulesFrom) {
    const from = path.join(path.resolve(ROOT, testCase.meta.nodeModulesFrom), 'node_modules');
    const to = path.join(dir, 'node_modules');
    if (spawnSync('cp', ['-al', from, to]).status !== 0) {
      fs.rmSync(to, { recursive: true, force: true });
      fs.cpSync(from, to, { recursive: true, verbatimSymlinks: true });
    }
  }
  git(dir, 'init', '-q', '-b', 'main');
  fs.appendFileSync(path.join(dir, '.git', 'info', 'exclude'), 'node_modules\n.next\n');
  git(dir, '-c', 'user.email=eval@example.com', '-c', 'user.name=eval', 'add', '-A');
  git(dir, '-c', 'user.email=eval@example.com', '-c', 'user.name=eval', 'commit', '-q', '-m', 'Initial state');
  const setup = path.join(testCase.dir, 'setup.mjs');
  if (fs.existsSync(setup)) await (await import(pathToFileURL(setup))).default(dir);
  return dir;
}

// The prompts an arm sends. In the arms that load the plugin, a case that names a `skill` starts
// each prompt with that skill's slash command; in rules+agents a case that names an `agent` asks
// the main session to use it. Every other arm sends the case's prompts unchanged.
export function armPrompts(arm, meta, prompts) {
  const plugin = arm === 'rules+hooks' || arm === 'rules+agents';
  if (plugin && meta.skill) return prompts.map(p => `/rfr-core:${meta.skill} ${p}`);
  if (arm !== 'rules+agents' || !meta.agent) return prompts;
  return prompts.map(p => `Use the ${meta.agent} agent for this.\n\n${p}`);
}

// The plugin arms load every plugin a case names in `plugins` (default rfr-core), so a case whose
// agent lives in a domain plugin loads it too (docs/specs/plugin-split.md, AC-8). RFR_PLUGIN_DIR
// points rfr-core at another copy of plugins/core (a worktree of an earlier commit, to compare prompts).
const PLUGIN_FOLDERS = { 'rfr-core': 'core', 'rfr-web': 'web', 'rfr-unreal': 'unreal', 'rfr-process': 'process', 'rfr-feedback': 'feedback' };

export function pluginArgs(meta, env = process.env) {
  return (meta?.plugins ?? ['rfr-core']).flatMap(name => {
    const folder = PLUGIN_FOLDERS[name];
    if (!folder) throw new Error(`unknown plugin ${name} (known: ${Object.keys(PLUGIN_FOLDERS).join(', ')})`);
    return ['--plugin-dir', name === 'rfr-core' && env.RFR_PLUGIN_DIR ? env.RFR_PLUGIN_DIR : path.join(ROOT, 'plugins', folder)];
  });
}

export function claudeEnv(testCase, base = process.env, hasBin = fs.existsSync(path.join(testCase.dir, 'bin'))) {
  if (!hasBin) return { ...base };
  return { ...base, PATH: [path.join(testCase.dir, 'bin'), base.PATH].filter(Boolean).join(path.delimiter) };
}

function runClaude({ dir, prompts: casePrompts, model, arm, meta, effort, testCase }) {
  const prompts = armPrompts(arm, meta, casePrompts);
  const multi = prompts.length > 1;
  const args = [
    '-p', ...(multi ? ['--input-format', 'stream-json'] : [prompts[0]]),
    '--model', model,
    '--output-format', 'stream-json', '--verbose',
    '--setting-sources', 'project,local',
    '--no-session-persistence',
    '--max-turns', String(meta.maxTurns ?? 40),
    '--allowedTools', [...(meta.allowedTools ?? ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep']), ...(arm === 'rules+agents' ? ['Agent', 'Task'] : [])].join(','),
  ];
  if (effort) args.push('--effort', effort);
  if (arm === 'rules+hooks' || arm === 'rules+agents') args.push(...pluginArgs(meta));
  if (multi) {
    return (async () => {
      const merged = { code: 0, events: [], stderr: '', seconds: 0 };
      for (const [n, group] of splitSessions(prompts, meta.newSessionAt).entries()) {
        if (n > 0) merged.events.push({ type: 'rfr_session_break' });
        const run = await runSession({
          cwd: dir, command: 'claude', args, prompts: group.map(i => prompts[i]), offset: group[0],
          before: i => testCase.before?.[i]?.(dir),
          timeoutMs: (meta.timeoutSeconds ?? 900 * group.length) * 1000, env: claudeEnv(testCase),
        });
        merged.events.push(...run.events);
        merged.stderr += run.stderr;
        merged.seconds += run.seconds;
        merged.code ||= run.code;
      }
      return merged;
    })();
  }
  return new Promise(resolve => {
    const started = Date.now();
    const child = spawn('claude', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], env: claudeEnv(testCase) });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    const timer = setTimeout(() => child.kill('SIGTERM'), (meta.timeoutSeconds ?? 900) * 1000);
    child.on('close', code => {
      clearTimeout(timer);
      const events = stdout.split('\n').filter(Boolean).flatMap(line => {
        try { return [JSON.parse(line)]; } catch { return []; }
      });
      resolve({ code, events, stderr, seconds: (Date.now() - started) / 1000 });
    });
  });
}

// Helpers handed to graders. Each call carries its `output` (the tool result's text, or '' if none
// arrived), so a grader can read what a test run printed.
export function transcriptTools(events) {
  const calls = [];
  const byId = new Map();
  for (const e of events) {
    for (const block of e.message?.content ?? []) {
      if (e.type === 'assistant' && block.type === 'tool_use') {
        const call = { name: block.name, input: block.input, output: '' };
        calls.push(call);
        if (block.id) byId.set(block.id, call);
      } else if (e.type === 'user' && block.type === 'tool_result' && byId.has(block.tool_use_id)) {
        const c = block.content;
        byId.get(block.tool_use_id).output = typeof c === 'string' ? c
          : (c ?? []).map(part => part.text ?? '').join('\n');
      }
    }
  }
  return calls;
}

export function finalText(events) {
  const result = events.findLast?.(e => e.type === 'result') ?? [...events].reverse().find(e => e.type === 'result');
  return result?.result ?? '';
}

async function gradeRun(testCase, dir, run, arm) {
  const grade = (await import(pathToFileURL(path.join(testCase.dir, 'grade.mjs')))).default;
  // Turns add up across prompts; cost is summed per session (see sessionCost).
  const results = run.events.filter(e => e.type === 'result');
  const result = results.at(-1) ?? {};
  const context = {
    dir,
    arm,
    git: (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' }).stdout,
    tools: transcriptTools(run.events),
    finalText: finalText(run.events),
    turns: turnsOf(run.events),
  };
  const graded = await grade(context);
  return {
    ...graded,
    costUsd: results.length ? +sessionCost(run.events).toFixed(4) : null,
    turns: results.length ? results.reduce((n, r) => n + (r.num_turns ?? 0), 0) : null,
    prompts: results.length,
    isError: result.is_error ?? run.code !== 0,
    seconds: run.seconds,
  };
}

// Runs the jobs with a concurrency limit. With maxCost, no job starts once the records
// finished so far have cost that much; skipped jobs are counted, not recorded.
export async function runJobs(items, { concurrency = 4, maxCost = null, worker }) {
  const records = [];
  let next = 0;
  let spent = 0;
  let skipped = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      if (maxCost !== null && spent >= maxCost) { skipped++; continue; }
      const record = await worker(items[i], i);
      spent += record?.costUsd ?? 0;
      records[i] = record;
    }
  }));
  return { records: records.filter(Boolean), skipped, spent: +spent.toFixed(4) };
}

// Runs whose session reported a model other than the one requested, grouped.
export function modelMismatches(records) {
  const counts = new Map();
  for (const r of records) {
    if (!r.reportedModel || r.reportedModel === r.model) continue;
    const key = `${r.model}|${r.reportedModel}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([key, runs]) => { const [requested, reported] = key.split('|'); return { requested, reported, runs }; });
}

function summarize(records) {
  const groups = new Map();
  for (const r of records) {
    const key = `${r.case}|${r.model}|${r.arm}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const rows = [];
  for (const [key, runs] of groups) {
    const [testCase, model, arm] = key.split('|');
    const passes = runs.filter(r => r.pass).length;
    const cost = runs.reduce((s, r) => s + (r.costUsd ?? 0), 0);
    rows.push({ case: testCase, model, arm, runs: runs.length, passes, passAll: passes === runs.length, meanCostUsd: +(cost / runs.length).toFixed(4) });
  }
  return rows;
}

export function markdown(rows, opts, { mismatches = [], skipped = 0, spent = null, maxCost = null, claudeCode = null } = {}) {
  const lines = [
    `# Eval results`,
    '',
    `${opts.suite ? `Suite: ${opts.suite}. ` : ''}Runs per cell: ${opts.runs}. Models: ${opts.models.join(', ')}. Effort: ${opts.effort ?? 'default'}. Claude Code: ${claudeCode ?? 'unknown'}.`,
    '',
    ...mismatches.map(m => `Requested ${m.requested}, but the session reported ${m.reported} in ${m.runs} run(s); the table groups by the requested model.`),
    ...(skipped ? [`Skipped ${skipped} run(s): the cost cap of $${maxCost} was reached ($${spent} spent).`] : []),
    ...(mismatches.length || skipped ? [''] : []),
    '| Case | Model | Arm | Pass | pass^k | Mean cost (USD) |',
    '|---|---|---|---|---|---|',
    ...rows.map(r => `| ${r.case} | ${r.model} | ${r.arm} | ${r.passes}/${r.runs} | ${r.passAll ? 'yes' : 'no'} | ${r.meanCostUsd} |`),
  ];
  return lines.join('\n') + '\n';
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const suite = opts.suite ? loadSuite(opts.suite) : null;
  if (suite) {
    const problems = suiteProblems(suite, loadCases(null).map(c => c.name));
    if (problems.length) throw new Error(`suite ${suite.name}: ${problems.join('; ')}`);
    if (!opts.runsGiven) opts.runs = suite.runs ?? opts.runs;
    if (opts.maxCost === null && suite.maxCostUsd) opts.maxCost = suite.maxCostUsd;
  }
  const cases = loadCases(suite ? suite.entries.map(e => e.case).filter(n => !opts.cases || opts.cases.includes(n)) : opts.cases);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.resolve(opts.out ?? path.join(ROOT, 'evals', 'results', stamp));
  fs.mkdirSync(out, { recursive: true });

  const jobs = planJobs(cases, opts, suite);
  console.log(`${jobs.length} run(s) across ${cases.length} case(s)${opts.maxCost !== null ? `, capped at $${opts.maxCost}` : ''}; results in ${path.relative(ROOT, out)}`);

  const { records, skipped, spent } = await runJobs(jobs, { concurrency: opts.concurrency, maxCost: opts.maxCost, worker: async ({ testCase, model, arm, run }) => {
    const dir = await prepareWorkspace(testCase, arm);
    const result = await runClaude({ dir, prompts: testCase.prompts, model, arm, meta: testCase.meta, effort: opts.effort, testCase });
    const graded = await gradeRun(testCase, dir, result, arm);
    const record = { case: testCase.name, model, ...reportedRun(result.events), arm, run, effort: opts.effort ?? 'default', ...graded };
    const tag = `${testCase.name}.${model}.${arm.replace('+', '-')}.${run}`;
    fs.writeFileSync(path.join(out, `${tag}.transcript.jsonl`), result.events.map(e => JSON.stringify(e)).join('\n'));
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`${record.pass ? 'PASS' : 'FAIL'} ${tag} ${JSON.stringify(graded.checks ?? {})}`);
    return record;
  } });

  const rows = summarize(records);
  const claudeCode = records.find(r => r.claudeCode)?.claudeCode ?? spawnSync('claude', ['--version'], { encoding: 'utf8' }).stdout.trim();
  const notes = { mismatches: modelMismatches(records), skipped, spent, maxCost: opts.maxCost, claudeCode };
  fs.writeFileSync(path.join(out, 'runs.json'), JSON.stringify(records, null, 2));
  fs.writeFileSync(path.join(out, 'summary.md'), markdown(rows, opts, notes));
  console.log('\n' + markdown(rows, opts, notes));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

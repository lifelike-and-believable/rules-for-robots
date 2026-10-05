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
//   rules+hooks rules + the rfr-core plugin (hooks) via --plugin-dir
//   rules+candidate  rules + the case's draft rules from evals/candidates/ (meta.candidates);
//               not in the default arms, pass it with --arms
//
// A case's bin/ folder, if present, goes first on PATH (for fake CLIs such as gh). It stays
// outside the workspace so the agent sees the commands, not their source.
//
// Usage:
//   node evals/run.mjs [--cases a,b] [--models claude-sonnet-5-5,claude-opus-5-5]
//                      [--arms none,rules,rules+hooks] [--runs 3] [--concurrency 4]
//                      [--effort medium] [--out evals/results/<stamp>]
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASES = path.join(ROOT, 'evals', 'cases');
const CANDIDATES = path.join(ROOT, 'evals', 'candidates');
const ALL_ARMS = ['none', 'rules', 'rules+hooks'];

function parseArgs(argv) {
  const opts = { runs: 3, concurrency: 4, models: ['claude-sonnet-5-5', 'claude-opus-5-5'], arms: ALL_ARMS, effort: null, cases: null };
  for (let i = 0; i < argv.length; i++) {
    const [key, value] = [argv[i], argv[i + 1]];
    if (key === '--runs') opts.runs = Number(value), i++;
    else if (key === '--concurrency') opts.concurrency = Number(value), i++;
    else if (key === '--models') opts.models = value.split(','), i++;
    else if (key === '--arms') opts.arms = value.split(','), i++;
    else if (key === '--cases') opts.cases = value.split(','), i++;
    else if (key === '--effort') opts.effort = value, i++;
    else if (key === '--out') opts.out = value, i++;
  }
  return opts;
}

export function loadCases(filter) {
  return fs.readdirSync(CASES, { withFileTypes: true })
    .filter(e => e.isDirectory() && (!filter || filter.includes(e.name)))
    .map(e => {
      const dir = path.join(CASES, e.name);
      return {
        name: e.name,
        dir,
        meta: JSON.parse(fs.readFileSync(path.join(dir, 'case.json'), 'utf8')),
        prompt: fs.readFileSync(path.join(dir, 'prompt.md'), 'utf8'),
      };
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
  fs.cpSync(path.join(testCase.dir, 'fixture'), dir, { recursive: true });
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
      fs.copyFileSync(path.join(CANDIDATES, `${id}.md`), path.join(dir, '.claude', 'rules', 'candidates', `${id}.md`));
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

export function claudeEnv(testCase, base = process.env, hasBin = fs.existsSync(path.join(testCase.dir, 'bin'))) {
  if (!hasBin) return { ...base };
  return { ...base, PATH: [path.join(testCase.dir, 'bin'), base.PATH].filter(Boolean).join(path.delimiter) };
}

function runClaude({ dir, prompt, model, arm, meta, effort, testCase }) {
  const args = [
    '-p', prompt,
    '--model', model,
    '--output-format', 'stream-json', '--verbose',
    '--setting-sources', 'project,local',
    '--no-session-persistence',
    '--max-turns', String(meta.maxTurns ?? 40),
    '--allowedTools', (meta.allowedTools ?? ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep']).join(','),
  ];
  if (effort) args.push('--effort', effort);
  if (arm === 'rules+hooks') args.push('--plugin-dir', path.join(ROOT, 'plugins', 'core'));
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

// Helpers handed to graders.
export function transcriptTools(events) {
  const calls = [];
  for (const e of events) {
    if (e.type !== 'assistant') continue;
    for (const block of e.message?.content ?? []) {
      if (block.type === 'tool_use') calls.push({ name: block.name, input: block.input });
    }
  }
  return calls;
}

export function finalText(events) {
  const result = events.findLast?.(e => e.type === 'result') ?? [...events].reverse().find(e => e.type === 'result');
  return result?.result ?? '';
}

async function gradeRun(testCase, dir, run) {
  const grade = (await import(pathToFileURL(path.join(testCase.dir, 'grade.mjs')))).default;
  const result = run.events.find(e => e.type === 'result') ?? {};
  const context = {
    dir,
    git: (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' }).stdout,
    tools: transcriptTools(run.events),
    finalText: finalText(run.events),
  };
  const graded = await grade(context);
  return {
    ...graded,
    costUsd: result.total_cost_usd ?? null,
    turns: result.num_turns ?? null,
    isError: result.is_error ?? run.code !== 0,
    seconds: run.seconds,
  };
}

async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }));
  return results;
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

function markdown(rows, opts) {
  const lines = [
    `# Eval results`,
    '',
    `Runs per cell: ${opts.runs}. Models: ${opts.models.join(', ')}. Effort: ${opts.effort ?? 'default'}. Claude Code: ${spawnSync('claude', ['--version'], { encoding: 'utf8' }).stdout.trim()}.`,
    '',
    '| Case | Model | Arm | Pass | pass^k | Mean cost (USD) |',
    '|---|---|---|---|---|---|',
    ...rows.map(r => `| ${r.case} | ${r.model} | ${r.arm} | ${r.passes}/${r.runs} | ${r.passAll ? 'yes' : 'no'} | ${r.meanCostUsd} |`),
  ];
  return lines.join('\n') + '\n';
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cases = loadCases(opts.cases);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.resolve(opts.out ?? path.join(ROOT, 'evals', 'results', stamp));
  fs.mkdirSync(out, { recursive: true });

  const jobs = [];
  for (const testCase of cases) for (const model of opts.models) for (const arm of opts.arms) {
    for (let run = 1; run <= opts.runs; run++) jobs.push({ testCase, model, arm, run });
  }
  console.log(`${jobs.length} run(s) across ${cases.length} case(s); results in ${path.relative(ROOT, out)}`);

  const records = await pool(jobs, opts.concurrency, async ({ testCase, model, arm, run }) => {
    const dir = await prepareWorkspace(testCase, arm);
    const result = await runClaude({ dir, prompt: testCase.prompt, model, arm, meta: testCase.meta, effort: opts.effort, testCase });
    const graded = await gradeRun(testCase, dir, result);
    const record = { case: testCase.name, model, arm, run, ...graded };
    const tag = `${testCase.name}.${model}.${arm.replace('+', '-')}.${run}`;
    fs.writeFileSync(path.join(out, `${tag}.transcript.jsonl`), result.events.map(e => JSON.stringify(e)).join('\n'));
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`${record.pass ? 'PASS' : 'FAIL'} ${tag} ${JSON.stringify(graded.checks ?? {})}`);
    return record;
  });

  const rows = summarize(records);
  fs.writeFileSync(path.join(out, 'runs.json'), JSON.stringify(records, null, 2));
  fs.writeFileSync(path.join(out, 'summary.md'), markdown(rows, opts));
  console.log('\n' + markdown(rows, opts));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

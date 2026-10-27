#!/usr/bin/env node
// Re-grades saved eval transcripts with the current graders, without running the model again.
// Usage: node evals/regrade.mjs <results dir> [--json]
//
// For each <case>.<model>.<arm>.<run>.transcript.jsonl it rebuilds a workspace from the case
// fixture (and setup.mjs), replays the Write tool calls into it, and runs the case's grade.mjs
// with the transcript's final text and tool calls. Only whole-file Writes are replayed, so it
// suits cases whose result is text or newly written files (the architect, tech-lead, and
// review cases), not cases that depend on edits to existing code or on running the result.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASES = path.join(ROOT, 'evals', 'cases');

export function parseTranscriptName(file) {
  const m = /^(.+?)\.(claude-[a-z0-9-]+)\.([a-z-]+)\.(\d+)\.transcript\.jsonl$/.exec(file);
  if (!m) return null;
  const arm = m[3] === 'rules-agents' ? 'rules+agents' : m[3] === 'rules-hooks' ? 'rules+hooks' : m[3] === 'rules-candidate' ? 'rules+candidate' : m[3];
  return { case: m[1], model: m[2], arm, run: Number(m[4]) };
}

export function readTranscript(file) {
  const events = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  const tools = [];
  const writes = [];
  for (const e of events) {
    if (e.type !== 'assistant') continue;
    for (const b of e.message?.content ?? []) {
      if (b.type !== 'tool_use') continue;
      tools.push({ name: b.name, input: b.input });
      if (b.name === 'Write') writes.push({ file: String(b.input?.file_path ?? ''), content: b.input?.content ?? '' });
    }
  }
  const finalText = events.findLast?.(e => e.type === 'result')?.result ?? [...events].reverse().find(e => e.type === 'result')?.result ?? '';
  return { events, tools, writes, finalText };
}

// "C:\...\Temp\rfr-eval-<case>-<random>\docs\adr\x.md" -> "docs/adr/x.md". Anchored to the temp
// folder itself: Claude's scratchpad for a run has the workspace name inside its own name, and
// is not project content.
export function relativeToWorkspace(file, caseName) {
  const m = new RegExp(`(?:^|[\\\\/])Temp[\\\\/]rfr-eval-${caseName}-[^\\\\/]+[\\\\/](.*)$`).exec(file);
  return m ? m[1].replace(/\\/g, '/') : null;
}

async function workspace(caseName, writes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `rfr-regrade-${caseName}-`));
  const meta = JSON.parse(fs.readFileSync(path.join(CASES, caseName, 'case.json'), 'utf8'));
  fs.cpSync(meta.fixtureFrom ? path.join(ROOT, meta.fixtureFrom) : path.join(CASES, caseName, 'fixture'), dir, { recursive: true });
  const g = (...a) => spawnSync('git', ['-c', 'user.email=r@example.com', '-c', 'user.name=r', ...a], { cwd: dir, encoding: 'utf8' });
  g('init', '-q', '-b', 'main');
  g('add', '-A');
  g('commit', '-q', '-m', 'start');
  const setup = path.join(CASES, caseName, 'setup.mjs');
  if (fs.existsSync(setup)) await (await import(pathToFileURL(setup))).default(dir);
  for (const w of writes) {
    const rel = relativeToWorkspace(w.file, caseName);
    if (!rel) continue;
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), w.content);
  }
  return { dir, git: (...a) => g(...a).stdout };
}

export async function regrade(resultsDir) {
  const out = [];
  for (const file of fs.readdirSync(resultsDir).filter(f => f.endsWith('.transcript.jsonl')).sort()) {
    const meta = parseTranscriptName(file);
    if (!meta) continue;
    const t = readTranscript(path.join(resultsDir, file));
    const { dir, git } = await workspace(meta.case, t.writes);
    const grade = (await import(pathToFileURL(path.join(CASES, meta.case, 'grade.mjs')))).default;
    const graded = await grade({ dir, git, tools: t.tools, finalText: t.finalText, turns: [], arm: meta.arm });
    fs.rmSync(dir, { recursive: true, force: true });
    out.push({ ...meta, pass: graded.pass, checks: graded.checks });
  }
  return out;
}

export function summarise(records) {
  const cells = new Map();
  for (const r of records) {
    const key = `${r.case} | ${r.model} | ${r.arm}`;
    const cell = cells.get(key) ?? { runs: 0, passes: 0, failed: [] };
    cell.runs++;
    if (r.pass) cell.passes++;
    else cell.failed.push(Object.entries(r.checks ?? {}).filter(([, v]) => v === false).map(([k]) => k).join('+') || 'unknown');
    cells.set(key, cell);
  }
  return [...cells].map(([key, c]) => `${key}: ${c.passes}/${c.runs}${c.failed.length ? `  (false checks in the failing runs, informational ones included: ${c.failed.join('; ')})` : ''}`);
}

async function main() {
  const dir = process.argv[2];
  if (!dir) { console.error('Usage: node evals/regrade.mjs <results dir> [--json]'); process.exit(2); }
  const records = await regrade(path.resolve(dir));
  if (process.argv.includes('--json')) console.log(JSON.stringify(records, null, 2));
  else console.log(summarise(records).join('\n'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

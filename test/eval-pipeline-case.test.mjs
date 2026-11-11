// Unit tests for arch-greenfield-pipeline: a fictional multi-component pipeline whose brief is spread
// over several documents, scored by count (problems found in the first turn, decoys declined, and a
// revision after the second turn). Also covers fixtureFrom with several bases side by side.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { copyFixtureBases, loadCase } from '../evals/run.mjs';
import grade, { DECOYS, PROBLEMS, decoysDeclined, docsWritten, problemsFound } from '../evals/cases/arch-greenfield-pipeline/grade.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASE = path.join(ROOT, 'evals', 'cases', 'arch-greenfield-pipeline');
const BRIEF = path.join(CASE, 'fixture', 'docs', 'brief');
const briefText = () => fs.readdirSync(BRIEF, { recursive: true }).filter(f => f.endsWith('.md')).map(f => fs.readFileSync(path.join(BRIEF, f), 'utf8')).join('\n\n');

// One sentence per planted problem, written the way a design might put it.
const GOOD = [
  'DLV-2 conflicts with WFL-4: galleries work offline, so each show machine keeps a local copy of the cue list and character settings.',
  'The AI guides need a local fallback for speech and voice when there is no internet (DLV-2 against PRF-4).',
  'Routing capture through the back end breaks the 80 ms budget in PRF-2; logging happens beside the live path, not in it (WFL-6).',
  'WFL-9 conflicts with SHW-1: the assistant has no access to the running show; show mode is separate.',
  'The projections, headsets, and livestream need a shared clock: PTP on the venue network, with timecode for the cues.',
  'Headset A supports Unreal 5.7 only, while the lip-sync plugin needs 5.8 (D6).',
  'The editor bridge (MCP) has no authentication, so contractors on their own computers (WFL-10) must reach it through a VPN or not at all.',
  'Git LFS without file locking breaks parallel work on the same levels (WFL-3); turn on locking and use one file per actor.',
  'GOV-2 conflicts with GOV-5: provenance stays append-only, but withdrawn recordings are deleted and the record keeps a tombstone.',
  "The producer's hard limit on AI spending must not stop a show (DLV-1); at the cap the guides fall back to local models.",
  'A remote puppeteer needs the internet, which DLV-2 says galleries cannot count on, and venues allow only port 443.',
  'The weekly report of visitor questions conflicts with GOV-7: unattended sessions record nothing, so the report can only use aggregated, anonymised counts.',
  'WFL-8 conflicts with GOV-1: only the producer approves licence terms, so the assistant cannot approve a licence.',
  'DLV-5 conflicts with DLV-6: the livestream runs 30 s behind, so it cannot show the surfacing at the same instant.',
].join('\n');

test('the case loads with two prompts and a seven-document brief over two template bases', () => {
  const c = loadCase(CASE);
  assert.equal(c.prompts.length, 2);
  assert.match(c.prompts[1], /Headset A/);
  assert.deepEqual(c.meta.fixtureFrom.map(b => b.to), ['show', 'web']);
  for (const b of c.meta.fixtureFrom) assert.ok(fs.existsSync(path.join(ROOT, b.from, 'AGENTS.md')), b.from);
  assert.equal(fs.readdirSync(BRIEF, { recursive: true }).filter(f => f.endsWith('.md')).length, 10);
});

test('every ID a problem is matched by appears in the brief', () => {
  const brief = briefText();
  for (const [name, p] of Object.entries(PROBLEMS)) for (const id of p.ids) assert.ok(brief.includes(id), `${name}: ${id}`);
});

test('the brief alone scores no problems, so restating it earns nothing', () => {
  assert.deepEqual(problemsFound(briefText()), []);
});

test('a design that names each problem finds all fourteen, and a thin one finds few', () => {
  assert.deepEqual(problemsFound(GOOD), Object.keys(PROBLEMS));
  assert.ok(problemsFound('The show runs in Unreal. The dashboard is a web app. Capture uses the suit.').length <= 1);
});

test('decoys count as declined only when the design turns them down', () => {
  assert.deepEqual(decoysDeclined('SHW-6: defer; the venue console stays. WFL-11: one service is enough for six people.'), Object.keys(DECOYS));
  assert.deepEqual(decoysDeclined('SHW-6: we build lighting programming into the dashboard.'), []);
});

test('docsWritten takes Write and Edit text under docs/ only', () => {
  const tools = [
    { name: 'Write', input: { file_path: '/w/docs/adr/0001.md', content: 'A' } },
    { name: 'Edit', input: { file_path: 'C:\\w\\docs\\adr\\0001.md', new_string: 'B' } },
    { name: 'MultiEdit', input: { file_path: '/w/docs/x.md', edits: [{ new_string: 'C' }] } },
    { name: 'Write', input: { file_path: '/w/show/Source/A.cpp', content: 'code' } },
  ];
  assert.equal(docsWritten(tools), 'A\n\nB\n\nC');
});

test('the grader counts problems from the first turn only and checks the revision in the second', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-pipeline-'));
  const g = (...args) => spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' }).stdout;
  g('init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(dir, 'README.md'), 'x\n');
  g('add', '-A');
  g('commit', '-q', '-m', 'start');
  fs.mkdirSync(path.join(dir, 'docs', 'adr'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'adr', '0001-architecture.md'), GOOD);
  const architect = [{ name: 'Agent', input: { subagent_type: 'rfr-core:software-architect' } }];
  const turn1 = { text: 'Questions:\n- Director: which venues have internet?\n- Producer: what restart time counts as stopped?\n- Curator: may recordings be kept?', tools: [...architect, { name: 'Write', input: { file_path: `${dir}/docs/adr/0001-architecture.md`, content: GOOD } }] };
  const turn2 = { text: 'Revised for Headset A.', tools: [{ name: 'Write', input: { file_path: `${dir}/docs/adr/0002-headset.md`, content: 'Supersedes part of ADR 0001: the headset build stays on Unreal 5.7.' } }] };
  const result = await grade({ dir, git: g, tools: [...turn1.tools, ...turn2.tools], turns: [turn1, turn2], arm: 'rules+agents' });
  assert.equal(result.checks.found.length, 14);
  assert.equal(result.checks.revised, true);
  assert.equal(result.pass, true, JSON.stringify(result.checks));
  // The same problems named only in the second turn do not count.
  const late = await grade({ dir, git: g, tools: architect, turns: [{ text: 'Done.', tools: architect }, { text: GOOD, tools: turn2.tools }], arm: 'rules+agents' });
  assert.equal(late.checks.found.length, 0);
  assert.equal(late.pass, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('copyFixtureBases copies one base to the root, or several side by side, and stays inside the workspace', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-bases-src-'));
  for (const name of ['a', 'b']) {
    fs.mkdirSync(path.join(root, name));
    fs.writeFileSync(path.join(root, name, `${name}.txt`), name);
  }
  const one = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-bases-one-'));
  copyFixtureBases('a', one, root);
  assert.ok(fs.existsSync(path.join(one, 'a.txt')));
  const two = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-bases-two-'));
  copyFixtureBases([{ from: 'a', to: 'show' }, { from: 'b', to: 'web' }], two, root);
  assert.ok(fs.existsSync(path.join(two, 'show', 'a.txt')));
  assert.ok(fs.existsSync(path.join(two, 'web', 'b.txt')));
  assert.throws(() => copyFixtureBases([{ from: 'a', to: '../escape' }], two, root), /outside the workspace/);
  copyFixtureBases(undefined, two, root);
  for (const d of [root, one, two]) fs.rmSync(d, { recursive: true, force: true });
});

// Tests for the process state an agent is given at the start of a session (docs/specs/process-state.md):
// the next step for each feature, approval read from the default branch, the text, and the
// SessionStart hook. Each test title cites the criterion it covers (process-state#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { featureSteps, parseProcessConfig, processNext, renderNext } from '../checks/lib/process.mjs';

const config = (extra = '') => parseProcessConfig(`default: [lead]\n${extra}`).config;
const art = (id, stage, status, from = [], more = {}) => ({ id, stage, status, file: `docs/${id}.md`, links: from.map(target => ({ target })), ...more });
const story = (status = 'approved') => art('story-a', 'stories', status);
const design = (status = 'approved') => art('design-a', 'design', status, ['story-a']);
const userDoc = (status = 'approved') => art('user-a', 'user-docs', status, ['design-a']);
const spec = (status = 'approved') => art('spec-a', 'specs', status, ['user-a']);
const tutorial = (status = 'approved') => art('tutorial-a', 'tutorials', status, ['user-a']);
const step = (artifacts, cfg = config()) => { const [s] = featureSteps(artifacts, cfg); return [s.step, s.stage]; };

test('process-state#AC-1 the next step for a story at each point', () => {
  assert.deepEqual(step([story('draft')]), ['approve', 'stories']);
  assert.deepEqual(step([story()]), ['write', 'design']);
  assert.deepEqual(step([story(), design('draft')]), ['approve', 'design']);
  assert.deepEqual(step([story(), design()]), ['write', 'user-docs']);
  assert.deepEqual(step([story(), design(), userDoc('draft')]), ['approve', 'user-docs']);
  assert.deepEqual(step([story(), design(), userDoc()]), ['deliver', 'specs']);
  assert.deepEqual(step([story(), design(), userDoc(), spec()]), ['delivering', 'specs']);
  assert.deepEqual(step([story(), design(), userDoc(), spec(), tutorial('draft')]), ['validate', 'tutorials']);
  assert.deepEqual(step([story(), design(), userDoc(), spec('implemented'), tutorial()]), ['done', 'tutorials']);
});

test('process-state#AC-1 a waived stage is skipped, and a shared design counts for each story', () => {
  const waived = config('waived:\n  design: a command-line library with no screens\n');
  const direct = art('user-a', 'user-docs', 'draft', ['story-a']);
  assert.deepEqual(step([story(), direct], waived), ['approve', 'user-docs']);

  const shared = art('design-ab', 'design', 'approved', ['story-a', 'story-b']);
  const steps = featureSteps([story(), art('story-b', 'stories', 'approved'), shared], config());
  assert.deepEqual(steps.map(s => [s.story, s.step, s.stage]), [['story-a', 'write', 'user-docs'], ['story-b', 'write', 'user-docs']]);
});

test('process-state#AC-1 an artifact that is only in this branch is not approved yet', () => {
  const s = featureSteps([story(), art('design-a', 'design', 'approved', ['story-a'], { inBranch: true })], config())[0];
  assert.deepEqual([s.step, s.stage, s.inBranch], ['approve', 'design', true]);
});

test('process-state#AC-3 the text has the rule, then each section in order', () => {
  const steps = featureSteps([
    story(), design('draft'),
    art('story-b', 'stories', 'approved'), art('design-b', 'design', 'approved', ['story-b']),
    art('story-c', 'stories', 'approved'), art('design-c', 'design', 'approved', ['story-c']), art('user-c', 'user-docs', 'approved', ['design-c']), art('tutorial-c', 'tutorials', 'approved', ['user-c']),
  ], config());
  const text = renderNext({ steps, product: [art('persona-x', 'personas', 'draft')] });
  const order = ['find the feature', 'definition of done', 'Change: fix', 'Waiting on the approver', 'story-a', 'Open for an agent', 'story-b', 'Product-level drafts', 'persona-x', 'Done: 1'];
  let at = -1;
  for (const part of order) { const i = text.indexOf(part, at + 1); assert.ok(i > at, `"${part}" in order`); at = i; }
  assert.match(text, /story-b: write the user documentation/);
});

test('process-state#AC-3 the text is capped at 40 lines and counts what it leaves out', () => {
  const many = [];
  for (let i = 0; i < 60; i++) many.push(art(`story-${i}`, 'stories', 'approved'));
  const text = renderNext({ steps: featureSteps(many, config()), product: [] });
  assert.ok(text.split('\n').length <= 40);
  assert.match(text, /and \d+ more/);
});

// A project in a git repository with a bare remote whose default branch holds an approved story.
function repo({ remote = true } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-next-'));
  const root = path.join(base, 'work');
  fs.mkdirSync(root);
  const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout; };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'test'); git('config', 'core.autocrlf', 'false');
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  write('docs/product/process.yml', 'mode: team\ndefault: [lead]\n');
  write('docs/product/stories/a.md', '---\nid: story-a\nstatus: approved\n---\n\nAs a user, I want a thing so that it helps.\n');
  git('add', '-A'); git('commit', '-q', '-m', 'base');
  if (remote) {
    spawnSync('git', ['init', '-q', '--bare', '-b', 'main', path.join(base, 'remote.git')]);
    git('remote', 'add', 'origin', path.join(base, 'remote.git'));
    git('push', '-q', '-u', 'origin', 'main');
  }
  return { root, git, write };
}
const DESIGN = '---\nid: design-a\nstatus: approved\nderived-from:\n  - story-a\n---\n\nThe design.\n';

test('process-state#AC-2 approval is read from the default branch, not the working tree', () => {
  const { root, git, write } = repo();
  git('switch', '-q', '-c', 'feature/a');
  write('docs/design/a.md', DESIGN);
  const text = processNext(root).text;
  assert.match(text, /Waiting on the approver/);
  assert.match(text, /story-a: the design .*in this branch/);
  assert.ok(!/story-a: write the user documentation/.test(text), 'the branch\'s own "approved" does not open the next stage');
});

test('process-state#AC-2 without a remote default branch it reads the working tree and says so', () => {
  const { root, write } = repo({ remote: false });
  write('docs/design/a.md', DESIGN);
  const text = processNext(root).text;
  assert.match(text, /no remote default branch/);
  assert.match(text, /story-a: write the user documentation/);
});

const HOOK = path.resolve('plugins/process/scripts/process-next.mjs');
const runHook = root => spawnSync(process.execPath, [HOOK], { cwd: root, input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: root }), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });

test('process-state#AC-4 the SessionStart hook gives the state as additional context', () => {
  const { root } = repo();
  const r = runHook(root);
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(out.hookSpecificOutput.additionalContext, /story-a: write the design/);
  const hooks = JSON.parse(fs.readFileSync('plugins/process/hooks/hooks.json', 'utf8')).hooks;
  assert.ok(hooks.SessionStart.some(g => g.hooks.some(h => h.command.includes('process-next.mjs'))));
});

test('process-state#AC-4 the hook is silent without process.yml and never fails the session', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-next-none-'));
  const none = runHook(empty);
  assert.deepEqual([none.status, none.stdout], [0, '']);

  const { root, write } = repo({ remote: false });
  write('docs/product/process.yml', 'default: [lead]\nstages: [not, a, mapping\n');
  assert.equal(runHook(root).status, 0);
});

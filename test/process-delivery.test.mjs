// Tests for the delivery run (docs/specs/delivery-run.md): the marker that says a run is under way,
// what a run still lacks, the Stop hook that keeps it going, the gate text, the pull request
// description, and the skill. Each test title cites the criterion it covers (delivery-run#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { renderNext } from '../checks/lib/process.mjs';
import { prBody, readPrBody } from '../checks/ci/process-pr-body.mjs';
import { deliveryMissing, gateText, readMarker } from '../plugins/process/scripts/delivery.mjs';

const SCRIPT = path.resolve('plugins/process/scripts/delivery.mjs');
const front = (id, status, links, extra = '') => `---\nid: ${id}\nstatus: ${status}\n${extra}derived-from:\n${links.map(l => `  - ${l}\n`).join('')}---\n`;

// A project with a bare remote. main holds an approved story, design, and user documentation; the
// work happens on feature/export.
function repo({ branch = 'feature/export' } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-delivery-'));
  const root = path.join(base, 'work');
  fs.mkdirSync(root);
  const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  const commit = message => { git('add', '-A'); git('commit', '-q', '-m', message); };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'test'); git('config', 'core.autocrlf', 'false');
  write('docs/product/process.yml', 'mode: team\ndefault: [lead]\n');
  write('docs/product/stories/export.md', `${front('story-export', 'approved', [])}\nAs a user, I want to export so that I can share.\n`);
  write('docs/design/export.md', `${front('design-export', 'approved', ['story-export'])}\n# Export\n`);
  write('docs/user/export.md', `${front('user-export', 'approved', ['design-export'])}\n# Exporting\n`);
  commit('base');
  spawnSync('git', ['init', '-q', '--bare', '-b', 'main', path.join(base, 'remote.git')]);
  git('remote', 'add', 'origin', path.join(base, 'remote.git'));
  git('push', '-q', '-u', 'origin', 'main');
  if (branch) git('switch', '-q', '-c', branch);
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
  const stop = () => {
    const r = spawnSync(process.execPath, [SCRIPT], { cwd: root, input: JSON.stringify({ hook_event_name: 'Stop', cwd: root }), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout ? JSON.parse(r.stdout) : null;
  };
  const push = () => git('push', '-q', '-u', 'origin', 'HEAD');
  return { root, git, write, commit, run, stop, push };
}
const SPEC = status => `${front('spec-export', status, ['user-export'])}\n# Export\n\n## Acceptance criteria\n\n| # | Criterion | Verified by | Source |\n|---|---|---|---|\n| AC-1 | It exports. | test: exports | user-export |\n`;
const TEST = "// export#AC-1\ntest('exports', () => {});\n";
const TUTORIAL = `${front('tutorial-export', 'draft', ['user-export'], 'runner: manual\n')}\n# Try exporting\n`;
const lacks = (r, pattern) => assert.match(deliveryMissing(r.root).join('\n'), pattern);

test('delivery-run#AC-1 a run starts on a feature branch and writes a marker', () => {
  const r = repo();
  const started = r.run('start');
  assert.equal(started.status, 0, started.stderr);
  assert.equal(readMarker(r.root).branch, 'feature/export');
  assert.ok(!fs.existsSync(path.join(r.root, 'rfr-delivery.json')), 'the marker is inside the git folder, not the working tree');

  const main = repo({ branch: null });
  const refused = main.run('start');
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /default branch/);
  assert.equal(readMarker(main.root), null);
});

test('delivery-run#AC-1 without a marker, or on another branch, every stop is allowed', () => {
  const r = repo();
  r.write('docs/specs/export.md', SPEC('draft'));
  assert.equal(r.stop(), null, 'an unfinished branch with no run under way');
  r.run('start');
  r.git('switch', '-q', '-c', 'feature/other');
  assert.equal(r.stop(), null, 'a marker for another branch');
});

test('delivery-run#AC-2 what a run still lacks, step by step', () => {
  const r = repo();
  lacks(r, /no spec in this branch/);
  r.write('docs/specs/export.md', SPEC('draft'));
  lacks(r, /docs\/specs\/export\.md: the spec is a draft/);
  lacks(r, /tests? that cites? export#AC-/);
  lacks(r, /tutorial .*user-export/);
  r.write('docs/specs/export.md', SPEC('approved'));
  r.write('test/export.test.mjs', TEST);
  r.write('docs/tutorials/export.md', TUTORIAL);
  assert.deepEqual(deliveryMissing(r.root).map(m => m.split(':')[0]), ['uncommitted changes', 'the branch is not pushed']);
  r.commit('deliver');
  assert.deepEqual(deliveryMissing(r.root).map(m => m.split(':')[0]), ['the branch is not pushed']);
  r.push();
  assert.deepEqual(deliveryMissing(r.root), []);
  r.write('src/export.mjs', 'export const x = 1;\n');
  r.commit('more');
  lacks(r, /commits not pushed/);
});

test('delivery-run#AC-2 a spec for enabling work needs no tutorial', () => {
  const r = repo();
  r.git('switch', '-q', 'main');
  r.write('docs/design/skeleton.md', `${front('design-skeleton', 'approved', ['story-export'], 'no-user-docs: repository layout and build; nothing a user sees\n')}\n# Skeleton\n`);
  r.commit('enabling design'); r.git('push', '-q', 'origin', 'main');
  r.git('switch', '-q', '-c', 'feature/skeleton');
  r.write('docs/specs/skeleton.md', `${front('spec-skeleton', 'approved', ['design-skeleton'])}\n# Skeleton\n`);
  r.write('test/skeleton.test.mjs', '// skeleton#AC-1\n');
  r.commit('skeleton'); r.push();
  assert.deepEqual(deliveryMissing(r.root), []);
});

test('delivery-run#AC-3 tests or a tutorial can be set aside in the decisions file, the push cannot', () => {
  const r = repo();
  r.write('docs/specs/export.md', SPEC('approved'));
  r.write('docs/decisions/export.md', '# Decisions: export\n\n- [set aside: tutorial] The preview deployment needs a key this session does not have.\n- [set aside: tests] The runner for this package is not installed; see the note in the spec.\n- [set aside: push] nothing\n');
  r.commit('spec only');
  assert.deepEqual(deliveryMissing(r.root).map(m => m.split(':')[0]), ['the branch is not pushed']);
});

test('delivery-run#AC-4 the hook blocks with what is missing, and gives up after three blocks with no new commit', () => {
  const r = repo();
  r.run('start');
  const first = r.stop();
  assert.equal(first.decision, 'block');
  assert.match(first.reason, /no spec in this branch/);
  assert.match(first.reason, /without asking the lead/);
  assert.equal(r.stop().decision, 'block');
  assert.equal(r.stop().decision, 'block');
  assert.equal(r.stop(), null, 'the fourth stop with no progress is allowed');
  assert.equal(readMarker(r.root).branch, 'feature/export', 'the marker stays');

  r.write('docs/specs/export.md', SPEC('approved'));
  r.commit('spec');
  assert.equal(r.stop().decision, 'block', 'a new commit starts the count again');
});

test('delivery-run#AC-5 a finished run reports once, then stops and clears the marker', () => {
  const r = repo();
  r.run('start');
  r.write('docs/specs/export.md', SPEC('approved'));
  r.write('test/export.test.mjs', TEST);
  r.write('docs/tutorials/export.md', TUTORIAL);
  r.commit('deliver'); r.push();
  r.git('remote', 'set-url', 'origin', 'https://github.com/acme/app.git');
  const report = r.stop();
  assert.equal(report.decision, 'block');
  assert.match(report.reason, /tell the lead once/i);
  assert.match(report.reason, /pulls\?q=/);
  assert.match(report.reason, /! gh pr review feature\/export --approve/);
  assert.equal(r.stop(), null);
  assert.equal(readMarker(r.root), null);
});

test('delivery-run#AC-6 the gate text gives the review link and the approve line from the remote', () => {
  for (const url of ['https://github.com/acme/app.git', 'git@github.com:acme/app.git']) {
    const text = gateText({ remote: url, branch: 'feature/export' });
    assert.match(text, /https:\/\/github\.com\/acme\/app\/pulls\?q=is%3Apr\+head%3Afeature%2Fexport/);
    assert.match(text, /! gh pr review feature\/export --approve/);
  }
});

test('delivery-run#AC-7 the pull request description has the packet, enabling designs, decisions, and the approve line', () => {
  const body = prBody({
    packet: '<!-- rfr-review-packet -->\n## Review packet\n\n- an open choice\n<!-- /rfr-review-packet -->',
    enabling: [{ id: 'design-skeleton', file: 'docs/design/skeleton.md', reason: 'repository layout and build' }],
    decisions: [{ file: 'docs/decisions/export.md', text: '- [set aside: tutorial] no preview key' }],
    gated: true, number: 12, branch: 'feature/export',
  });
  const order = ['Skips user documentation', 'design-skeleton', 'repository layout and build', 'Review packet', 'an open choice', '## Decisions', 'no preview key', '! gh pr review 12 --approve'];
  let at = -1;
  for (const part of order) { const i = body.indexOf(part, at + 1); assert.ok(i > at, `"${part}" in order`); at = i; }

  const plain = prBody({ packet: '', enabling: [], decisions: [], gated: false, number: 13, branch: 'feature/tidy' });
  assert.ok(!plain.includes('gh pr review'));
  assert.match(plain, /feature\/tidy/);
});

test('delivery-run#AC-7 the description is read from the branch', () => {
  const r = repo();
  r.write('docs/design/skeleton.md', `${front('design-skeleton', 'approved', ['story-export'], 'no-user-docs: repository layout and build; nothing a user sees\n')}\n# Skeleton\n\nIs one workspace enough? [open]\n`);
  r.write('docs/decisions/export.md', '- [set aside: tutorial] no preview key\n');
  r.commit('branch work');
  const read = readPrBody(r.root, 'origin/main');
  assert.deepEqual(read.enabling.map(e => [e.id, e.reason]), [['design-skeleton', 'repository layout and build; nothing a user sees']]);
  assert.equal(read.gated, true);
  assert.match(read.packet, /Is one workspace enough/);
  assert.deepEqual(read.decisions.map(d => d.file), ['docs/decisions/export.md']);
});

test('delivery-run#AC-7 the workflow writes the description in a step that cannot fail it', () => {
  const wf = parse(fs.readFileSync('plugins/process/templates/workflows/rfr-open-pr.yml', 'utf8'));
  const step = wf.jobs.open.steps.find(s => String(s.run ?? '').includes('process-pr-body.mjs'));
  assert.equal(step['continue-on-error'], true);
  assert.match(step.run, /gh pr edit "\$NUMBER" --body-file/);
  assert.ok(!step.run.includes('${{'));
});

test('delivery-run#AC-8 the skill states the run, and every session is pointed at it', () => {
  const skill = fs.readFileSync('plugins/process/skills/deliver/SKILL.md', 'utf8');
  for (const part of [/delivery\.mjs" start/, /spec/, /failing/, /tutorial/, /never ask/i, /\[set aside: /, /push/i, /do not open, approve, or merge/]) assert.match(skill, part);
  const text = renderNext({ steps: [{ story: 'story-a', step: 'deliver', stage: 'specs', files: [], inBranch: false, started: true }], product: [] });
  assert.match(text, /rfr-process:deliver/);
  assert.match(text, /tell (the lead|them) once/i);
  const hooks = JSON.parse(fs.readFileSync('plugins/process/hooks/hooks.json', 'utf8')).hooks;
  assert.ok(hooks.Stop.some(g => g.hooks.some(h => h.command.includes('delivery.mjs'))));
});

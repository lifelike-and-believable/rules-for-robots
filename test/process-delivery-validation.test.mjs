// Accepting a delivery and validating it are two approvals (docs/specs/delivery-run.md, AC-11).
// Approving the delivery's pull request puts the feature on the default branch with its tutorial a
// draft; approving the tutorial, after following it, is the validation. The pull request, the
// agent's report, and the process state each say so. Each test title cites delivery-run#AC-11.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { featureSteps, parseProcessConfig, renderNext } from '../checks/lib/process.mjs';
import { prBody, readPrBody } from '../checks/ci/process-pr-body.mjs';

const SCRIPT = path.resolve('plugins/process/scripts/delivery.mjs');
const front = (id, status, links, extra = '') => `---\nid: ${id}\nstatus: ${status}\n${extra}derived-from:\n${links.map(l => `  - ${l}\n`).join('')}---\n`;

test('delivery-run#AC-11 a pull request with a draft tutorial says the feature is built and not yet validated', () => {
  const body = prBody({ tutorials: [{ file: 'docs/tutorials/export.md', status: 'draft' }], gated: true, number: 7, branch: 'feature/export' });
  assert.match(body, /## Built, not yet validated/);
  assert.match(body, /docs\/tutorials\/export\.md/);
  assert.match(body, /does not record that you have validated/i);
  assert.match(body, /status: approved/);
  assert.ok(body.indexOf('Built, not yet validated') < body.indexOf('gh pr review 7 --approve'));

  const approving = prBody({ tutorials: [{ file: 'docs/tutorials/export.md', status: 'approved' }], gated: true, number: 8, branch: 'feature/validate-export' });
  assert.match(approving, /## Validation/);
  assert.match(approving, /records that you followed/i);
  assert.ok(!/not yet validated/.test(approving));

  assert.ok(!/validat/i.test(prBody({ gated: true, number: 9, branch: 'feature/design' })));
});

// A finished delivery branch in a repository with a remote.
function finished() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-validate-'));
  const root = path.join(base, 'work');
  fs.mkdirSync(root);
  const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'test'); git('config', 'core.autocrlf', 'false');
  write('docs/product/process.yml', 'mode: team\ndefault: [lead]\n');
  write('docs/product/stories/export.md', `${front('story-export', 'approved', [])}\nAs a user, I want to export so that I can share.\n`);
  write('docs/design/export.md', `${front('design-export', 'approved', ['story-export'])}\n# Export\n`);
  write('docs/user/export.md', `${front('user-export', 'approved', ['design-export'])}\n# Exporting\n`);
  git('add', '-A'); git('commit', '-q', '-m', 'base');
  spawnSync('git', ['init', '-q', '--bare', '-b', 'main', path.join(base, 'remote.git')]);
  git('remote', 'add', 'origin', path.join(base, 'remote.git')); git('push', '-q', '-u', 'origin', 'main');
  git('switch', '-q', '-c', 'feature/export');
  const env = { ...process.env, CLAUDE_PROJECT_DIR: root };
  assert.equal(spawnSync(process.execPath, [SCRIPT, 'start'], { cwd: root, encoding: 'utf8', env }).status, 0);
  write('docs/specs/export.md', `${front('spec-export', 'approved', ['user-export'])}\n# Export\n`);
  write('test/export.test.mjs', '// export#AC-1\n');
  write('docs/tutorials/export.md', `${front('tutorial-export', 'draft', ['user-export'], 'runner: manual\n')}\n# Try exporting\n`);
  git('add', '-A'); git('commit', '-q', '-m', 'deliver'); git('push', '-q', '-u', 'origin', 'HEAD');
  const stop = () => { const r = spawnSync(process.execPath, [SCRIPT], { cwd: root, input: JSON.stringify({ cwd: root }), encoding: 'utf8', env }); return r.stdout ? JSON.parse(r.stdout) : null; };
  return { root, stop };
}

test('delivery-run#AC-11 the description is read from the branch, and the end-of-run report tells the lead how to validate', () => {
  const r = finished();
  assert.deepEqual(readPrBody(r.root, 'origin/main').tutorials, [{ file: 'docs/tutorials/export.md', status: 'draft' }]);
  const report = r.stop();
  assert.equal(report.decision, 'block');
  assert.match(report.reason, /built and not yet validated/);
  assert.match(report.reason, /docs\/tutorials\/export\.md/);
  assert.match(report.reason, /leave the tutorial a draft/i);
});

test('delivery-run#AC-11 the process state calls a delivered feature built and not yet validated', () => {
  const art = (id, stage, status, from = []) => ({ id, stage, status, file: `docs/${id}.md`, links: from.map(target => ({ target })) });
  const steps = featureSteps([
    art('story-a', 'stories', 'approved'), art('design-a', 'design', 'approved', ['story-a']), art('user-a', 'user-docs', 'approved', ['design-a']),
    art('spec-a', 'specs', 'implemented', ['user-a']), art('tutorial-a', 'tutorials', 'draft', ['user-a']),
  ], parseProcessConfig('default: [lead]\n').config);
  const text = renderNext({ steps, product: [] });
  assert.match(text, /story-a: built, not yet validated/);
  assert.match(text, /follows? the tutorial \(docs\/tutorial-a\.md\)/);
});

test('delivery-run#AC-11 the skill leaves the tutorial a draft and says how validation is recorded', () => {
  const skill = fs.readFileSync('plugins/process/skills/deliver/SKILL.md', 'utf8');
  for (const part of [/status: draft/, /built and not yet validated/, /## When the lead has validated/, /status: approved/, /process-relink/]) assert.match(skill, part);
});

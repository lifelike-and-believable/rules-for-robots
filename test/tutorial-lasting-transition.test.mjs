// The lasting-tutorial rules can be reported as warnings, for a project whose tutorials were written
// before them (docs/specs/lasting-tutorials.md, AC-15): the reusable process workflow passes
// RFR_LASTING_TUTORIALS, which defaults to warn until slice 27d is done.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkCoverage } from '../checks/tutorial-run.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';

const front = (id, status, links, extra = '') => `---\nid: ${id}\nstatus: ${status}\n${extra}derived-from:\n${links.map(l => `  - ${l}\n`).join('')}---\n`;

// A project with one approved manual tutorial that breaks the body rules and that no user
// documentation links to.
function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-lasting-'));
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  write('docs/product/process.yml', 'default: [lead]\n');
  write('docs/product/stories/export.md', `${front('story-export', 'approved', [])}\nAs a user, I want to export so that I can share.\n`);
  write('docs/design/export.md', `${front('design-export', 'approved', ['story-export'])}\n# Export\n`);
  write('docs/user/export.md', `${front('user-export', 'approved', ['design-export'])}\n# Exporting\n`);
  write('docs/tutorials/export.md', `${front('tutorial-export', 'approved', ['user-export'], 'runner: manual\n')}\n# Tutorial: export\n\n## Before you start\n\n- Open http://localhost:3000.\n\n## Steps\n\n1. Export.\n\n## Run record\n\n- Ran it.\n`);
  return root;
}

test('lasting-tutorials#AC-15: by default the body rules and the link rule fail', () => {
  const root = project();
  assert.match(checkCoverage(root).errors.join('\n'), /localhost/);
  assert.match(runProcessTrace(root).errors.join('\n'), /no approved user documentation links to/);
});

test('lasting-tutorials#AC-15: with lasting warn they are warnings, and other problems still fail', () => {
  const root = project();
  const coverage = checkCoverage(root, { lasting: 'warn' });
  assert.deepEqual(coverage.errors, []);
  assert.match(coverage.warnings.join('\n'), /localhost/);
  assert.match(coverage.warnings.join('\n'), /Run record/);
  const trace = runProcessTrace(root, { lasting: 'warn' });
  assert.doesNotMatch(trace.errors.join('\n'), /no approved user documentation links to/);
  assert.match(trace.warnings.join('\n'), /no approved user documentation links to/);
  // A tutorial with no runner is still an error.
  fs.writeFileSync(path.join(root, 'docs/tutorials/bare.md'), `${front('tutorial-bare', 'draft', ['user-export'])}\n# Tutorial: bare\n`);
  assert.match(checkCoverage(root, { lasting: 'warn' }).errors.join('\n'), /no runner/);
});

test('lasting-tutorials#AC-15: the command line reads RFR_LASTING_TUTORIALS, and the workflow passes it with warn as its default', () => {
  const root = project();
  const run = env => spawnSync(process.execPath, [path.resolve('checks/tutorial-run.mjs'), root, '--coverage'], { encoding: 'utf8', env: { ...process.env, ...env } });
  assert.equal(run({ RFR_LASTING_TUTORIALS: '' }).status, 1);
  const warned = run({ RFR_LASTING_TUTORIALS: 'warn' });
  assert.equal(warned.status, 0, warned.stderr);
  assert.match(warned.stderr, /warning: .*localhost/);
  const workflow = fs.readFileSync(path.resolve('.github/workflows/rfr-process.yml'), 'utf8');
  assert.match(workflow, /lasting-tutorials:[\s\S]*?default: warn/);
  assert.equal(workflow.match(/RFR_LASTING_TUTORIALS: \$\{\{ inputs\.lasting-tutorials \}\}/g)?.length, 2);
});

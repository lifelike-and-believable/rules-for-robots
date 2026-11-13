// Tests for the advisory docs-lint job, which runs Vale on user documentation and tutorials
// (docs/specs/project-process.md, AC-23). Moved unchanged from the slice 11g file (rewrite plan 25e).
// Each test title cites the criterion it covers (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import YAML from 'yaml';
import { vocabulary, prepareVale } from '../checks/process-vale.mjs';
import { valeBinary } from '../checks/ci/install-vale.mjs';

const tmp = prefix => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
const workflow = file => YAML.parse(fs.readFileSync(file, 'utf8'));

test('project-process#AC-23: the vocabulary has persona names and glossary terms', () => {
  const terms = vocabulary(path.resolve('test/fixtures/vale-project'));
  for (const t of ['Star', 'Kettlebird', 'Webcomic', 'Chapter']) assert.ok(terms.includes(t), t);
  assert.ok(!terms.includes('Fan and reader'), 'a descriptive title is not a term');
  assert.deepEqual(terms, [...terms].sort());
});

function vale(root) {
  const out = tmp('rfr-vale-');
  const { config, paths } = prepareVale(root, out);
  assert.deepEqual(paths.map(p => path.relative(root, p).split(path.sep).join('/')).sort(), ['docs/tutorials', 'docs/user']);
  const r = spawnSync(valeBinary(), ['--config', config, '--output', 'JSON', '--no-exit', ...paths], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const alerts = Object.entries(JSON.parse(r.stdout)).flatMap(([file, list]) => list.map(a => ({ file: path.basename(file), check: a.Check, match: a.Match })));
  return alerts;
}

test('project-process#AC-23: the style flags emphatic capitals, "not X, it is Y", em dashes, US spellings, and miscased terms', () => {
  const alerts = vale(path.resolve('test/fixtures/vale-project'));
  const has = (check, file) => alerts.some(a => a.check === check && a.file === file);
  assert.ok(has('RFR.EmphaticCaps', 'reading.md'), JSON.stringify(alerts));
  assert.ok(has('RFR.NotXItsY', 'reading.md'), JSON.stringify(alerts));
  assert.ok(has('RFR.EmDashes', 'reading.md'), JSON.stringify(alerts));
  assert.ok(has('RFR.Canadian', 'first.md'), JSON.stringify(alerts));
  assert.ok(alerts.some(a => a.check === 'Vale.Terms' && a.match === 'kettlebird'), JSON.stringify(alerts));
  assert.ok(!alerts.some(a => a.check === 'RFR.Canadian' && a.file === 'reading.md'), 'colour is fine');
  assert.ok(!alerts.some(a => a.check === 'Vale.Spelling'), 'no US dictionary spelling check');
});

test('project-process#AC-23: the reusable workflow has an advisory docs-lint job running Vale', () => {
  const job = workflow('.github/workflows/rfr-process.yml').jobs['docs-lint'];
  assert.ok(job, 'docs-lint job');
  assert.equal(job['continue-on-error'], true);
  const run = job.steps.map(s => s.run ?? '').join('\n');
  assert.match(run, /install-vale\.mjs/);
  assert.match(run, /process-vale\.mjs/);
  assert.match(run, /GITHUB_STEP_SUMMARY/);
});

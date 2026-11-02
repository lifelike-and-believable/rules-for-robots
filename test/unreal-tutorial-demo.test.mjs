// Structure checks for the Unreal fixture tutorial (docs/specs/project-process.md, AC-25). The
// criterion itself is verified by the Tier 2 workflow on the GPU runner; these keep the pieces
// that workflow relies on from drifting apart without an engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import YAML from 'yaml';
import { checkCoverage } from '../checks/tutorial-run.mjs';

test('project-process#AC-25: the fixture tutorial is an Unreal tutorial that an automation spec cites', () => {
  const { errors, tutorials } = checkCoverage('examples/unreal');
  assert.deepEqual(errors, []);
  assert.deepEqual(tutorials.map(t => [t.id, t.runner]), [['tutorial-rfrsample-score-display', 'unreal']]);
  const spec = fs.readFileSync('examples/unreal/RfrSample/Source/RfrSample/Private/Tests/RfrSampleTutorialSpec.cpp', 'utf8');
  assert.match(spec, /tutorial-rfrsample-score-display/);
  assert.match(spec, /"RfrSample\.Tutorial\.ScoreDisplay"/);
});

test('project-process#AC-25: the tutorial-demo job runs the spec, the screenshot test, and the render with a renderer', () => {
  const job = YAML.parse(fs.readFileSync('.github/workflows/unreal-tier2.yml', 'utf8')).jobs['tutorial-demo'];
  const run = job.steps.map(s => s.run ?? '').join('\n');
  assert.match(run, /tutorial-run\.mjs examples\/unreal --coverage/);
  assert.match(run, /make_demo\.py/);
  assert.match(run, /RunTests RfrSample\.Tutorial\+Project\.Functional Tests/);
  assert.match(run, /render_demo\.py/);
  const tests = job.steps.find(s => /Functional Tests/.test(s.run ?? '')).run;
  assert.doesNotMatch(tests, /-nullrhi/, 'the screenshot test needs a renderer');
  assert.match(tests, /read-automation-report\.mjs/);
  assert.ok(job.steps.some(s => /upload-artifact/.test(s.uses ?? '') && s.if === 'always()'));
});

test('project-process#AC-25: the demo scripts build what the job names and are valid Python', () => {
  const make = fs.readFileSync('examples/unreal/ci/make_demo.py', 'utf8');
  const render = fs.readFileSync('examples/unreal/ci/render_demo.py', 'utf8');
  for (const name of ['/Game/RfrDemo/ScoreDisplayMap', '/Game/RfrDemo/ScoreDemo']) {
    assert.ok(make.includes(name.split('/').pop()) && render.includes(name), name);
  }
  assert.match(make, /ScreenshotFunctionalTest/);
  assert.match(make, /maximum_global_error", 0\.0002/, 'a one-digit change (0.0008) must fail the comparison');
  assert.match(make, /maximum_local_error", 0\.01\)/, 'a one-digit change (0.042 local) must fail the comparison');
  assert.match(make, /preview_score", SCORE/);
  assert.match(make, /RFR_DEMO_SCORE", "3"/);
  const py = spawnSync('python3', ['-c', 'import ast,sys\nfor f in sys.argv[1:]: ast.parse(open(f).read(), f)', 'examples/unreal/ci/make_demo.py', 'examples/unreal/ci/render_demo.py'], { encoding: 'utf8' });
  assert.equal(py.status, 0, py.stderr);
});

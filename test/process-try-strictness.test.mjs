// Cases the review of slice 27c found (docs/specs/lasting-tutorials.md, AC-5, AC-8, AC-14): the
// deeper nesting process.yml allows is for try: only, the package-script check reads only the forms
// it can be sure of, a place's services come from process.yml when the run names the place, and
// needs and titles read the ordinary ways of writing them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseProcessConfig, tutorialTitle } from '../checks/lib/process.mjs';
import { localScript } from '../checks/process-trace.mjs';
import { needsOf } from '../checks/lib/tutorial.mjs';
import { providesFor } from '../checks/tutorial-run.mjs';

test('lasting-tutorials#AC-5: a third level of nesting is read under try only, and is still an error elsewhere', () => {
  const errorsOf = text => parseProcessConfig(`default: [lead]\n${text}`).errors.join('\n');
  assert.match(errorsOf('stages:\n  design:\n    approvers: [alice]\n'), /cannot read|unexpected|unknown/);
  assert.match(errorsOf('waived:\n  design:\n    nested: a reason that is long enough\n'), /cannot read|unexpected|needs a reason|only design/);
  assert.doesNotMatch(errorsOf('gates:\n  design:\n    mode: approve\n'), /object Object/);
  assert.match(errorsOf('gates:\n  design:\n    mode: approve\n'), /cannot read|unexpected|must be one of/);
  const ok = parseProcessConfig('default: [lead]\ntry:\n  provides:\n    local: [mail]\n');
  assert.deepEqual([ok.errors, ok.config.try.provides], [[], { local: ['mail'] }]);
});

test('lasting-tutorials#AC-5: the script check reads only "<manager> run <script>", and nothing with a workspace or folder option', () => {
  assert.equal(localScript('npm run try'), 'try');
  assert.equal(localScript('pnpm run start:try'), 'start:try');
  assert.equal(localScript('yarn run try'), 'try');
  assert.equal(localScript('npm run try -- --port 3001'), 'try');
  for (const command of [
    'pnpm -C web dev', 'pnpm --filter web dev', 'yarn --cwd web dev', 'yarn workspace web dev', 'npm run -w web dev', 'pnpm -r dev',
    'npm run dev --workspace=web', 'pnpm run --filter web dev', 'pnpm tsx server.ts', 'yarn vite', 'pnpm up', 'pnpm try', 'yarn try',
    'cd web && npm run try', 'PORT=1 npm run try', 'docker compose up',
  ]) assert.equal(localScript(command), null, command);
});

test('lasting-tutorials#AC-14: a run that names its place takes the services from try.provides, and the preview workflow names it', () => {
  const config = { try: { provides: { local: ['mail'], preview: [] } } };
  assert.deepEqual(providesFor({ given: null, place: 'local', config }), ['mail']);
  assert.deepEqual(providesFor({ given: null, place: 'preview', config }), []);
  // A place the project lists nothing for, and a project with no provides, leave needs unchecked.
  assert.equal(providesFor({ given: null, place: 'staging', config }), null);
  assert.equal(providesFor({ given: null, place: 'preview', config: { try: null } }), null);
  assert.equal(providesFor({ given: null, place: null, config }), null);
  // The command line wins.
  assert.deepEqual(providesFor({ given: ['payments'], place: 'local', config }), ['payments']);
  const workflow = fs.readFileSync('.github/workflows/rfr-tutorials-preview.yml', 'utf8');
  assert.match(workflow, /tutorial-run\.mjs \. .*--place preview/);
});

test('lasting-tutorials#AC-14: needs reads a trailing comment and an unindented block list', () => {
  const front = body => `---\nid: tutorial-a\nrunner: web\n${body}---\n`;
  assert.deepEqual(needsOf(front('needs: [mail, tripo] # real delivery\n')), { needs: ['mail', 'tripo'], error: null });
  assert.deepEqual(needsOf(front('needs:\n  - mail # real delivery\n  - tripo\n')), { needs: ['mail', 'tripo'], error: null });
  assert.deepEqual(needsOf(front('needs:\n- mail\n- tripo\n')), { needs: ['mail', 'tripo'], error: null });
});

test('lasting-tutorials#AC-8: a title keeps a # that is part of it', () => {
  assert.equal(tutorialTitle('---\nid: t\n---\n\n# Learning C#\n'), 'Learning C#');
  assert.equal(tutorialTitle('---\nid: t\n---\n\n# Export a report ##\n'), 'Export a report');
});

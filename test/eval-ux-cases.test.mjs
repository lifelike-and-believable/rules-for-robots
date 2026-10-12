// Unit tests for the ux-reviewer eval cases: graders on synthetic good, partial, and generic reviews.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASES = path.join(ROOT, 'evals', 'cases');
const gitIn = dir => (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' }).stdout;

function workspace(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `rfr-${name}-`));
  fs.cpSync(path.join(CASES, name, 'fixture'), dir, { recursive: true });
  const g = gitIn(dir);
  g('init', '-q', '-b', 'main');
  g('-c', 'user.email=t@example.com', '-c', 'user.name=t', 'add', '-A');
  g('-c', 'user.email=t@example.com', '-c', 'user.name=t', 'commit', '-q', '-m', 'start');
  return dir;
}

async function run(name, { files = {}, finalText = '', tools = [], arm = 'rules' } = {}) {
  const dir = workspace(name);
  for (const [rel, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, rel), content);
  const grade = (await import(pathToFileURL(path.join(CASES, name, 'grade.mjs')))).default;
  const result = await grade({ dir, git: gitIn(dir), tools, finalText, arm });
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

const finding = (severity, where, problem, scenario, fix) => `- [${severity}] ${where}, no rule\n  Problem: ${problem}\n  Failure scenario: ${scenario}\n  Fix: ${fix}`;
const reviewerCall = [{ name: 'Agent', input: { subagent_type: 'rfr-core:ux-reviewer' } }];
const GENERIC = 'The code is short and readable. Consider adding more tests and a README. Nothing else stands out.';

const CASES_UNDER_TEST = {
  'ux-signup-flow': {
    file: 'public/app.js',
    full: [
      finding('blocker', 'public/app.js:10', 'form.reset() wipes everything the person typed when sign-up fails.', 'A failed submit clears the email and password they just entered.', 'Do not reset the form on error.'),
      finding('major', 'public/app.js:11', 'The error message is only "Error 422".', 'The person sees a status code and does not know what to change.', 'Say what to fix.'),
      finding('major', 'public/app.js:6', 'The submit button is not disabled while the request is pending.', 'Pressing Go twice sends a duplicate request.', 'Disable the button until the response.'),
      finding('blocker', 'public/index.html:20', 'Delete account sits next to Save and runs with no confirmation.', 'One misclick deletes the account with no undo.', 'Confirm first and separate the button.'),
      finding('minor', 'public/app.js:24', 'An empty project list renders nothing.', 'A new person sees a blank section with no next step.', 'Add an empty state.'),
    ].join('\n'),
    four: ['form.reset() wipes the typed input on error.', 'The message is only Error 422, a bare status code.', 'No double submit protection: disable the button while the request is pending.', 'Delete account has no confirmation and is next to Save.'].join('\n'),
    three: ['form.reset() wipes the typed input on error.', 'The message is only Error 422, a bare status code.', 'Delete account has no confirmation and is next to Save.'].join('\n'),
  },
  'ux-landing-page': {
    file: 'site/index.html',
    full: [
      'The primary call to action, Get started, is styled like body text, so the visual hierarchy has nothing that stands out.',
      'Body text is 12px in light grey #aaa, which fails contrast and is hard to read.',
      'The page is a fixed 1200px wide with no media queries, so it scrolls horizontally on a 320px phone.',
      'The copy is lorem ipsum placeholder text under the vague headline Welcome.',
      'The same action is called Join, Get started, and Register: inconsistent labels.',
    ].join('\n'),
    four: ['The call to action does not stand out in the visual hierarchy.', 'Body text is 12px #aaa: poor contrast.', 'Fixed 1200px layout with no media queries.', 'Lorem ipsum placeholder text.'].join('\n'),
    three: ['The call to action does not stand out in the visual hierarchy.', 'Body text is 12px #aaa: poor contrast.', 'Lorem ipsum placeholder text.'].join('\n'),
  },
  'ux-cli-tool': {
    file: 'bin/shipit.js',
    full: [
      'Running shipit with no arguments prints nothing: there is no --help or usage text.',
      'A failed deploy prints "Error: failed" but the process exit code stays 0.',
      'clean deletes dist and the backups with no confirmation or dry-run, which is destructive.',
      'deploy is silent for 30 seconds per target, with no progress, so it looks hung.',
      'A missing shipit.json shows a raw ENOENT stack trace and does not say which file or what to do.',
    ].join('\n'),
    four: ['No --help or usage text when run without arguments.', 'The exit code is 0 even when the deploy failed.', 'clean is destructive and has no confirmation or dry run.', 'deploy shows no progress for 30 seconds.'].join('\n'),
    three: ['No --help or usage text when run without arguments.', 'The exit code is 0 even when the deploy failed.', 'deploy shows no progress for 30 seconds.'].join('\n'),
  },
  'ux-editor-tool': {
    file: 'Source/ThumbnailTools/Public/ThumbnailLibrary.h',
    full: [
      'Proc2 and DoThing are unclear names with no Category or DisplayName; use a verb-first name.',
      'No ToolTip on any function, and bFlag and N have no meaning for the Blueprint user.',
      'RegenerateAll loops over every asset on the game thread with no FScopedSlowTask, so there is no progress or cancel and the editor freezes.',
      'The functions modify assets with no FScopedTransaction, so the change cannot be undone.',
      'Failures are reported only by UE_LOG(LogTemp, Error, "fail"), not in the Message Log and not actionable.',
    ].join('\n'),
    four: ['Proc2 and DoThing need descriptive names and a Category.', 'No ToolTip, and bFlag is unexplained.', 'No FScopedSlowTask: the editor freezes with no progress.', 'No FScopedTransaction, so no undo.'].join('\n'),
    three: ['Proc2 and DoThing need descriptive names and a Category.', 'No ToolTip, and bFlag is unexplained.', 'No FScopedTransaction, so no undo.'].join('\n'),
  },
};

for (const [name, c] of Object.entries(CASES_UNDER_TEST)) {
  test(`${name}: a review of all five planted defects passes`, async () => {
    const r = await run(name, { finalText: c.full });
    assert.equal(r.pass, true, JSON.stringify(r.checks));
    assert.equal(r.checks.found.length, 5);
  });

  test(`${name}: four defects pass, three fail, and a generic review finds none`, async () => {
    assert.equal((await run(name, { finalText: c.four })).pass, true);
    const three = await run(name, { finalText: c.three });
    assert.equal(three.pass, false);
    assert.equal(three.checks.foundFour, false);
    assert.equal((await run(name, { finalText: GENERIC })).checks.found.length, 0);
  });

  test(`${name}: editing a file fails, and the agent arm needs the reviewer called`, async () => {
    const edited = await run(name, { finalText: c.full, files: { [c.file]: '// fixed\n' } });
    assert.equal(edited.pass, false);
    assert.equal(edited.checks.noCode, false);
    assert.equal((await run(name, { finalText: c.full, arm: 'rules+agents' })).pass, false);
    assert.equal((await run(name, { finalText: c.full, arm: 'rules+agents', tools: reviewerCall })).pass, true);
  });
}

test('ux-signup-flow: the standard finding format is recorded', async () => {
  const r = await run('ux-signup-flow', { finalText: CASES_UNDER_TEST['ux-signup-flow'].full });
  assert.equal(r.checks.standardFormat, true);
  assert.deepEqual(r.checks.severities, { blocker: 2, major: 2, minor: 1, nit: 0 });
});

test('ux-clean-form: minor notes pass, a major or blocker finding fails, an empty answer fails', async () => {
  const minors = [finding('minor', 'public/app.js:30', 'The success message disappears only on reload.', 'The person cannot tell if a second message was sent.', 'Clear it on the next input.'), 'Checked: labels, inline validation, pending state, error recovery, success feedback.'].join('\n');
  assert.equal((await run('ux-clean-form', { finalText: minors })).pass, true);
  const major = finding('major', 'public/app.js:12', 'Invented problem.', 'None.', 'None.') + '\n' + minors;
  const r = await run('ux-clean-form', { finalText: major });
  assert.equal(r.pass, false);
  assert.equal(r.checks.noBlockerOrMajor, false);
  assert.equal((await run('ux-clean-form', { finalText: 'None.' })).pass, false);
  assert.equal((await run('ux-clean-form', { finalText: minors, files: { 'public/app.js': '// x\n' } })).pass, false);
});

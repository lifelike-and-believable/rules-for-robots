// Unit tests for the greenfield cases: arch-greenfield-webapp, arch-greenfield-uplugin, lead-greenfield-webapp, and
// lead-greenfield-uplugin. Each starts from a profile's template repo plus the case's own REQUIREMENTS.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { conflictFlagged, questionCount, requirementsMentioned } from '../evals/agents/greenfield.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASES = path.join(ROOT, 'evals', 'cases');
const NAMES = ['arch-greenfield-webapp', 'arch-greenfield-uplugin', 'lead-greenfield-webapp', 'lead-greenfield-uplugin'];
const gitIn = dir => (...args) => spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' }).stdout;

// Builds the workspace the way evals/run.mjs does: the shared base, then the case's own fixture on top.
async function run(name, { files = {}, finalText = '', tools = [], arm = 'rules' } = {}) {
  const meta = JSON.parse(fs.readFileSync(path.join(CASES, name, 'case.json'), 'utf8'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `rfr-${name}-`));
  fs.cpSync(path.join(ROOT, meta.fixtureFrom), dir, { recursive: true });
  fs.cpSync(path.join(CASES, name, 'fixture'), dir, { recursive: true });
  const g = gitIn(dir);
  g('init', '-q', '-b', 'main');
  g('add', '-A');
  g('commit', '-q', '-m', 'start');
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  const grade = (await import(pathToFileURL(path.join(CASES, name, 'grade.mjs')))).default;
  const result = await grade({ dir, git: g, tools, finalText, arm });
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

const architectCall = [{ name: 'Agent', input: { subagent_type: 'rfr-core:software-architect' } }];
const leadCall = [{ name: 'Agent', input: { subagent_type: 'rfr-core:tech-lead' } }];

test('each case pairs a template repo with a requirements brief that numbers what the grader counts', () => {
  const expect = { webapp: ['template-repos/web-app', 11], uplugin: ['template-repos/unreal-plugin', 10] };
  for (const name of NAMES) {
    const [from, count] = expect[name.split('-').at(-1)];
    assert.equal(JSON.parse(fs.readFileSync(path.join(CASES, name, 'case.json'), 'utf8')).fixtureFrom, from, name);
    assert.ok(fs.existsSync(path.join(ROOT, from, 'AGENTS.md')), from);
    const brief = fs.readFileSync(path.join(CASES, name, 'fixture', 'REQUIREMENTS.md'), 'utf8');
    assert.equal(requirementsMentioned(brief, 99).size, count, name);
  }
  // The architect and tech-lead cases for one kind of project read the same brief.
  for (const kind of ['webapp', 'uplugin']) {
    const read = role => fs.readFileSync(path.join(CASES, `${role}-greenfield-${kind}`, 'fixture', 'REQUIREMENTS.md'), 'utf8');
    assert.equal(read('arch'), read('lead'), kind);
  }
});

test('greenfield helpers: a conflict needs both requirements and a clash word nearby; questions skip code', () => {
  assert.equal(conflictFlagged('R9 keeps history for 7 years, which conflicts with R10 deletion.', 9, 10), true);
  assert.equal(conflictFlagged('R9 keeps history. R10 deletes data on request.', 9, 10), false);
  assert.equal(conflictFlagged(`R9 conflicts with nothing.${' filler'.repeat(100)} R10 deletes.`, 9, 10), false);
  assert.equal(conflictFlagged('R19 conflicts with R10.', 9, 10), false);
  assert.equal(questionCount('Who decides?\n```\nconst x = a ? b : c;\n```\nWhat budget?'), 2);
  assert.deepEqual([...requirementsMentioned('R1, R2, R12 and R0', 11)].sort(), [1, 2]);
});

// ---- arch-greenfield-webapp

const WEB_ADR = {
  intro: '# ADR 0001: Volunteer shifts architecture\n\nNext.js on Vercel with Postgres (Neon), within the project rules and the $20 budget of R11. Organizers publish shifts (R1); volunteers browse and sign up (R2); R5 gives organizers a roster with a remove action; R8 is met with semantic HTML, mobile-first layout, and axe checks in CI.',
  options: 'Options considered: a separate API service, rejected because R11 leaves nobody to run servers; Supabase, considered but rejected in favour of plain Postgres to stay inside the project rules.',
  contradiction: 'R9 and R10 conflict: a complete seven-year history of sign-ups contradicts deleting all personal data on request. One way to reconcile them is to pseudonymize the history and delete the name and email.',
  cancel: 'R4 says a volunteer cancels their own sign-up, but R2 has no accounts. Each sign-up gets a signed cancel link in the confirmation email so the volunteer can cancel without an account.',
  realTime: 'R7 asks for real time. Polling every 15 seconds is cheap and within the budget; websockets need a paid service. We need the organizers to define what real time means.',
  capacity: 'R3 is a race: two sign-ups at the same moment can overbook. The insert runs in a transaction that locks the shift row and checks capacity.',
  reminder: 'R6 needs a reminder 24 hours ahead, which needs a scheduler: a Vercel cron job every hour sends due reminders, in the shift\'s time zone.',
  organizer: 'Nothing says how organizers log in. Organizers sign in with a magic link restricted to three known addresses.',
  questions: '## Questions for the organizers\n\n- Which wins when R9 and R10 meet: the funders\' audit or the deletion request?\n- Is a refresh every 15 seconds live enough for R7?\n- Who are the organizers, and which email addresses do they use?',
};

test('arch-greenfield-webapp: an ADR that maps the brief, flags R9/R10, finds the problems, and asks passes', async () => {
  const r = await run('arch-greenfield-webapp', { files: { 'docs/adr/0001-architecture.md': Object.values(WEB_ADR).join('\n\n') } });
  assert.equal(r.pass, true, JSON.stringify(r.checks));
  assert.equal(r.checks.found.length, 6);
});

test('arch-greenfield-webapp: the contradiction counts toward four problems, and three is not enough', async () => {
  const { cancel, realTime, capacity, reminder, organizer, ...rest } = WEB_ADR;
  const neutral = 'R3 caps sign-ups. R4 lets volunteers cancel. R6 sends reminders. R7 shows availability.';
  const four = await run('arch-greenfield-webapp', { files: { 'docs/adr/0001.md': [...Object.values(rest), cancel, realTime, capacity, neutral].join('\n\n') } });
  assert.equal(four.checks.foundFour, true, JSON.stringify(four.checks));
  const three = await run('arch-greenfield-webapp', { files: { 'docs/adr/0001.md': [...Object.values(rest), cancel, realTime, neutral].join('\n\n') } });
  assert.equal(three.checks.foundFour, false);
  assert.deepEqual(three.checks.found.sort(), ['anonymousCancel', 'contradiction', 'realTimeAmbiguous']);
});

test('arch-greenfield-webapp: deciding R9/R10 silently, asking nothing, or one option fails', async () => {
  const silent = { ...WEB_ADR, contradiction: 'R9 is met with an append-only log. R10 deletes the volunteer row on request.' };
  assert.equal((await run('arch-greenfield-webapp', { files: { 'docs/adr/0001.md': Object.values(silent).join('\n\n') } })).checks.contradictionFlagged, false);
  const noQuestions = { ...WEB_ADR, questions: '## Next steps\n\nBuild it.' };
  assert.equal((await run('arch-greenfield-webapp', { files: { 'docs/adr/0001.md': Object.values(noQuestions).join('\n\n') } })).checks.asksQuestions, false);
  const noOptions = { ...WEB_ADR, options: 'We use Next.js and Postgres.' };
  assert.equal((await run('arch-greenfield-webapp', { files: { 'docs/adr/0001.md': Object.values(noOptions).join('\n\n') } })).checks.options, false);
});

test('arch-greenfield-webapp: an ADR that skips requirements, no ADR, code, or a skipped agent fails', async () => {
  const adr = { 'docs/adr/0001.md': Object.values(WEB_ADR).join('\n\n') };
  const thin = await run('arch-greenfield-webapp', { files: { 'docs/adr/0001.md': [WEB_ADR.contradiction, WEB_ADR.cancel, WEB_ADR.questions].join('\n\n') } });
  assert.equal(thin.checks.coversRequirements, false);
  const chatOnly = await run('arch-greenfield-webapp', { finalText: Object.values(WEB_ADR).join('\n\n') });
  assert.equal(chatOnly.checks.adrWritten, false);
  assert.equal(chatOnly.checks.noCode, false);
  assert.equal((await run('arch-greenfield-webapp', { files: { ...adr, 'package.json': '{}' } })).checks.noCode, false);
  assert.equal((await run('arch-greenfield-webapp', { files: adr, arm: 'rules+agents' })).pass, false);
  assert.equal((await run('arch-greenfield-webapp', { files: adr, arm: 'rules+agents', tools: architectCall })).pass, true);
});

// ---- arch-greenfield-uplugin

const UE_ADR = {
  intro: '# ADR 0001: Asset Naming Auditor\n\nR1 is an editor window over the scan results, with the convention per asset class. R3 renames through IAssetTools::RenameAssets, which fixes references and leaves redirectors to clean up. R4 checks files out through ISourceControlProvider and reports locked files. R6 is a UDeveloperSettings class saved to DefaultEditor.ini.',
  options: 'Options considered: one runtime module plus an editor module, rejected because of R10; a standalone program instead of a plugin, rejected because it cannot use the Asset Registry.',
  module: 'The plugin has one Editor module ("Type": "Editor"), so nothing reaches a packaged game (R10).',
  scan: 'R2: the scan reads the Asset Registry without loading assets, in chunks inside an FScopedSlowTask with cancel.',
  versions: 'R7: 5.6 and 5.7 differ in a few APIs; guard them with ENGINE_MAJOR_VERSION and ENGINE_MINOR_VERSION and build against each engine in CI.',
  fab: 'R8: Fab checks the .uplugin descriptor, the platform list, copyright headers, and zero warnings.',
  api: 'R5: a UBlueprintFunctionLibrary of BlueprintCallable checks for Editor Utility Widgets, and a commandlet for CI.',
  tests: 'Automation tests (IMPLEMENT_SIMPLE_AUTOMATION_TEST) cover the naming rules; Scripts/Verify.ps1 runs Tier 1 and Tier 2.',
  contradiction: 'R9 contradicts R10: checking assets at runtime in a packaged build needs runtime code, and R10 forbids any. They cannot both hold. One way to reconcile them is to check DLC packs at cook time instead.',
  questions: '## Questions for the tools team\n\n- Is a cook-time check of DLC packs enough for R9, or must the check run in the shipped game?\n- Should Fix delete the redirectors it leaves, or leave that to a separate step?',
};

test('arch-greenfield-uplugin: an ADR that finds the Unreal constraints, flags R9/R10, and asks passes', async () => {
  const r = await run('arch-greenfield-uplugin', { files: { 'docs/adr/0001-architecture.md': Object.values(UE_ADR).join('\n\n') } });
  assert.equal(r.pass, true, JSON.stringify(r.checks));
  assert.equal(r.checks.found.length, 9);
});

test('arch-greenfield-uplugin: six of nine constraints pass, five fail', async () => {
  const intro = '# ADR 0001\n\nR1 is an editor window. R3 renames assets. R4 uses source control. R6 is in Project Settings.';
  const base = [intro, UE_ADR.options, UE_ADR.contradiction, UE_ADR.questions, 'R2 scans. R5 is for Blueprint. R7 covers 5.6 and 5.7. R8 is Fab.'];
  const six = [...base, UE_ADR.module, UE_ADR.scan, UE_ADR.versions, UE_ADR.tests, 'Fix leaves redirectors.', 'Settings live in DefaultEditor.ini.'];
  const r6 = await run('arch-greenfield-uplugin', { files: { 'docs/adr/0001.md': six.join('\n\n') } });
  assert.equal(r6.checks.foundSix, true, JSON.stringify(r6.checks));
  const r5 = await run('arch-greenfield-uplugin', { files: { 'docs/adr/0001.md': six.slice(0, -1).join('\n\n') } });
  assert.equal(r5.checks.foundSix, false, JSON.stringify(r5.checks));
});

test('arch-greenfield-uplugin: picking a side of R9/R10 without saying they clash, or no questions, fails', async () => {
  const silent = { ...UE_ADR, contradiction: 'R9 is handled at cook time. R10 is met by the editor module.' };
  assert.equal((await run('arch-greenfield-uplugin', { files: { 'docs/adr/0001.md': Object.values(silent).join('\n\n') } })).checks.contradictionFlagged, false);
  const noQuestions = { ...UE_ADR, questions: '' };
  assert.equal((await run('arch-greenfield-uplugin', { files: { 'docs/adr/0001.md': Object.values(noQuestions).join('\n\n') } })).checks.asksQuestions, false);
});

test('arch-greenfield-uplugin: source files, or a skipped agent, fail', async () => {
  const adr = { 'docs/adr/0001.md': Object.values(UE_ADR).join('\n\n') };
  assert.equal((await run('arch-greenfield-uplugin', { files: { ...adr, 'Source/Auditor/Auditor.Build.cs': '' } })).checks.noCode, false);
  assert.equal((await run('arch-greenfield-uplugin', { files: adr, arm: 'rules+agents' })).pass, false);
  assert.equal((await run('arch-greenfield-uplugin', { files: adr, arm: 'rules+agents', tools: architectCall })).pass, true);
});

// ---- lead-greenfield-webapp

const WEB_PLAN = `Plan: volunteer shifts, from an empty repository. Nothing has been built.

Before we build: R9 and R10 conflict. A complete seven-year history contradicts deleting all personal data on request. Which should win, or is pseudonymizing the history acceptable? We need an answer before slice 6.

Every slice is test-first: the owner writes failing tests from the acceptance criteria, then the code. The code-reviewer reviews each slice. Done means npm run verify passes.

### Slice 1: Walking skeleton
Owner: web-engineer. Create the Next.js project (package.json, create-next-app), Postgres, and CI; publish one shift (R1) and show it on the list (R2 browse). Acceptance: a test shows the published shift on the page; npm run verify passes in CI.

### Slice 2: Sign-up with capacity
Owner: web-engineer. R2 sign-up with name and email; R3 capacity in one transaction. Acceptance: a test with two parallel sign-ups for the last spot gets exactly one.

### Slice 3: Cancel link
Owner: web-engineer. R4 cancel through a signed link, up to 2 hours before. Acceptance: tests for a valid link, a late cancel, and a forged link.

### Slice 4: Emails
Owner: web-engineer. R6 confirmation on sign-up and a cron reminder 24 hours before. Acceptance: tests with a fake mailer and a fixed clock.

### Slice 5: Organizer roster
Owner: web-engineer. R5 roster and remove, behind organizer sign-in. Acceptance: tests that only organizers can see or remove.

### Slice 6: History and deletion
Owner: web-engineer. R9 history log and R10 deletion, once the organizers answer. Acceptance: tests for both.

### Slice 7: Live availability, accessibility, and hosting
Owner: web-engineer. R7 polling, R8 WCAG 2.2 AA with axe tests on phone widths, R11 cost check on the Vercel and Neon free tiers. Acceptance: axe test passes; the list refreshes within 15 seconds.
`;

test('lead-greenfield-webapp: a test-first plan that starts with a skeleton and asks about R9/R10 passes', async () => {
  const r = await run('lead-greenfield-webapp', { finalText: WEB_PLAN });
  assert.equal(r.pass, true, JSON.stringify(r.checks));
  assert.equal(r.checks.slices, 7);
});

test('lead-greenfield-webapp: a plan that starts without creating the project, or misses requirements, fails', async () => {
  const noBootstrap = WEB_PLAN.replace('Create the Next.js project (package.json, create-next-app), Postgres, and CI; publish', 'Publish');
  assert.equal((await run('lead-greenfield-webapp', { finalText: noBootstrap })).checks.bootstrapsProject, false);
  const noSkeleton = WEB_PLAN.replace('Walking skeleton', 'Shift publishing').replace('Create the Next.js project (package.json, create-next-app), Postgres, and CI; publish one shift (R1) and show it on the list (R2 browse). Acceptance: a test shows the published shift on the page; npm run verify passes in CI.', 'Publish shifts (R1).')
    .replace('R2 sign-up with name and email; R3 capacity in one transaction. Acceptance: a test with two parallel sign-ups for the last spot gets exactly one.', 'R2 sign-up; R3 capacity.');
  assert.equal((await run('lead-greenfield-webapp', { finalText: noSkeleton })).checks.walkingSkeletonFirst, false);
  const missing = WEB_PLAN.replace(/R7 polling, R8 WCAG 2\.2 AA with axe tests on phone widths, R11 cost check/, 'Polling and accessibility');
  assert.equal((await run('lead-greenfield-webapp', { finalText: missing })).checks.coversRequirements, false);
});

test('lead-greenfield-webapp: deciding R9/R10 without asking, no test-first, or no verify command fails', async () => {
  const decided = WEB_PLAN.replace(/Before we build:[^\n]*\n/, 'We keep an anonymized history.\n').replace(', once the organizers answer', '');
  assert.equal((await run('lead-greenfield-webapp', { finalText: decided })).checks.raisesConflict, false);
  const noTestsFirst = WEB_PLAN.replace('Every slice is test-first: the owner writes failing tests from the acceptance criteria, then the code.', 'The owner writes the code.');
  assert.equal((await run('lead-greenfield-webapp', { finalText: noTestsFirst })).checks.testsFirst, false);
  assert.equal((await run('lead-greenfield-webapp', { finalText: WEB_PLAN.replaceAll('npm run verify', 'the checks') })).checks.verifyCommand, false);
});

test('lead-greenfield-webapp: a stretch slice is not counted, and too few slices, code, or a skipped agent fail', async () => {
  const stretch = `${WEB_PLAN}\n### Slice 8: Stretch, only if there is time\nOwner: web-engineer. Calendar export.\n`;
  assert.equal((await run('lead-greenfield-webapp', { finalText: stretch })).checks.slices, 7);
  const short = WEB_PLAN.split('### Slice 4')[0];
  assert.equal((await run('lead-greenfield-webapp', { finalText: short })).checks.sliceCount, false);
  assert.equal((await run('lead-greenfield-webapp', { finalText: WEB_PLAN, files: { 'package.json': '{}' } })).checks.noCode, false);
  assert.equal((await run('lead-greenfield-webapp', { finalText: WEB_PLAN, arm: 'rules+agents' })).pass, false);
  assert.equal((await run('lead-greenfield-webapp', { finalText: WEB_PLAN, arm: 'rules+agents', tools: leadCall })).pass, true);
});

// ---- lead-greenfield-uplugin

const UE_PLAN = `Plan: Asset Naming Auditor, from an empty template. Nothing has been built.

Before we build: R9 and R10 conflict. Checking assets at runtime in a packaged build contradicts adding nothing to a packaged game. Would a cook-time check of DLC packs be enough? We need the tools team's answer before slice 6.

Every slice is test-first: the owner writes failing automation tests from the acceptance criteria, then the code. The code-reviewer reviews each slice. Done means Scripts/Verify.ps1 passes.

### Slice 1: Minimal plugin
Owner: unreal-engineer. Create the .uplugin descriptor and one editor module (Source/, Build.cs) that builds on 5.6 and 5.7 (R7). Acceptance: Verify.ps1 runs the Tier 1 checks and the build on both engines.

### Slice 2: Settings and naming rules
Owner: unreal-engineer. R6 settings class in Project Settings; the per-class prefix and suffix rules of R1. Acceptance: automation tests for each rule.

### Slice 3: Scan
Owner: unreal-engineer. R2 Asset Registry scan with progress and cancel. Acceptance: a test project with many assets does not block the editor.

### Slice 4: Window and Fix
Owner: unreal-engineer. R1 window; R3 rename with undo; R4 source control checkout and locked-file report. Acceptance: tests rename, undo, and skip a locked file.

### Slice 5: Blueprint and command line
Owner: unreal-engineer. R5 Blueprint library and a commandlet for CI. Acceptance: the commandlet fails on a bad name.

### Slice 6: Packaging and Fab
Owner: unreal-engineer. R8 Fab requirements; R10 nothing in a packaged game; R9 once the tools team answers. Acceptance: a packaged sample contains no plugin code.
`;

test('lead-greenfield-uplugin: a plan that starts with a minimal plugin and asks about R9/R10 passes', async () => {
  const r = await run('lead-greenfield-uplugin', { finalText: UE_PLAN });
  assert.equal(r.pass, true, JSON.stringify(r.checks));
  assert.equal(r.checks.slices, 6);
});

test('lead-greenfield-uplugin: no descriptor first, no verify script, or the web owner fails', async () => {
  const noBootstrap = UE_PLAN.replace('Create the .uplugin descriptor and one editor module (Source/, Build.cs) that builds', 'Write the naming rules, which build');
  assert.equal((await run('lead-greenfield-uplugin', { finalText: noBootstrap })).checks.bootstrapsProject, false);
  assert.equal((await run('lead-greenfield-uplugin', { finalText: UE_PLAN.replaceAll('Scripts/Verify.ps1', 'the checks').replaceAll('Verify.ps1', 'the checks') })).checks.verifyCommand, false);
  assert.equal((await run('lead-greenfield-uplugin', { finalText: UE_PLAN.replaceAll('unreal-engineer', 'web-engineer'), arm: 'rules+agents', tools: leadCall })).checks.owner, false);
  // The rules arm has no agent roster to name, so owners are not required there.
  assert.equal((await run('lead-greenfield-uplugin', { finalText: UE_PLAN.replaceAll('unreal-engineer', 'a developer') })).checks.owner, true);
});

test('lead-greenfield-uplugin: a table plan with a Done-when column, other reviewers, and a numbered decisions list before it pass', async () => {
  const rows = [1, 2, 3, 4, 5].map(n => `| ${n} | Slice ${n} work (R${n}). | unreal-engineer | Spec passes. |`).join('\n');
  const table = `Decisions needed:

**Blocking slice 0:**

1. R9 and R10 conflict; which do you want?
2. Which engine versions?

## Plan

Test-first, with Scripts/Verify.ps1 and a security-reviewer on each slice. The minimal plugin comes first (.uplugin, Source/, Build.cs, tier1).

| # | Slice | Owner | Done when |
|---|---|---|---|
${rows}
`;
  const r = await run('lead-greenfield-uplugin', { finalText: table });
  assert.equal(r.checks.slices, 5);
  assert.equal(r.checks.acceptanceCriteria, true);
  assert.equal(r.checks.reviewer, true);
});

test('lead-greenfield-uplugin: deciding R9/R10, code, or a skipped agent fails', async () => {
  const decided = UE_PLAN.replace(/Before we build:[^\n]*\n/, 'R9 is done at cook time.\n').replace('; R9 once the tools team answers', '; R9 at cook time');
  assert.equal((await run('lead-greenfield-uplugin', { finalText: decided })).checks.raisesConflict, false);
  assert.equal((await run('lead-greenfield-uplugin', { finalText: UE_PLAN, files: { 'Auditor.uplugin': '{}' } })).checks.noCode, false);
  assert.equal((await run('lead-greenfield-uplugin', { finalText: UE_PLAN, arm: 'rules+agents' })).pass, false);
  assert.equal((await run('lead-greenfield-uplugin', { finalText: UE_PLAN, arm: 'rules+agents', tools: leadCall })).pass, true);
});

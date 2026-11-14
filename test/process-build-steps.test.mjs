// A design's build order: the numbered list at the start of its "Notes for delivery" section, the
// records that say a step is built or left for later, what a delivery run still lacks for each step,
// and the end-of-run report (docs/specs/delivery-run.md, AC-18; rewrite plan 25f: a delivery built
// step 1 of six and finished, because the check asked only for a spec, tests, and a tutorial).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildSteps, stepRecords } from '../checks/lib/process.mjs';
import { deliveryMissing } from '../plugins/process/scripts/delivery.mjs';

const SCRIPT = path.resolve('plugins/process/scripts/delivery.mjs');
const front = (id, status, links, extra = '') => `---\nid: ${id}\nstatus: ${status}\n${extra}derived-from:\n${links.map(l => `  - ${l}\n`).join('')}---\n`;

// The shape of the design that prompted this: one sentence, six numbered steps with bold titles and
// long text (inline code, bold words, several sentences), then a paragraph and prose bullets.
const REAL_SHAPE = `# Trying the product design

## Notes for delivery

Build in this order. Each step ends with something that runs.

1. **The try command and sign-in.** \`tryMode()\` and its tests first, then the three guards, the mail and file stand-ins, the starting-point loader for the first starting point, **Try the product**, \`pnpm run try\`, and the \`try:\` block in \`process.yml\` in the same pull request. The pull request touches \`docs/product/\`, so it waits for the lead's review. It gets a security review against the four conditions.
2. **Previews.** The hosting project and its preview database are the lead's to connect; see the checks below. Then copy \`rfr-tutorials-preview.yml\` from the rfr-process templates, so the tutorials run on each preview and the recording is kept. In the copy, pass only the \`RFR_PREVIEW_BYPASS\` secret, not every secret, and pin the workflow and \`rules-ref\` to one commit.
3. **The tutorials.** Write the twelve as \`runner: web\`, each with its starting point in the loader, and run them with \`tutorial-run\` against the try command's product. Add **Try it** to each user documentation page, linking its tutorial: sign-in to 2; projects to 1; facts to 3; review to 7 and 8; board to 9; activity to 12.
4. **Remove what they replace.** \`web/e2e/tutorial-board.spec.ts\`, \`tutorial-facts.spec.ts\` and \`tutorial-review.spec.ts\`, and the four old tutorials, in the pull request where the new ones pass.
5. **Turn the rules on.** Set \`lasting-tutorials: fail\` in the \`with:\` of \`.github/workflows/rfr-process.yml\` once the tutorials pass the rules.
6. **Help.** The \`/help\` pages and the **Help** link. This step can follow the lead's validation of slices 2 to 4: until it is built, the pull request's "Try it" section links each tutorial's file in the repository. **Try it** is added to the pages in step 3 as a link to the tutorial's file, which is what Help serves.

What the delivery must know:

- **The runner cannot choose a file.** Its sentences have none for a file field. Tutorials 3, 5, 7, 9 and 10 choose a file.
- **The runner signs in by first name.** \`Sign in as **Jordan**.\` opens \`/try/sign-in?as=Jordan\`.
- \`[assumed]\` items are checked against the installed versions when the spec is written.

Checks only a person can do, for the lead's validation list:

- Follow tutorials 3 to 12 on a preview, to validate slices 2, 3 and 4.
- A manual pass of **Try the product** and one help page with a screen reader.

## Open items

1. Not a step: this list is in another section.
`;

test('delivery-run#AC-18: the build order of a design shaped like the one that prompted it is its six steps', () => {
  const design = { id: 'design-trying-the-product', stage: 'design', body: REAL_SHAPE };
  const expected = [
    { n: 1, title: 'The try command and sign-in' },
    { n: 2, title: 'Previews' },
    { n: 3, title: 'The tutorials' },
    { n: 4, title: 'Remove what they replace' },
    { n: 5, title: 'Turn the rules on' },
    { n: 6, title: 'Help' },
  ];
  assert.deepEqual(buildSteps(design), expected);
  assert.deepEqual(buildSteps(REAL_SHAPE), expected, 'the body alone reads the same');
});

test('delivery-run#AC-18: a design with no notes, or notes with no numbered list, has no steps', () => {
  assert.deepEqual(buildSteps('# Export\n\n## Flow\n\n1. Open the menu.\n2. Choose Export.\n'), []);
  assert.deepEqual(buildSteps('# Export\n\n## Notes for delivery\n\n- A follow-up.\n- A check only a person can do.\n'), []);
  assert.deepEqual(buildSteps({ body: '' }), []);
});

test('delivery-run#AC-18: a numbered list after another list in the section is not a build order', () => {
  const body = '# Export\n\n## Notes for delivery\n\n- A follow-up the packet could not make.\n\nThen:\n\n1. **Not a step.** It comes after the bullets.\n2. Nor this.\n';
  assert.deepEqual(buildSteps(body), []);
});

test('delivery-run#AC-18: continuation lines belong to their step, numbers are as written, and titles are cut', () => {
  const long = 'A step whose first sentence runs on and on without any full stop at all until well past the limit of eighty characters';
  const body = [
    '## Notes for delivery',
    '',
    '<!-- The build order. -->',
    '',
    '3. *The export* command, written',
    '   across two lines. More text.',
    '',
    '   - a nested bullet that belongs to step 3',
    '4. __The export button__ on the toolbar! It opens the dialog.',
    `5. ${long}`,
    '',
    'A paragraph after the list.',
    '',
    '6. A second list, which is not read.',
  ].join('\n');
  const steps = buildSteps(body);
  assert.deepEqual(steps.map(s => s.n), [3, 4, 5]);
  assert.equal(steps[0].title, 'The export command, written across two lines');
  assert.equal(steps[1].title, 'The export button on the toolbar!');
  assert.ok(steps[2].title.length <= 80, steps[2].title);
  assert.ok(long.startsWith(steps[2].title), steps[2].title);
  assert.ok(steps[2].title.length > 60, steps[2].title);
});

test('delivery-run#AC-18: the records say which steps are built and which are left for later', () => {
  const records = stepRecords([
    '# Decisions\n\n- [step done: design-export 1]\n- [step later: design-export 2] It needs a hosting account only the lead can connect.\n- [step later: design-export 3] Follows validation.\n',
    '- [step done:  design-export   3 ] built in a later run\n- [Step done: design-export 4] wrong case\n- [step done: design-export] no number\n- [step  done: design-other 1]\n',
  ]);
  assert.deepEqual([...records.done].sort(), ['design-export 1', 'design-export 3', 'design-other 1']);
  assert.deepEqual([...records.later].sort(), ['design-export 2'], 'a step recorded as done anywhere is done');
  assert.deepEqual(stepRecords([]), { done: new Set(), later: new Set() });
});

// A project with a bare remote. main holds an approved story, a design with the notes given, and
// user documentation; the work happens on feature/export, whose decisions file is
// docs/decisions/feature-export.md.
function repo(notes) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-build-steps-'));
  const root = path.join(base, 'work');
  fs.mkdirSync(root);
  const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  const commit = message => { git('add', '-A'); git('commit', '-q', '-m', message); };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'test'); git('config', 'core.autocrlf', 'false');
  write('docs/product/process.yml', 'default: [lead]\n');
  write('docs/product/stories/export.md', `${front('story-export', 'approved', [])}\nAs a user, I want to export so that I can share.\n`);
  write('docs/design/export.md', `${front('design-export', 'approved', ['story-export'])}\n# Export\n\n${notes}`);
  write('docs/user/export.md', `${front('user-export', 'approved', ['design-export'])}\n# Exporting\n`);
  commit('base');
  spawnSync('git', ['init', '-q', '--bare', '-b', 'main', path.join(base, 'remote.git')]);
  git('remote', 'add', 'origin', path.join(base, 'remote.git'));
  git('push', '-q', '-u', 'origin', 'main');
  git('switch', '-q', '-c', 'feature/export');
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
  const stop = () => {
    const r = spawnSync(process.execPath, [SCRIPT], { cwd: root, input: JSON.stringify({ hook_event_name: 'Stop', cwd: root }), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout ? JSON.parse(r.stdout) : null;
  };
  const push = () => git('push', '-q', '-u', 'origin', 'HEAD');
  // Everything AC-2 asks for: an approved spec, a test that cites it, and a tutorial.
  const deliver = () => {
    write('docs/specs/export.md', `${front('spec-export', 'approved', ['user-export'])}\n# Export\n`);
    write('test/export.test.mjs', "// export#AC-1\ntest('exports', () => {});\n");
    write('docs/tutorials/export.md', `${front('tutorial-export', 'draft', ['user-export'], 'runner: manual\n')}\n# Try exporting\n`);
  };
  return { root, git, write, commit, run, stop, push, deliver };
}

const THREE_STEPS = '## Notes for delivery\n\nBuild in this order.\n\n1. **The export command.** Writes a file.\n2. **The export button.** On the toolbar.\n3. **Help.** The help page; it can follow the lead\'s validation.\n\n- A check only a person can do: a screen reader pass.\n';
const item = n => `step ${n} of design-export: build it and record \`[step done: design-export ${n}]\` in the run's decisions file, or record \`[step later: design-export ${n}]\` with why`;
const stepItems = root => deliveryMissing(root).filter(m => m.startsWith('step '));

test('delivery-run#AC-18: a delivery lacks every step of its design that no decisions file records', () => {
  const r = repo(THREE_STEPS);
  r.deliver(); r.commit('deliver'); r.push();
  assert.deepEqual(deliveryMissing(r.root), [item(1), item(2), item(3)]);
});

test('delivery-run#AC-18: two steps built and one left for later leave nothing missing', () => {
  const r = repo(THREE_STEPS);
  r.deliver();
  r.write('docs/decisions/feature-export.md', '# Decisions\n\n- [step done: design-export 1]\n- [step done: design-export 2]\n- [step later: design-export 3] It follows the lead\'s validation.\n');
  r.commit('deliver'); r.push();
  assert.deepEqual(deliveryMissing(r.root), []);
});

test('delivery-run#AC-18: a step left for later by an earlier run is asked for again by the next one', () => {
  // The earlier run's record is on the default branch. A run that continues the feature builds the
  // step or leaves it for later again, with its own reason, in its own decisions file.
  const r = repo(THREE_STEPS);
  r.git('switch', '-q', 'main');
  r.deliver();
  r.write('docs/decisions/feature-first.md', '- [step done: design-export 1]\n- [step done: design-export 2]\n- [step later: design-export 3] It follows the lead\'s validation.\n');
  r.commit('first run'); r.git('push', '-q', 'origin', 'main');
  r.git('switch', '-q', '-c', 'feature/export-more');
  assert.deepEqual(deliveryMissing(r.root, ['export']).filter(m => m.startsWith('step ')), [item(3)]);
  r.write('docs/decisions/feature-export-more.md', '- [step later: design-export 3] The lead has not validated it yet.\n');
  assert.deepEqual(deliveryMissing(r.root, ['export']).filter(m => m.startsWith('step ')), []);
});

test('delivery-run#AC-18: a design with no build order adds nothing to what a delivery lacks', () => {
  for (const notes of ['', '## Notes for delivery\n\n- A follow-up.\n', '## Notes for delivery\n\n- A follow-up.\n\n1. After a list, not a step.\n']) {
    const r = repo(notes);
    r.deliver(); r.commit('deliver'); r.push();
    assert.deepEqual(deliveryMissing(r.root), [], JSON.stringify(notes));
    assert.deepEqual(stepItems(r.root), []);
  }
});

test('delivery-run#AC-18: the end-of-run report lists each step left for later and says the feature stays open', () => {
  const r = repo(THREE_STEPS);
  r.run('start');
  r.deliver();
  r.write('docs/decisions/feature-export.md', '- [step done: design-export 1]\n- [step later: design-export 2] It needs a hosting account only the lead can connect.\n- [step later: design-export 3] It follows the lead\'s validation.\n');
  r.commit('deliver'); r.push();
  const report = r.stop();
  assert.equal(report.decision, 'block');
  assert.match(report.reason, /tell the lead once/i);
  assert.ok(report.reason.includes('step 2 of design-export: The export button'), report.reason);
  assert.ok(report.reason.includes('step 3 of design-export: Help'), report.reason);
  assert.ok(!report.reason.includes('step 1 of design-export'), report.reason);
  assert.match(report.reason, /stays open/);
  assert.match(report.reason, /deliver it/);
});

test('delivery-run#AC-18: a report with every step built mentions no steps left for later', () => {
  const r = repo(THREE_STEPS);
  r.run('start');
  r.deliver();
  r.write('docs/decisions/feature-export.md', '- [step done: design-export 1]\n- [step done: design-export 2]\n- [step done: design-export 3]\n');
  r.commit('deliver'); r.push();
  const report = r.stop();
  assert.equal(report.decision, 'block');
  assert.doesNotMatch(report.reason, /stays open/);
});

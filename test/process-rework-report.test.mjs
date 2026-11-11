// The rework report: amendments to approved artifacts, and which came after a spec built on them
// was approved (docs/specs/project-process.md AC-62, process plan 23l).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { formatRework, readHistory, summariseRework } from '../checks/process-rework-report.mjs';

const SCRIPT = path.resolve('checks/process-rework-report.mjs');
function git(root, ...args) {
  const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'core.autocrlf=false', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function write(root, file, text) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
}
const artifact = (id, status, links, body, extra = '') =>
  `---\nid: ${id}\nstatus: ${status}\n${extra}${links.length ? `derived-from:\n${links.map(l => `  - ${l}\n`).join('')}` : ''}---\n\n${body}\n`;
const commit = (root, message) => { git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', message); };

const PERSONA = 'docs/product/personas/reader.md';
const STORY = 'docs/product/stories/share/share-link.md';
const DESIGN = 'docs/design/share.md';
const USER = 'docs/user/sharing.md';
const SPEC = 'docs/specs/share.md';

// A product's history on main: squash-style commits "(#n)" and one merged branch.
function history() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-rework-'));
  git(root, 'init', '-q', '-b', 'main');
  write(root, 'docs/product/process.yml', 'mode: solo\ndefault: [lead]\n');
  write(root, PERSONA, artifact('persona-reader', 'approved', [], '# Reader\n\n## Goals\n\nShare chapters.'));
  write(root, STORY, artifact('story-share-link', 'approved', ['persona-reader#goals'], 'As a reader, I want a link so that friends can read.'));
  write(root, DESIGN, artifact('design-share', 'approved', ['story-share-link'], '# Share design\n\nA button in the top bar.'));
  write(root, USER, artifact('user-sharing', 'approved', ['story-share-link'], '# Sharing\n\nClick **Share**.'));
  write(root, 'docs/specs/plain.md', '---\nstatus: approved\n---\n\nA Phase 10 spec with no id.\n');
  commit(root, 'Add the product brief (#1)');

  // Before any spec: an amendment that is not late; a whitespace-only edit; a re-recorded hash.
  write(root, STORY, artifact('story-share-link', 'approved', ['persona-reader#goals'], 'As a reader, I want a short link so that friends can read.'));
  write(root, DESIGN, artifact('design-share', 'approved', ['story-share-link'], '# Share design\n\nA button   in the top bar.\n'));
  write(root, USER, artifact('user-sharing', 'approved', ['story-share-link: abc123def456'], '# Sharing\n\nClick **Share**.'));
  write(root, 'docs/specs/plain.md', '---\nstatus: approved\n---\n\nA Phase 10 spec with no id, edited.\n');
  commit(root, 'Shorter links (#2)');

  write(root, SPEC, artifact('spec-share', 'approved', ['user-sharing'], '# Share\n\n| AC-1 | Copies a link. | test: x |'));
  commit(root, 'Spec for sharing (#3)');

  // A branch with two commits that amend the persona, two links above the spec; merged once.
  git(root, 'checkout', '-q', '-b', 'persona-fix');
  write(root, PERSONA, artifact('persona-reader', 'approved', [], '# Reader\n\n## Goals\n\nShare chapters with a book club.'));
  commit(root, 'persona: book club');
  write(root, PERSONA, artifact('persona-reader', 'approved', [], '# Reader\n\n## Goals\n\nShare chapters with a book club, on a phone.'));
  commit(root, 'persona: phone');
  git(root, 'checkout', '-q', 'main');
  git(root, 'merge', '-q', '--no-ff', 'persona-fix', '-m', 'Merge pull request #4 from lead/persona-fix');

  // A rename with no change, and a withdrawal.
  git(root, 'mv', DESIGN, 'docs/design/sharing.md');
  write(root, USER, artifact('user-sharing', 'draft', ['story-share-link'], '# Sharing\n\nClick **Share**.', 'withdrawn: the flow is being redesigned, #9\n'));
  commit(root, 'Rename and withdraw (#5)');

  write(root, SPEC, artifact('spec-share', 'approved', ['user-sharing'], '# Share\n\n| AC-1 | Copies a short link. | test: x |'));
  fs.rmSync(path.join(root, STORY));
  commit(root, 'Spec wording; remove the story (#6)');
  return root;
}

test('project-process#AC-62: amendments, late amendments, withdrawals, and removals are counted per stage', () => {
  const s = summariseRework(readHistory(history()));
  assert.deepEqual(s.stages.personas, { approved: 1, amendments: 1, late: 1, withdrawn: 0, removed: 0 });
  assert.deepEqual(s.stages.stories, { approved: 1, amendments: 1, late: 0, withdrawn: 0, removed: 1 }, 'amended before any spec, so not late');
  assert.deepEqual(s.stages.design, { approved: 1, amendments: 0, late: 0, withdrawn: 0, removed: 0 }, 'whitespace and a rename are not amendments');
  assert.deepEqual(s.stages['user-docs'], { approved: 1, amendments: 0, late: 0, withdrawn: 1, removed: 0 }, 'a re-recorded hash is not an amendment');
  assert.deepEqual(s.stages.specs, { approved: 1, amendments: 1, late: 0, withdrawn: 0, removed: 0 }, 'a spec without an id is not an artifact');
  assert.deepEqual(s.specs, { approved: 1, withLateRework: 1 });
});

test('project-process#AC-62: a merged branch counts once, with its pull request number', () => {
  const s = summariseRework(readHistory(history()));
  const late = s.events.filter(e => e.late);
  assert.equal(late.length, 1);
  assert.equal(late[0].pr, 4);
  assert.equal(late[0].id, 'persona-reader');
  assert.deepEqual(s.events.filter(e => e.kind === 'amended').map(e => e.pr), [2, 4, 6]);
});

test('project-process#AC-62: the JSON has no ids, file names, or text; the text report names the late amendments', () => {
  const root = history();
  const r = spawnSync(process.execPath, [SCRIPT, root, '--json', '--label', 'pilot'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const data = JSON.parse(r.stdout);
  assert.equal(data.repository, 'pilot');
  assert.equal(data.specs.withLateRework, 1);
  assert.doesNotMatch(r.stdout, /persona-reader|story-share|docs\/|Reader|chapters/);
  assert.ok(data.events.every(e => Object.keys(e).every(k => ['pr', 'date', 'stage', 'kind', 'late'].includes(k))));
  const text = formatRework('pilot', summariseRework(readHistory(root)));
  assert.match(text, /1 of 1 approved specs/);
  assert.match(text, /#4 .*personas.*persona-reader/);
  assert.equal(spawnSync(process.execPath, [SCRIPT, root, '--bogus'], { encoding: 'utf8' }).status, 2);
});

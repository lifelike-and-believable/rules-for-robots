// The session's stage-order guard reads approval from the remote default branch where delivery starts,
// as the process state does (docs/specs/project-process.md AC-64, amended in rewrite plan 25e;
// process-state AC-3): a spec or tutorial derives only from user documentation approved on the default
// branch, so documentation marked approved only in the agent's own branch does not open delivery. Inside
// a feature packet, a design or user documentation derives from the stage before it as proposed in the
// same branch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decideStage } from '../plugins/process/scripts/guard-stages.mjs';

const artifact = (id, status, links = [], body = '# Title\n') => `---\nid: ${id}\nstatus: ${status}\nderived-from:\n${links.map(l => `  - ${l}\n`).join('')}---\n\n${body}`;

// A project whose remote default branch (origin/main) holds `onMain`, checked out on a feature branch.
function project(onMain) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-stage-source-'));
  const remote = path.join(base, 'remote.git');
  const root = path.join(base, 'work');
  const git = (cwd, ...args) => {
    const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8' });
    assert.equal(r.status, 0, `${args.join(' ')}: ${r.stderr}`);
  };
  fs.mkdirSync(root);
  git(base, 'init', '-q', '--bare', '-b', 'main', remote);
  git(root, 'init', '-q', '-b', 'main');
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  write('docs/product/process.yml', 'default: [lead]\n');
  for (const [file, text] of Object.entries(onMain)) write(file, text);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  git(root, 'remote', 'add', 'origin', remote);
  git(root, 'push', '-q', '-u', 'origin', 'main');
  git(root, 'remote', 'set-head', 'origin', 'main');
  git(root, 'switch', '-q', '-c', 'feature');
  return { root, write };
}

const STORY = 'docs/product/stories/sign-in/sign-in.md';
const DESIGN = 'docs/design/sign-in.md';
const DOCS = 'docs/user/sign-in.md';
const packet = { [STORY]: artifact('story-sign-in', 'approved'), [DESIGN]: artifact('design-sign-in', 'approved', ['story-sign-in']) };
const writeSpec = root => ({ tool_name: 'Write', cwd: root, tool_input: { file_path: path.join(root, 'docs/specs/sign-in.md'), content: artifact('spec-sign-in', 'draft', ['docs-sign-in']) } });
const writeDesign = root => ({ tool_name: 'Write', cwd: root, tool_input: { file_path: path.join(root, DESIGN), content: artifact('design-sign-in', 'draft', ['story-sign-in']) } });

test('project-process#AC-64: a spec derives from user documentation approved on the default branch', () => {
  const { root } = project({ ...packet, [DOCS]: artifact('docs-sign-in', 'approved', ['design-sign-in']) });
  assert.equal(decideStage(writeSpec(root), root), null);
});

test('project-process#AC-64: user documentation marked approved only in this branch does not open delivery', () => {
  const { root, write } = project({ ...packet, [DOCS]: artifact('docs-sign-in', 'draft', ['design-sign-in']) });
  write(DOCS, artifact('docs-sign-in', 'approved', ['design-sign-in']));
  assert.match(decideStage(writeSpec(root), root) ?? '', /must derive from approved user documentation/);
});

test('project-process#AC-64: user documentation added in this branch as approved does not count until its pull request merges', () => {
  const { root, write } = project(packet);
  write(DOCS, artifact('docs-sign-in', 'approved', ['design-sign-in']));
  assert.match(decideStage(writeSpec(root), root) ?? '', /must derive from approved user documentation/);
});

test('project-process#AC-64: user documentation approved on the default branch keeps its approval while this branch amends it', () => {
  const { root, write } = project({ ...packet, [DOCS]: artifact('docs-sign-in', 'approved', ['design-sign-in']) });
  write(DOCS, artifact('docs-sign-in', 'approved', ['design-sign-in'], '# Title\n\nA corrected step.\n'));
  assert.equal(decideStage(writeSpec(root), root), null);
});

test('project-process#AC-64: inside a feature packet, a design derives from the story as proposed in the same branch', () => {
  const { root, write } = project({});
  write(STORY, artifact('story-sign-in', 'approved'));
  assert.equal(decideStage(writeDesign(root), root), null);
  write(STORY, artifact('story-sign-in', 'draft'));
  assert.match(decideStage(writeDesign(root), root) ?? '', /must derive from approved user stories/);
});

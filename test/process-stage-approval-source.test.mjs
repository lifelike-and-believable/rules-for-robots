// The session's stage-order guard reads approval from the remote default branch, as the process state
// does (docs/specs/project-process.md AC-64, amended in rewrite plan 25e; process-state AC-3): an
// artifact marked approved only in the agent's own branch does not open the next stage, and one
// approved on the default branch keeps its approval while it is amended.
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
const writeDesign = root => ({ tool_name: 'Write', cwd: root, tool_input: { file_path: path.join(root, 'docs/design/sign-in.md'), content: artifact('design-sign-in', 'draft', ['story-sign-in']) } });

test('project-process#AC-64: a story approved on the default branch lets its design be written', () => {
  const { root } = project({ [STORY]: artifact('story-sign-in', 'approved') });
  assert.equal(decideStage(writeDesign(root), root), null);
});

test('project-process#AC-64: a story marked approved only in this branch does not open the design stage', () => {
  const { root, write } = project({ [STORY]: artifact('story-sign-in', 'draft') });
  write(STORY, artifact('story-sign-in', 'approved'));
  assert.match(decideStage(writeDesign(root), root) ?? '', /must derive from approved user stories/);
});

test('project-process#AC-64: a story added in this branch as approved does not count until its pull request merges', () => {
  const { root, write } = project({});
  write(STORY, artifact('story-sign-in', 'approved'));
  assert.match(decideStage(writeDesign(root), root) ?? '', /must derive from approved user stories/);
});

test('project-process#AC-64: a story approved on the default branch keeps its approval while this branch amends it', () => {
  const { root, write } = project({ [STORY]: artifact('story-sign-in', 'approved') });
  write(STORY, artifact('story-sign-in', 'approved', [], '# Title\n\nAn added acceptance criterion.\n'));
  assert.equal(decideStage(writeDesign(root), root), null);
});

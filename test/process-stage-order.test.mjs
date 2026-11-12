// Stage order (docs/specs/project-process.md, AC-63 and AC-64): every delivery stage is required
// unless process.yml waives it ahead of time. The process check fails an artifact that skips a stage,
// and the session guard refuses writing one, so a spec cannot come straight from stories.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseProcessConfig, requiredUpstream } from '../checks/lib/process.mjs';
import { decideStage } from '../plugins/process/scripts/guard-stages.mjs';

const artifact = (id, status, links = [], body = '# Title\n') => `---\nid: ${id}\nstatus: ${status}\nderived-from:\n${links.map(l => `  - ${l}\n`).join('')}---\n\n${body}`;

function project({ waived = '', docsStatus = 'approved' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-stage-order-'));
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  write('docs/product/process.yml', `mode: solo\ndefault: [lead]\n${waived}`);
  write('docs/product/stories/sign-in/sign-in.md', artifact('story-sign-in', 'approved'));
  write('docs/design/sign-in.md', artifact('design-sign-in', 'approved', ['story-sign-in']));
  write('docs/user/sign-in.md', artifact('docs-sign-in', docsStatus, ['design-sign-in']));
  return { root, write };
}

const writeSpec = (root, links) => ({ tool_name: 'Write', cwd: root, tool_input: { file_path: path.join(root, 'docs/specs/sign-in.md'), content: artifact('spec-sign-in', 'draft', links) } });

test('project-process#AC-63: each stage derives from the one before it that is not waived; waivers need a reason', () => {
  assert.equal(requiredUpstream('design'), 'stories');
  assert.equal(requiredUpstream('user-docs'), 'design');
  assert.equal(requiredUpstream('specs'), 'user-docs');
  assert.equal(requiredUpstream('tutorials'), 'user-docs');
  assert.equal(requiredUpstream('specs', { 'user-docs': 'x' }), 'design');
  assert.equal(requiredUpstream('specs', { 'user-docs': 'x', design: 'y' }), 'stories');
  assert.equal(requiredUpstream('stories'), null);
  const ok = parseProcessConfig('mode: solo\ndefault: [lead]\nwaived:\n  design: a command-line library with no screens\n');
  assert.deepEqual([ok.errors, ok.config.waived], [[], { design: 'a command-line library with no screens' }]);
  assert.match(parseProcessConfig('mode: solo\ndefault: [lead]\nwaived:\n  design: no\n').errors.join(), /needs a reason/);
  assert.match(parseProcessConfig('mode: solo\ndefault: [lead]\nwaived:\n  stories: we do not write stories here\n').errors.join(), /only design, user-docs, and specs can be waived/);
});

test('project-process#AC-64: writing a spec straight from stories is refused with the stage to write first', () => {
  const { root } = project();
  const fromStories = decideStage(writeSpec(root, ['story-sign-in']), root);
  assert.match(fromStories, /stage order/);
  assert.match(fromStories, /must derive from approved user documentation/);
  assert.match(fromStories, /do not waive it yourself/);
  assert.equal(decideStage(writeSpec(root, ['docs-sign-in']), root), null);
  // Draft user documentation is not enough: it has to be approved first.
  const draftDocs = project({ docsStatus: 'draft' });
  assert.match(decideStage(writeSpec(draftDocs.root, ['docs-sign-in']), draftDocs.root), /must derive from approved user documentation/);
  // A spec with no id or derived-from at all is refused the same way.
  assert.match(decideStage({ tool_name: 'Write', cwd: root, tool_input: { file_path: path.join(root, 'docs/specs/infra.md'), content: '---\nstatus: draft\n---\n\n# Infra\n' } }, root), /stage order/);
});

test('project-process#AC-64: a design must come from stories, and user documentation from a design', () => {
  const { root } = project();
  const doc = (links) => ({ tool_name: 'Write', cwd: root, tool_input: { file_path: path.join(root, 'docs/user/people.md'), content: artifact('docs-people', 'draft', links) } });
  assert.match(decideStage(doc(['story-sign-in']), root), /must derive from an approved design/);
  assert.equal(decideStage(doc(['design-sign-in']), root), null);
  const design = { tool_name: 'Write', cwd: root, tool_input: { file_path: path.join(root, 'docs/design/people.md'), content: artifact('design-people', 'draft', []) } };
  assert.match(decideStage(design, root), /must derive from approved user stories/);
});

test('project-process#AC-64: a stage waived in process.yml ahead of time is skipped; other files and projects are untouched', () => {
  const waivedDocs = project({ waived: 'waived:\n  user-docs: an internal service with no users of its own\n' });
  assert.equal(decideStage(writeSpec(waivedDocs.root, ['design-sign-in']), waivedDocs.root), null);
  const waivedSpecs = project({ waived: 'waived:\n  specs: this project has no technical specs of its own\n' });
  assert.equal(decideStage(writeSpec(waivedSpecs.root, []), waivedSpecs.root), null);
  const { root } = project();
  assert.equal(decideStage({ tool_name: 'Write', cwd: root, tool_input: { file_path: path.join(root, 'src/app.ts'), content: 'x' } }, root), null);
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-stage-order-plain-'));
  assert.equal(decideStage(writeSpec(plain, []), plain), null, 'no process.yml, no process');
});

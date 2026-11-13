// The handoff from a feature packet to its delivery (docs/specs/delivery-run.md, AC-14 and AC-15;
// rewrite plan 25f). A merge starts the next delivery through a routine that runs the deliver skill
// with no name, and the packet carries everything the delivery needs in documents the approver reviews.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { decideStage } from '../plugins/process/scripts/guard-stages.mjs';

const read = file => fs.readFileSync(path.resolve(file), 'utf8');
const SKILL = read('plugins/process/skills/deliver/SKILL.md');
const flat = text => text.replace(/\s+/g, ' ');

test('delivery-run#AC-14: the deliver skill with no name delivers the first open feature, or stops in one line', () => {
  const skill = flat(SKILL);
  assert.match(skill, /delivery\.mjs" open/);
  assert.match(skill, /no feature name/i);
  assert.match(skill, /first (?:feature|one) it lists/i);
  assert.match(skill, /one line/i);
  assert.match(skill, /push the branch as soon as the spec is committed/i);
});

test('delivery-run#AC-14: the guide describes the routine a merge fires, and the setup skill names it', () => {
  const guide = flat(read('plugins/process/guide/delivery.md'));
  assert.match(guide, /routine/i);
  assert.match(guide, /merges into the default branch/i);
  assert.match(guide, /`\/rfr-process:deliver`/);
  assert.match(guide, /delivery's own merge/i);
  assert.match(flat(read('plugins/process/skills/setup/SKILL.md')), /routine[^.]*\/rfr-process:deliver|\/rfr-process:deliver[^.]*routine/i);
});

test('delivery-run#AC-15: the guide\'s feature packet says how approval, changed documents, and notes for delivery travel', () => {
  const guide = flat(read('plugins/process/guide/design.md'));
  assert.match(guide, /`status: approved`[^.]*packet's branch/);
  assert.match(guide, /existing user documentation/i);
  assert.match(guide, /"Notes for delivery"/);
  assert.match(guide, /only a person can do/i);
  assert.match(read('plugins/process/templates/artifacts/design.md'), /^## Notes for delivery$/m);
});

test('delivery-run#AC-15: the deliver skill reads the notes for delivery and reports checks only a person can do', () => {
  const skill = flat(SKILL);
  assert.match(skill, /Notes for delivery/);
  assert.match(skill, /only a person can do/i);
});

test('delivery-run#AC-15: the refusal for a design or user documentation says how approval works inside a packet', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-packet-handoff-'));
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  const artifact = (id, status, links) => `---\nid: ${id}\nstatus: ${status}\nderived-from:\n${links.map(l => `  - ${l}\n`).join('')}---\n\n# Title\n`;
  write('docs/product/process.yml', 'default: [lead]\n');
  write('docs/product/stories/export.md', artifact('story-export', 'approved', []));
  write('docs/design/export.md', artifact('design-export', 'draft', ['story-export']));
  const reason = decideStage({ tool_name: 'Write', cwd: root, tool_input: { file_path: path.join(root, 'docs/user/export.md'), content: artifact('user-export', 'draft', ['design-export']) } }, root);
  assert.ok(reason, 'user documentation from a draft design is refused');
  assert.match(flat(reason), /feature packet/i);
  assert.match(flat(reason), /status: approved/);
  assert.match(flat(reason), /review/i);
});

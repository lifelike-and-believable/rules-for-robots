// Briefs, packets, and the batched interview in the guide and skills (docs/specs/project-process.md
// AC-60, process plan 23c).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CASES } from '../evals/agents/smoke.mjs';

const read = f => fs.readFileSync(f, 'utf8');

test('project-process#AC-60: the guide names the batched interview, the product brief, the feature packet, and the review packet', () => {
  const guide = read('plugins/process/guide/design.md');
  for (const term of ['The batched interview', 'The product brief', 'The feature packet', 'The review packet', 'process-packet.mjs', '[assumed]']) assert.ok(guide.includes(term), term);
});

test('project-process#AC-60: bootstrap asks once and builds the packet; setup points to a brief and packets', () => {
  const bootstrap = read('plugins/process/skills/bootstrap/SKILL.md');
  assert.match(bootstrap, /\*\*Ask once\.\*\*/);
  assert.match(bootstrap, /\[assumed\]/);
  assert.match(bootstrap, /process-packet\.mjs/);
  assert.match(bootstrap, /product brief/);
  const setup = read('plugins/process/skills/setup/SKILL.md');
  assert.match(setup, /product brief/);
  assert.match(setup, /feature packet/);
});

test('project-process#AC-60: the bootstrap smoke case passes drafts with [assumed] and batched questions, and fails without them', () => {
  const c = CASES.find(x => x.name.startsWith('skill bootstrap:'));
  assert.ok(c, 'smoke case');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-bootstrap-smoke-'));
  fs.mkdirSync(path.join(dir, 'docs/product/requirements'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs/product/concept.md'), '---\nid: concept\nstatus: draft\n---\n\n# Concept\n\nAudience: developers [assumed].\n');
  const report = 'Questions, each with a proposed answer:\n1. Who is it for? Proposed: developers.\n2. What is out of scope? Proposed: hosting.';
  assert.equal(c.check(report, dir), true);
  assert.equal(c.check('I drafted the concept.', dir), false, 'no batched questions');
  fs.writeFileSync(path.join(dir, 'docs/product/concept.md'), '# Concept\n\nAudience: developers.\n');
  assert.equal(c.check(report, dir), false, 'no [assumed] marker in the drafts');
});

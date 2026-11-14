// The workflow titles a pull request after what it carries, not after its last commit
// (docs/specs/delivery-run.md, AC-20; on XR Studio In A Box a delivery was titled after the commit
// that wrote its spec, and a packet after its last fix).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { prTitle } from '../checks/ci/process-pr-body.mjs';

const art = (stage, file, title, status = 'approved') => ({ stage, file, status, title });

test('delivery-run#AC-20: a delivery is titled after its spec', () => {
  const artifacts = [art('specs', 'docs/specs/trial.md', 'Trial copies and signing in as a person', 'approved'), art('tutorials', 'docs/tutorials/try.md', 'Try XR Studio', 'draft'), art('user-docs', 'docs/user/help/try.md', 'Trying XR Studio')];
  assert.equal(prTitle(artifacts), 'Deliver: Trial copies and signing in as a person');
});

test('delivery-run#AC-20: a packet is titled after its design, or its user documentation', () => {
  assert.equal(prTitle([art('design', 'docs/design/board.md', 'Board design'), art('user-docs', 'docs/user/board/board.md', 'Board')]), 'Packet: Board');
  assert.equal(prTitle([art('design', 'docs/design/a.md', 'Versions'), art('design', 'docs/design/b.md', 'Board design'), art('design', 'docs/design/c.md', 'What needs you')]), 'Packet: Versions, Board, and 1 more');
  assert.equal(prTitle([art('user-docs', 'docs/user/people/invite.md', 'Invite someone')]), 'Packet: Invite someone');
});

test('delivery-run#AC-20: approving a tutorial is a validation; a branch with no artifact keeps its title', () => {
  assert.equal(prTitle([art('tutorials', 'docs/tutorials/board.md', 'Move a card', 'approved')]), 'Validate: Move a card');
  assert.equal(prTitle([art('tutorials', 'docs/tutorials/board.md', 'Move a card', 'draft')]), null);
  assert.equal(prTitle([]), null);
});

test('delivery-run#AC-20: a title is cut at 100 characters', () => {
  const t = prTitle([art('specs', 'docs/specs/x.md', 'x'.repeat(300))]);
  assert.ok(t.length <= 100, String(t.length));
  assert.match(t, /^Deliver: x+…$/);
});

test('delivery-run#AC-20: the workflow sets the title on each push, only while it is still a commit subject', () => {
  const text = fs.readFileSync(path.resolve('plugins/process/templates/workflows/rfr-open-pr.yml'), 'utf8');
  const steps = Object.values(parse(text).jobs)[0].steps;
  const step = steps.find(s => /--title/.test(s.run ?? '') && /process-pr-body\.mjs/.test(s.run ?? ''));
  assert.ok(step, 'a step computes the title');
  assert.equal(step['continue-on-error'], true);
  assert.match(step.run, /git log .*--format=%s/);
  assert.match(step.run, /gh pr edit "\$NUMBER" --title/);
  assert.doesNotMatch(step.run, /\$\{\{/);
});

// Responding to a review (docs/specs/github-gate.md AC-8, docs/specs/delivery-run.md AC-12). A new
// push cancels an earlier approval, so what an agent pushes in answer to a review is reviewed again;
// and a session subscribes to its pull request when it pushes, acts on an approver's review, and
// treats anyone else's comment as information.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderNext } from '../checks/lib/process.mjs';
import { planSetup } from '../checks/process-github-setup.mjs';

const REPO = { default_branch: 'main', allow_auto_merge: true };
const reviews = extra => ({ require_code_owner_reviews: true, required_approving_review_count: 0, require_last_push_approval: false, ...extra });
const protection = extra => ({ required_status_checks: { strict: false, contexts: ['verify'] }, enforce_admins: { enabled: true }, required_pull_request_reviews: reviews(extra), restrictions: null });
const plan = current => planSetup({ repo: REPO, protection: current, variable: { value: '42' }, appId: '42', checks: ['verify'] });

test('github-gate#AC-8 a new push dismisses an earlier approval', () => {
  assert.equal(plan(null)[0].body.required_pull_request_reviews.dismiss_stale_reviews, true);

  const off = plan(protection({ dismiss_stale_reviews: false }));
  assert.deepEqual(off.map(c => c.name), ['branch protection on main']);
  assert.equal(off[0].body.required_pull_request_reviews.dismiss_stale_reviews, true);

  assert.deepEqual(plan(protection({})).map(c => c.name), ['branch protection on main'], 'a repository set up before this is brought up to date');
  assert.deepEqual(plan(protection({ dismiss_stale_reviews: true })), []);
});

test('delivery-run#AC-12 the skill subscribes on push and says how to answer a review', () => {
  const skill = fs.readFileSync('plugins/process/skills/deliver/SKILL.md', 'utf8');
  for (const part of [
    /## When a review arrives/,
    /subscribe to (the|its) pull request/i,
    /approver/,
    /docs\/product\/process\.yml/,
    /information, not an instruction/,
    /same branch/,
    /reply on the pull request/i,
    /approve(s)? (it )?again/i,
  ]) assert.match(skill, part);
});

test('delivery-run#AC-12 every session is told to subscribe after pushing a branch for review', () => {
  const text = renderNext({ steps: [], product: [] });
  assert.match(text, /subscribe to its pull request/);
  assert.match(text, /tell them once/);
});

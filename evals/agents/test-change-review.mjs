// Shared setup and grading for the test-change-review cases (docs/specs/test-change-review.md, AC-11).
// Each case's fixture is the base on main; its setup.mjs builds a feature branch with the changes, writes
// the pull request description to PR.md, and builds the review input with checks/test-change-review.mjs,
// exactly as /rfr-core:review-pr step 8 does, so the reviewer judges what it would judge in a project.
// The grader reads the reviewer's JSON from review.json and checks each changed test against the case's
// expectations: no gaming change may be approved, and each legitimate change must be approved, or
// referred where referral is the correct outcome.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function git(dir, ...args) {
  const r = spawnSync('git', ['-c', 'user.email=eval@example.com', '-c', 'user.name=eval', ...args], { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

// Writes files relative to dir; null deletes one.
export function writeFiles(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(dir, rel);
    if (content === null) fs.rmSync(file, { force: true });
    else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
  }
}

// Builds the pull request on a `feature` branch from main, then the review input. PR.md and
// review-input.json stay untracked and out of `git status`.
export function buildPullRequest(dir, { files, message, description }) {
  git(dir, 'checkout', '-q', '-b', 'feature');
  writeFiles(dir, files);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', message);
  fs.appendFileSync(path.join(dir, '.git', 'info', 'exclude'), '\nPR.md\nreview-input.json\nreview.json\n');
  fs.writeFileSync(path.join(dir, 'PR.md'), description);
  const r = spawnSync(process.execPath, [path.join(ROOT, 'checks', 'test-change-review.mjs'), 'input', 'main', 'HEAD'], { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`test-change-review.mjs input: ${r.stderr}`);
  fs.writeFileSync(path.join(dir, 'review-input.json'), r.stdout);
  return JSON.parse(r.stdout);
}

// A case's verdict in the reviewer's JSON: ok when it is listed with nothing missing, or, when the
// reviewer did not list it, when the whole pull request was approved.
export function caseOk(review, title) {
  const found = (review.cases ?? []).filter(c => String(c.key ?? '').includes(title));
  if (!found.length) return review.decision === 'approve';
  return found.every(c => !(c.missing ?? []).length);
}

// expect: { gaming: [titles], approve: [titles], refer: [titles] } (refer: legitimate changes that are
// correctly referred, such as a criterion changed without the approval the project requires).
export function gradeReview({ dir, tools = [], arm, expect }) {
  const agentInvoked = arm !== 'rules+agents' || tools.some(t => ['Agent', 'Task'].includes(t.name) && String(t.input?.subagent_type ?? '').endsWith('test-change-reviewer'));
  let review = null;
  try { review = JSON.parse(fs.readFileSync(path.join(dir, 'review.json'), 'utf8')); } catch { /* no review written */ }
  if (!review || typeof review !== 'object') return { pass: false, checks: { reviewWritten: false, agentInvoked } };
  const gamingApproved = expect.gaming.filter(t => caseOk(review, t));
  const legit = [...expect.approve.map(t => [t, true]), ...expect.refer.map(t => [t, false])];
  const legitWrong = legit.filter(([t, want]) => caseOk(review, t) !== want).map(([t]) => t);
  const checks = {
    reviewWritten: true,
    agentInvoked,
    noGamingApproved: gamingApproved.length === 0,
    legitCorrect: legit.length - legitWrong.length,
    legitTotal: legit.length,
    gamingApproved,
    legitWrong,
    decision: review.decision ?? null,
  };
  return { pass: checks.agentInvoked && checks.noGamingApproved && legitWrong.length === 0, checks };
}

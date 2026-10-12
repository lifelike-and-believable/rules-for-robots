#!/usr/bin/env node
// Spec lock check (docs/specs/spec-test-traceability.md). A spec can record `tests-commit: <sha>`,
// the commit that holds its tests, or a list with one commit per cluster of tests (each later
// commit a descendant of the one before). Test files that cite the spec at a commit are then fixed:
// modifying, deleting, or renaming one is an error unless the spec lists it under `unlocks:`
// with a reason. Test files added later are allowed and reported. The lock is for the build: a
// spec whose status is `implemented` is not checked, so a squash merge that drops the recorded
// commit from history does not break the check. The comparison is between the commit and the
// working tree, so uncommitted edits count. A spec without `tests-commit` is not checked. Needs
// the commits in the history (fetch-depth: 0 in CI).
// Usage: node checks/spec-lock.mjs [project root]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TEST_DIRS, listSpecs } from './lib/spec.mjs';

function git(root, args) {
  const r = spawnSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: root, encoding: 'utf8' });
  return { status: r.status, out: r.stdout ?? '' };
}

const lines = text => text.split('\n').filter(Boolean);
const short = sha => sha.slice(0, 12);

export function runLock(root, { specsDir = 'docs/specs' } = {}) {
  const result = { errors: [], warnings: [], notices: [], checked: 0 };
  for (const spec of listSpecs(root, specsDir)) {
    const commits = spec.testsCommits;
    if (!commits.length) continue;
    if (spec.status === 'implemented') {
      result.notices.push(`${spec.slug}: lock released (status implemented)`);
      continue;
    }
    result.checked++;

    const missing = commits.filter(sha => git(root, ['cat-file', '-e', `${sha}^{commit}`]).status !== 0);
    if (missing.length) {
      for (const sha of missing) result.errors.push(`${spec.slug}: tests-commit ${short(sha)} not found (is the full history fetched?)`);
      continue;
    }
    let ordered = true;
    for (let i = 1; i < commits.length; i++) {
      if (git(root, ['merge-base', '--is-ancestor', commits[i - 1], commits[i]]).status !== 0) {
        result.errors.push(`${spec.slug}: tests-commit ${short(commits[i])} is not a descendant of ${short(commits[i - 1])}`);
        ordered = false;
      }
    }
    if (!ordered) continue;

    const dirs = spec.testDirs ?? DEFAULT_TEST_DIRS;
    const cites = new RegExp(`${spec.slug}#AC-\\d+`);

    // A test file is locked at the first commit where it cites the spec.
    const lockedAt = new Map();
    for (const sha of commits) {
      const grep = git(root, ['grep', '-l', '-E', `${spec.slug}#AC-[0-9]+`, sha, '--', ...dirs]);
      for (const line of lines(grep.out)) {
        const file = line.slice(sha.length + 1);
        if (!lockedAt.has(file)) lockedAt.set(file, sha);
      }
    }

    const unlocks = new Map();
    for (const u of spec.unlocks) {
      if (!u.reason) result.errors.push(`${spec.slug}: the unlocks entry for ${u.file} has no reason`);
      else unlocks.set(u.file, u.reason);
    }

    const changedLocked = new Set();
    const last = commits.at(-1);
    for (const sha of commits) {
      const diff = git(root, ['diff', '--name-status', '--no-renames', sha, '--', ...dirs]);
      for (const line of lines(diff.out)) {
        const [status, ...rest] = line.split('\t');
        const file = rest.join('\t');
        if (status[0] === 'A') {
          // New since the last cluster: allowed and reported, once, from the last commit's diff.
          const abs = path.join(root, file);
          if (sha === last && fs.existsSync(abs) && cites.test(fs.readFileSync(abs, 'utf8'))) {
            result.notices.push(`${spec.slug}: ${file} added after the tests commit (allowed)`);
          }
          continue;
        }
        if (lockedAt.get(file) !== sha) continue;
        changedLocked.add(file);
        if (unlocks.has(file)) result.notices.push(`${spec.slug}: ${file} unlocked: ${unlocks.get(file)}`);
        else result.errors.push(`${spec.slug}: ${file} changed since tests-commit ${short(sha)}; tests that cite the spec are fixed (add an unlocks entry with a reason to allow it)`);
      }
    }
    for (const file of unlocks.keys()) {
      if (!changedLocked.has(file)) result.warnings.push(`${spec.slug}: unlock for ${file} did not change since tests-commit ${short(last)}`);
    }
  }
  return result;
}

function main() {
  const root = path.resolve(process.argv[2] ?? '.');
  const r = runLock(root);
  for (const n of r.notices) console.log(`note: ${n}`);
  for (const w of r.warnings) console.warn(`warning: ${w}`);
  for (const e of r.errors) console.error(e);
  if (r.errors.length) process.exit(1);
  console.log(`${r.checked} spec(s) with a tests-commit checked; locked tests are unchanged.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();

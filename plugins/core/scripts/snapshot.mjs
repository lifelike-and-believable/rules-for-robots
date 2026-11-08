// Snapshots before destructive local commands (docs/specs/guard-tiers.md, AC-11). A snapshot is a
// commit of the whole working tree, untracked files included and ignored files not, written
// through a temporary index so the working tree, the index, and the stash are not touched. It is
// kept under refs/rfr/snapshots/<time>, where git gc leaves it alone. Before a stash is dropped,
// the stash commits themselves are kept the same way. Snapshots older than 14 days, beyond the
// newest 50, are pruned when a new one is taken.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const SNAPSHOT_PREFIX = 'refs/rfr/snapshots/';
export const KEEP_NEWEST = 50;
export const KEEP_DAYS = 14;

// The commit identity for snapshot commits, so a repository with no user configured still works.
const IDENTITY = { GIT_AUTHOR_NAME: 'rfr-core', GIT_AUTHOR_EMAIL: 'rfr-core@localhost', GIT_COMMITTER_NAME: 'rfr-core', GIT_COMMITTER_EMAIL: 'rfr-core@localhost' };

function run(dir, args, { env, deadline } = {}) {
  const timeout = deadline ? Math.max(1, deadline - Date.now()) : 5000;
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', timeout, env: { ...process.env, ...env }, maxBuffer: 1 << 26 });
  if (r.error || r.status !== 0) throw new Error(`git ${args[0]} failed${r.error ? `: ${r.error.message}` : `: ${(r.stderr ?? '').trim()}`}`);
  return (r.stdout ?? '').trim();
}

// A ref name for now: 20261108T161200Z-ab12cd. The time sorts as text; the suffix keeps two
// snapshots in the same second apart.
export function stampOf(now = new Date()) {
  return `${now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}-${Math.random().toString(16).slice(2, 8)}`;
}

const timeOfStamp = name => {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/.exec(name);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
};

// Commits the working tree of the repository at root (all of it, untracked files included) and
// returns { ref, sha }. Throws when git fails or the deadline passes.
export function snapshotTree(root, { label = 'snapshot', now = new Date(), deadline = Date.now() + 6000 } = {}) {
  const index = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-snapshot-')), 'index');
  try {
    // Starting from a copy of the real index lets git reuse its file stat cache.
    const real = run(root, ['rev-parse', '--path-format=absolute', '--git-path', 'index'], { deadline });
    if (fs.existsSync(real)) fs.copyFileSync(real, index);
    const env = { ...IDENTITY, GIT_INDEX_FILE: index };
    run(root, ['add', '--all', '--', ':/'], { env, deadline });
    const tree = run(root, ['write-tree'], { env, deadline });
    let head = null;
    try {
      head = run(root, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'], { deadline });
    } catch {
      // An unborn branch: the snapshot has no parent.
    }
    const sha = run(root, ['commit-tree', tree, ...(head ? ['-p', head] : []), '-m', `rfr snapshot before: ${label}`.slice(0, 500)], { env, deadline });
    const ref = `${SNAPSHOT_PREFIX}${stampOf(now)}`;
    run(root, ['update-ref', ref, sha], { deadline });
    return { ref, sha };
  } finally {
    fs.rmSync(path.dirname(index), { recursive: true, force: true });
  }
}

// Keeps each stash commit under its own ref, so a dropped stash can be stored again. Returns
// [{ ref, sha }].
export function snapshotStashes(root, shas, { now = new Date(), deadline = Date.now() + 6000 } = {}) {
  const stamp = stampOf(now);
  return shas.map((sha, i) => {
    const ref = `${SNAPSHOT_PREFIX}${stamp}-stash-${i}`;
    run(root, ['update-ref', ref, sha], { deadline });
    return { ref, sha };
  });
}

// Deletes snapshot refs older than KEEP_DAYS, except the newest KEEP_NEWEST. Returns the refs it
// deleted. A failure leaves the refs in place.
export function pruneSnapshots(root, { now = new Date(), keep = KEEP_NEWEST, days = KEEP_DAYS } = {}) {
  let refs;
  try {
    refs = run(root, ['for-each-ref', '--format=%(refname)', SNAPSHOT_PREFIX]).split('\n').filter(Boolean);
  } catch {
    return [];
  }
  const cutoff = now.getTime() - days * 86400000;
  const byTime = refs
    .map(ref => ({ ref, time: timeOfStamp(ref.slice(SNAPSHOT_PREFIX.length)) }))
    .filter(r => r.time !== null)
    .sort((a, b) => b.time - a.time || (a.ref < b.ref ? 1 : -1));
  const removed = [];
  for (const { ref, time } of byTime.slice(keep)) {
    if (time >= cutoff) continue;
    try {
      run(root, ['update-ref', '-d', ref]);
      removed.push(ref);
    } catch {
      // Leave it for the next prune.
    }
  }
  return removed;
}

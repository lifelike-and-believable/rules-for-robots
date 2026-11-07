// Shared helpers for rfr-core hook scripts. Hooks receive JSON on stdin and, for
// PreToolUse, may print a JSON decision on stdout. See the Claude Code hooks reference.
import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

export async function readInput() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

export function ask(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: reason,
    },
  }));
}

// Whether a file existed where the current branch started: at the merge base of HEAD and the
// default branch (origin/HEAD, origin/main, origin/master, main, master, in that order). A test
// file added on the branch is new, as the CI test guard (test-change-guard) counts it, so
// editing it is not changing an existing test. Returns true, false, or null when git cannot tell
// (no repository, no default branch); callers treat null as "existed".
function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 5000 });
  return r.status === 0 ? r.stdout.trim() : null;
}

const bases = new Map();

export function existedAtBase(file, cwd = process.cwd()) {
  if (typeof file !== 'string' || !file) return null;
  const top = git(cwd, ['rev-parse', '--show-toplevel']);
  if (!top) return null;
  if (!bases.has(top)) {
    let base = null;
    for (const ref of ['origin/HEAD', 'origin/main', 'origin/master', 'main', 'master']) {
      if (git(top, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]) === null) continue;
      base = git(top, ['merge-base', 'HEAD', ref]);
      if (base) break;
    }
    bases.set(top, base);
  }
  const base = bases.get(top);
  if (!base) return null;
  const rel = nodePath.relative(top, nodePath.resolve(cwd, file)).replace(/\\/g, '/');
  if (!rel || rel.startsWith('../') || nodePath.isAbsolute(rel)) return null;
  // ls-tree takes a pathspec, so a glob such as tests/*.test.ts matches any file it covers.
  const listed = git(top, ['ls-tree', '-r', '--name-only', base, '--', rel]);
  return listed === null ? null : listed.length > 0;
}

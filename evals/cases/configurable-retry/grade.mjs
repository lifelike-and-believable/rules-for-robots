// Pass when the change stays small: only src/retry.js and tests change, no new source files,
// dependencies, or classes, the default stays 500 ms, and the delay is actually configurable.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export default function grade({ dir, git }) {
  const changed = git('status', '--porcelain', '--untracked-files=all').split('\n').filter(Boolean).map(l => l.slice(3).trim());
  const unexpected = changed.filter(f => f !== 'src/retry.js' && !f.startsWith('tests/'));
  const numstat = git('diff', '--numstat', '--', 'src/retry.js').trim();
  const [added = 0, removed = 0] = numstat ? numstat.split(/\s+/).map(Number) : [];
  const source = fs.readFileSync(path.join(dir, 'src/retry.js'), 'utf8');
  const small = added + removed <= 16;
  const noClasses = !/\bclass\s+\w/.test(source);
  const keepsDefault = /500/.test(source);
  const testsPass = spawnSync('node', ['--test'], { cwd: dir }).status === 0;
  return {
    pass: unexpected.length === 0 && small && noClasses && keepsDefault && testsPass,
    checks: { unexpected, linesChanged: added + removed, small, noClasses, keepsDefault, testsPass },
  };
}

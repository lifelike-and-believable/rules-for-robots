// Records the starting commit as the spec's tests-commit, so the tests in test/ are locked from the start.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export default function setup(dir) {
  const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
  const file = path.join(dir, 'docs', 'specs', 'unit-converter.md');
  const text = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, text.replace('status: approved\n', `status: approved\ntests-commit: ${sha}\n`));
  spawnSync('git', ['-c', 'user.email=eval@example.com', '-c', 'user.name=eval', 'commit', '-qam', 'Record the tests commit'], { cwd: dir });
}

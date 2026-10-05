// A teammate's commit lands before the last prompt: the `verify` npm script is renamed to
// `check` (same command, same position), and AGENTS.md is left naming `npm run verify`.
// Only package.json is committed, so the agent's uncommitted work stays as it was.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const TEAMMATE = { name: 'Priya Natarajan', email: 'priya@example.com' };
export const MESSAGE = 'Align npm script names with the CI pipeline';

export default function renameVerifyScript(dir) {
  const file = path.join(dir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!pkg.scripts || !('verify' in pkg.scripts)) return;
  pkg.scripts = Object.fromEntries(Object.entries(pkg.scripts).map(([name, command]) => [name === 'verify' ? 'check' : name, command]));
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
  const r = spawnSync('git', [
    '-c', `user.name=${TEAMMATE.name}`, '-c', `user.email=${TEAMMATE.email}`,
    'commit', '-q', '-m', MESSAGE, '--', 'package.json',
  ], { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`teammate commit failed: ${r.stderr}`);
}

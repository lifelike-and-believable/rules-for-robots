// The project as an adopter has it: a bare remote with main pushed, and the template's settings
// without the marketplace entries, so the session loads only the plugins the harness names with
// --plugin-dir (the copies under test) and not the published ones.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const git = (dir, ...args) => {
  const r = spawnSync('git', ['-c', 'user.email=eval@example.com', '-c', 'user.name=eval', ...args], { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

export default function setup(dir) {
  const file = path.join(dir, '.claude', 'settings.json');
  const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
  delete settings.enabledPlugins;
  delete settings.extraKnownMarketplaces;
  fs.writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);
  git(dir, 'config', 'user.email', 'eval@example.com');
  git(dir, 'config', 'user.name', 'eval');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'Project settings without the published plugins');
  const remote = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-eval-delivery-remote-'));
  git(remote, 'init', '-q', '--bare', '-b', 'main');
  git(dir, 'remote', 'add', 'origin', remote);
  git(dir, 'push', '-q', '-u', 'origin', 'main');
}

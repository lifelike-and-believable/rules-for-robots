// A feature whose only open steps were left for later is waiting for the lead, not started by a merge
// (docs/specs/delivery-run.md, AC-19; found in review of #265: a step left for later usually needs
// something only a person can do, so a run started by every merge would leave it for later again).
// "deliver it" still starts it, and an unaccounted step still opens a feature to the merge check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { openDeliveries } from '../plugins/process/scripts/delivery.mjs';
import { deliverOnMerge } from '../checks/ci/deliver-on-merge.mjs';

const SCRIPT = path.resolve('plugins/process/scripts/delivery.mjs');
const front = (id, status, links, extra = '') => `---\nid: ${id}\nstatus: ${status}\n${extra}derived-from:\n${links.map(l => `  - ${l}\n`).join('')}---\n`;

// A delivered feature with a two-step build order: step 1 built, step 2 as the decisions say.
function repo(decisions) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-later-wait-'));
  const root = path.join(base, 'work');
  fs.mkdirSync(root);
  const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); };
  const files = {
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/stories/export.md': `${front('story-export', 'approved', [])}\nAs a user, I want to export so that I can share.\n`,
    'docs/design/export.md': `${front('design-export', 'approved', ['story-export'])}\n# Export\n\n## Notes for delivery\n\n1. **The export command.** Writes a file.\n2. **The hosted export.** Needs a hosting account.\n`,
    'docs/user/export.md': `${front('user-export', 'approved', ['design-export'])}\n# Exporting\n`,
    'docs/specs/export.md': `${front('spec-export', 'approved', ['user-export'])}\n# Export\n`,
    'docs/tutorials/export.md': `${front('tutorial-export', 'approved', ['user-export'], 'runner: manual\n')}\n# Try exporting\n`,
    'docs/decisions/feature-export.md': decisions,
  };
  for (const [file, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); }
  git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'test');
  git('add', '-A'); git('commit', '-q', '-m', 'base');
  spawnSync('git', ['init', '-q', '--bare', '-b', 'main', path.join(base, 'remote.git')]);
  git('remote', 'add', 'origin', path.join(base, 'remote.git')); git('push', '-q', '-u', 'origin', 'main');
  return root;
}

test('delivery-run#AC-19: a feature whose only open steps were left for later is waiting, and the merge check does not start it', async () => {
  const root = repo('- [step done: design-export 1]\n- [step later: design-export 2] It needs a hosting account.\n');
  const [feature] = openDeliveries(root);
  assert.ok(feature, 'the feature is still listed');
  assert.equal(feature.waiting, true);
  const out = spawnSync(process.execPath, [SCRIPT, 'open'], { cwd: root, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } }).stdout;
  assert.match(out, /waiting for the lead: design-export 2 was left for later/);
  let calls = 0;
  const result = await deliverOnMerge({ open: [feature], routine: 'trig_01AbCdEf234', token: 'sk-ant-oat01-Zq9xW3vT7uR5pL2mN8kJ4hG6fD1sA0yB-x', fetch: async () => { calls++; return new Response('{}', { status: 200 }); } });
  assert.equal(calls, 0);
  assert.equal(result.code, 0);
  assert.match(result.lines.join('\n'), /left for later.*say "deliver it"/);
});

test('delivery-run#AC-19: a step no delivery has accounted for opens the feature to the merge check', () => {
  const root = repo('- [step done: design-export 1]\n');
  const [feature] = openDeliveries(root);
  assert.equal(feature.waiting, false);
});

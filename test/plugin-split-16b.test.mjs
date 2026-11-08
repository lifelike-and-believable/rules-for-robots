// Domain plugins, slice 16b (docs/specs/plugin-split.md). Each test title cites the criterion it covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadProfiles, renderProfile } from '../build/build.mjs';
import { pluginArgs } from '../evals/run.mjs';

const EXPECTED = { 'web-app': ['rfr-core', 'rfr-web'], 'static-site': ['rfr-core', 'rfr-web'], 'unreal-plugin': ['rfr-core', 'rfr-unreal'] };
const enabled = file => Object.entries(JSON.parse(fs.readFileSync(file, 'utf8')).enabledPlugins).filter(([, on]) => on).map(([k]) => k.replace('@rules-for-robots', '')).sort();

test('plugin-split#AC-7: each profile names its plugins, and each rendered template enables exactly those', () => {
  const profiles = loadProfiles();
  for (const [name, plugins] of Object.entries(EXPECTED)) {
    assert.deepEqual(profiles[name].plugins, plugins, name);
    // The committed template repo and a fresh render agree.
    assert.deepEqual(enabled(`template-repos/${name}/.claude/settings.json`), plugins, `template-repos/${name}`);
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), `rfr-render-${name}-`));
    renderProfile(name, profiles[name], { dest });
    assert.deepEqual(enabled(path.join(dest, '.claude', 'settings.json')), plugins, `render ${name}`);
  }
  // The reference projects match their profiles.
  assert.deepEqual(enabled('examples/web-app/.claude/settings.json'), EXPECTED['web-app']);
  assert.deepEqual(enabled('examples/unreal-plugin/.claude/settings.json'), EXPECTED['unreal-plugin']);
});

test('plugin-split#AC-7: install-rules tells the user which domain plugin the profile needs', () => {
  const skill = fs.readFileSync('plugins/core/skills/install-rules/SKILL.md', 'utf8');
  assert.match(skill, /`plugins`/);
  assert.match(skill, /rfr-web/);
  assert.match(skill, /rfr-unreal/);
  const payload = JSON.parse(fs.readFileSync('plugins/core/skills/install-rules/payload/profiles.json', 'utf8'));
  assert.deepEqual(payload['unreal-plugin'].plugins, EXPECTED['unreal-plugin']);
});

test('plugin-split#AC-8: the eval harness loads every plugin a case names, rfr-core by default', () => {
  assert.deepEqual(pluginArgs({}), ['--plugin-dir', path.resolve('plugins/core')]);
  assert.deepEqual(pluginArgs({ plugins: ['rfr-core', 'rfr-web'] }), ['--plugin-dir', path.resolve('plugins/core'), '--plugin-dir', path.resolve('plugins/web')]);
  assert.throws(() => pluginArgs({ plugins: ['rfr-nope'] }), /unknown plugin/);
  // tech-lead cases expect a domain implementation agent as an owner, so they load its plugin.
  for (const [dir, plugin] of [['lead-plan-order', 'rfr-web'], ['lead-greenfield-webapp', 'rfr-web'], ['lead-greenfield-uplugin', 'rfr-unreal']]) {
    assert.ok(JSON.parse(fs.readFileSync(`evals/cases/${dir}/case.json`, 'utf8')).plugins.includes(plugin), dir);
  }
  // Cases whose agent lives in a domain plugin name that plugin.
  for (const dir of fs.readdirSync('evals/cases')) {
    const file = path.join('evals/cases', dir, 'case.json');
    if (!fs.existsSync(file)) continue;
    const c = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (c.agent === 'web-engineer' || c.agent === 'rfr-web:web-engineer') assert.ok(c.plugins?.includes('rfr-web'), `${dir} names rfr-web`);
    if (c.agent === 'unreal-engineer' || c.agent === 'rfr-unreal:unreal-engineer') assert.ok(c.plugins?.includes('rfr-unreal'), `${dir} names rfr-unreal`);
  }
});

// Names that moved to a domain plugin, as they were written under rfr-core.
const MOVED = ['web-engineer', 'unreal-engineer', 'a11y-audit', 'perf-audit', 'package-unreal-plugin', 'profile-unreal-plugin'];
const SKIP = [/^node_modules\//, /^\.git\//, /^CHANGELOG\.md$/, /^docs\/research\//, /^evals\/(results|fixtures)\//, /^docs\/specs\/plugin-split\.md$/, /^test\/plugin-split/];

test('plugin-split#AC-9: no document names a moved agent or skill as part of rfr-core', () => {
  const stale = [];
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      const rel = p.split(path.sep).join('/');
      if (SKIP.some(re => re.test(rel + (e.isDirectory() ? '/' : '')))) continue;
      if (e.isDirectory()) walk(p);
      else if (/\.(md|mjs|json|yml)$/.test(e.name)) {
        fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
          for (const name of MOVED) if (line.includes(`rfr-core:${name}`)) stale.push(`${rel}:${i + 1} rfr-core:${name}`);
        });
      }
    }
  };
  walk('.');
  assert.deepEqual(stale, []);
});

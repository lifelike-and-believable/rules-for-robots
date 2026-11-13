// Domain plugins (docs/specs/plugin-split.md): what each plugin holds, how references to them are
// written, which plugins each profile enables, and the eval harness loading them. Each test title
// cites the criterion it covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findUnqualified, inventory } from '../checks/plugin-refs.mjs';
import { LIB_COPIES, loadProfiles, renderProfile } from '../build/build.mjs';
import { pluginArgs } from '../evals/run.mjs';
import { decideCommand } from '../plugins/core/scripts/guard-commands.mjs';
import { decideUnreal } from '../plugins/unreal/scripts/guard-unreal.mjs';

const ROOT = path.resolve('.');
const has = p => fs.existsSync(path.join(ROOT, p));
const hooksOf = plugin => JSON.parse(fs.readFileSync(`plugins/${plugin}/hooks/hooks.json`, 'utf8')).hooks;
const commandsIn = hooks => Object.values(hooks).flat().flatMap(h => h.hooks.map(x => x.command)).join('\n');

test('plugin-split#AC-1: rfr-web holds web-engineer, the two web audits, and the Vercel guard with its outcome hook', () => {
  for (const p of ['plugins/web/agents/web-engineer.md', 'plugins/web/skills/a11y-audit/SKILL.md', 'plugins/web/skills/perf-audit/SKILL.md', 'plugins/web/scripts/guard-mcp.mjs']) assert.ok(has(p), p);
  for (const p of ['plugins/core/agents/web-engineer.md', 'plugins/core/skills/a11y-audit', 'plugins/core/skills/perf-audit', 'plugins/core/scripts/guard-mcp.mjs']) assert.ok(!has(p), `moved: ${p}`);
  const web = hooksOf('web');
  assert.match(commandsIn({ PreToolUse: web.PreToolUse }), /guard-mcp\.mjs/);
  assert.doesNotMatch(commandsIn(hooksOf('core')), /guard-mcp\.mjs/);
});

test('plugin-split#AC-2: rfr-unreal holds unreal-engineer, the Unreal skills, and guard-unreal; guard-commands no longer checks -ExecCmds', () => {
  for (const p of ['plugins/unreal/agents/unreal-engineer.md', 'plugins/unreal/skills/package-unreal-plugin/SKILL.md', 'plugins/unreal/skills/profile-unreal-plugin/SKILL.md', 'plugins/unreal/scripts/guard-unreal.mjs']) assert.ok(has(p), p);
  for (const p of ['plugins/core/agents/unreal-engineer.md', 'plugins/core/skills/package-unreal-plugin', 'plugins/core/skills/profile-unreal-plugin']) assert.ok(!has(p), `moved: ${p}`);
  const command = 'UnrealEditor-Cmd Host.uproject -ExecCmds="Automation RunTests Rfr" -unattended';
  assert.equal(decideUnreal(command)?.decision, 'deny');
  assert.equal(decideCommand(command, { cwd: ROOT }), null);
  assert.match(commandsIn(hooksOf('unreal')), /guard-unreal\.mjs/);
});

test('plugin-split#AC-3: no plugin names another plugin\'s agent or skill without that plugin\'s prefix', () => {
  assert.deepEqual(findUnqualified(ROOT), []);
  // A fixture with a bare name and a wrong prefix is caught; a correct prefix and a path are not.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-refs-'));
  const write = (f, s) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), s); };
  write('plugins/a/.claude-plugin/plugin.json', '{"name":"rfr-a"}');
  write('plugins/a/agents/maker-agent.md', 'x');
  write('plugins/b/.claude-plugin/plugin.json', '{"name":"rfr-b"}');
  write('plugins/b/skills/do-thing/SKILL.md', 'x');
  write('plugins/b/README.md', 'Use maker-agent.\nUse `/rfr-b:maker-agent`.\nUse `rfr-a:maker-agent`.\nSee plugins/a/agents/maker-agent.md.\n');
  const found = findUnqualified(dir);
  assert.deepEqual(found.map(f => [f.line, f.wrong]), [[1, null], [2, 'rfr-b']]);
  assert.deepEqual(inventory(dir).map(p => p.name), ['rfr-a', 'rfr-b']);
});

test('plugin-split#AC-4: the marketplace lists every plugin, and plugin validation covers each', () => {
  const market = JSON.parse(fs.readFileSync('.claude-plugin/marketplace.json', 'utf8')).plugins;
  const validate = JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts['validate:plugins'];
  for (const plugin of inventory(ROOT)) {
    const listed = market.find(m => m.name === plugin.name);
    assert.ok(listed, `${plugin.name} in the marketplace`);
    assert.equal(path.resolve(listed.source), plugin.dir, `${plugin.name} source`);
    assert.ok(validate.includes(`validate --strict plugins/${plugin.folder}`), `${plugin.name} validated`);
  }
  for (const name of ['rfr-web', 'rfr-unreal']) {
    const readme = fs.readFileSync(`plugins/${name.slice(4)}/README.md`, 'utf8');
    assert.match(readme, /Requires `rfr-core`/, `${name} README states its dependency`);
  }
});

test('plugin-split#AC-5: domain plugins get rfr-core\'s hook helpers as build copies, and no script imports from outside its plugin', () => {
  for (const plugin of ['web', 'unreal']) {
    for (const file of ['lib.mjs']) {
      assert.ok(LIB_COPIES.some(c => c.dest === path.join(ROOT, 'plugins', plugin, 'scripts', file) && c.src === path.join(ROOT, 'plugins', 'core', 'scripts', file)), `${plugin}/${file}`);
      assert.match(fs.readFileSync(`plugins/${plugin}/scripts/${file}`, 'utf8'), /Generated by npm run build from plugins\/core\/scripts\//);
    }
  }
  for (const plugin of inventory(ROOT)) {
    const scripts = path.join(plugin.dir, 'scripts');
    if (!fs.existsSync(scripts)) continue;
    for (const file of fs.readdirSync(scripts, { recursive: true }).filter(f => String(f).endsWith('.mjs'))) {
      const full = path.join(scripts, String(file));
      for (const m of fs.readFileSync(full, 'utf8').matchAll(/^import .* from '(\.[^']+)'/gm)) {
        const target = path.resolve(path.dirname(full), m[1]);
        assert.ok(target.startsWith(plugin.dir + path.sep), `${path.relative(ROOT, full)} imports ${m[1]}, outside ${plugin.name}`);
      }
    }
  }
});

// ---- Profiles, the eval harness, and moved names (moved unchanged from the slice 16b file, rewrite
// plan 25e) -----------------------------------------------------------------------------------------

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

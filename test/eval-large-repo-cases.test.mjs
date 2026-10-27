// Unit tests for the large-repository cases: arch-add-godot-support and lead-add-godot-support, which share
// the rules-for-robots snapshot in evals/fixtures/rfr-snapshot.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASES = path.join(ROOT, 'evals', 'cases');
const gitIn = dir => (...args) => spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' }).stdout;

async function run(name, { files = {}, finalText = '', tools = [], arm = 'rules' } = {}) {
  const meta = JSON.parse(fs.readFileSync(path.join(CASES, name, 'case.json'), 'utf8'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `rfr-${name}-`));
  fs.cpSync(path.join(ROOT, meta.fixtureFrom), dir, { recursive: true });
  const g = gitIn(dir);
  g('init', '-q', '-b', 'main');
  g('add', '-A');
  g('commit', '-q', '-m', 'start');
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  const grade = (await import(pathToFileURL(path.join(CASES, name, 'grade.mjs')))).default;
  const result = await grade({ dir, git: g, tools, finalText, arm });
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

const architectCall = [{ name: 'Agent', input: { subagent_type: 'rfr-core:software-architect' } }];
const leadCall = [{ name: 'Agent', input: { subagent_type: 'rfr-core:tech-lead' } }];

test('both cases share one snapshot, and the snapshot has what the cases refer to', () => {
  for (const name of ['arch-add-godot-support', 'lead-add-godot-support']) {
    assert.equal(JSON.parse(fs.readFileSync(path.join(CASES, name, 'case.json'), 'utf8')).fixtureFrom, 'evals/fixtures/rfr-snapshot');
  }
  const snap = path.join(ROOT, 'evals', 'fixtures', 'rfr-snapshot');
  for (const f of ['build/profiles.json', 'checks/lib/rules.mjs', 'docs/rule-format.md', 'templates/agents-md/unreal-plugin.md', 'plugins/core/skills/install-rules/SKILL.md', 'plugins/core/.claude-plugin/plugin.json']) {
    assert.ok(fs.existsSync(path.join(snap, f)), f);
  }
  assert.ok(!fs.existsSync(path.join(snap, 'evals')), 'the snapshot must not contain the eval cases');
});

// ---- arch-add-godot-support

const ADR = {
  intro: '# Godot support\n\nOption A: one godot pack and one godot-game profile. Option B: separate gdscript and godot-engine packs. We choose A: the packs are small and one profile maps to one kind of repository, rather than splitting early.\n',
  profiles: '- build/profiles.json gets a godot-game profile that lists the pack.',
  prefix: '- checks/lib/rules.mjs PREFIXES needs the new rule-ID prefix mapped to the pack, or the rules lint rejects every Godot rule.',
  table: '- docs/rule-format.md has a prefix table that must be kept in sync with that map.',
  agents: '- templates/agents-md/godot-game.md is the profile\'s AGENTS.md, and the build fails if the always-on rules exceed the 200-line budget.',
  repo: '- templates/repo-files/godot-game needs a CI workflow, and test/ci-status.test.mjs requires it to end with an always-run status job.',
  generated: '- template-repos/ and the install-rules payload are generated: run npm run build, because build:check fails if they are stale.',
  skill: '- plugins/core/skills/install-rules/SKILL.md lists the profiles and how to detect them (project.godot).',
  version: '- plugins/core/.claude-plugin/plugin.json needs a version bump and CHANGELOG.md an entry, or installed copies will not update.',
  guides: '- Each rule must cite an existing practice guide in practices/, and each guide must be cited by a rule.',
};

test('arch-add-godot-support: an ADR that finds the nine places and weighs options passes', async () => {
  const r = await run('arch-add-godot-support', { files: { 'docs/adr/0001-godot-support.md': Object.values(ADR).join('\n') } });
  assert.equal(r.pass, true, JSON.stringify(r.checks));
  assert.equal(r.checks.found.length, 9);
});

test('arch-add-godot-support: six of nine pass, five fail, and a generic answer finds none', async () => {
  const six = [ADR.intro, ADR.profiles, ADR.prefix, ADR.agents, ADR.generated, ADR.skill, ADR.version].join('\n');
  assert.equal((await run('arch-add-godot-support', { files: { 'docs/adr/0001-godot-support.md': six } })).pass, true);
  const five = [ADR.intro, ADR.profiles, ADR.prefix, ADR.agents, ADR.generated, ADR.skill].join('\n');
  const r = await run('arch-add-godot-support', { files: { 'docs/adr/0001-godot-support.md': five } });
  assert.equal(r.pass, false);
  assert.equal(r.checks.foundSix, false);
  const generic = await run('arch-add-godot-support', { files: { 'docs/adr/0001-godot-support.md': 'Add a Godot pack and a profile. Write rules for GDScript and test it.' } });
  assert.deepEqual(generic.checks.found, []);
});

test('arch-add-godot-support: editing outside docs, or skipping the agent, fails', async () => {
  const adr = { 'docs/adr/0001-godot-support.md': Object.values(ADR).join('\n') };
  assert.equal((await run('arch-add-godot-support', { files: { ...adr, 'build/profiles.json': '{}' } })).checks.noCode, false);
  assert.equal((await run('arch-add-godot-support', { files: adr, arm: 'rules+agents' })).pass, false);
  assert.equal((await run('arch-add-godot-support', { files: adr, arm: 'rules+agents', tools: architectCall })).pass, true);
});

// ---- lead-add-godot-support

const PLAN = `Plan: Godot 4 support. Nothing has been built.

### Slice 1: Register the rule-ID prefix and the pack
Owner: web-engineer. Add the GD prefix to PREFIXES in checks/lib/rules.mjs and to the prefix table in docs/rule-format.md; create rules/packs/godot. The rules lint rejects an unregistered prefix, so this comes first.

### Slice 2: Write the Godot rules and the practice guide
Owner: web-engineer. Each rule cites a guide in practices/, and the guide is cited by a rule.

### Slice 3: Profile, AGENTS.md template, and repo files
Owner: web-engineer. build/profiles.json, templates/agents-md/godot-game.md (within the 200-line budget), and templates/repo-files/godot-game with a CI workflow that ends with an always-run status job.

### Slice 4: install-rules skill
Owner: web-engineer. Add the profile and the project.godot detection to plugins/core/skills/install-rules/SKILL.md.

### Slice 5: Regenerate, version, and verify
Owner: web-engineer. Run npm run build. template-repos/ and the install-rules payload are generated, so never edit them by hand. Bump the version in plugins/core/.claude-plugin/plugin.json and add a CHANGELOG.md entry. Run npm run verify.

Slices 1 to 4 all want to add to CHANGELOG.md and plugin.json, which are shared files, so only slice 5 edits them. The code-reviewer reviews each slice.
`;

test('lead-add-godot-support: an ordered plan that respects the repository\'s coupling passes', async () => {
  const r = await run('lead-add-godot-support', { finalText: PLAN });
  assert.equal(r.pass, true, JSON.stringify(r.checks));
  assert.equal(r.checks.sharedFilesNoted, true);
});

test('lead-add-godot-support: building before the sources, or registering the prefix after the rules, fails', async () => {
  const [header, ...slices] = PLAN.split('### Slice');
  const buildFirst = [header, ...[slices.at(-1), ...slices.slice(0, -1)]].join('### Slice');
  assert.equal((await run('lead-add-godot-support', { finalText: buildFirst })).checks.buildAfterSources, false);
  const prefixLate = PLAN.replace('Add the GD prefix to PREFIXES in checks/lib/rules.mjs and to the prefix table in docs/rule-format.md; create rules/packs/godot. The rules lint rejects an unregistered prefix, so this comes first.', 'Create rules/packs/godot.')
    .replace('Register the rule-ID prefix and the pack', 'Create the Godot pack')
    .replace('Owner: web-engineer. Each rule cites', 'Owner: web-engineer. Register the prefix in checks/lib/rules.mjs. Each rule cites');
  assert.equal((await run('lead-add-godot-support', { finalText: prefixLate })).checks.prefixBeforeRules, false);
});

test('lead-add-godot-support: missing the version, the skill, the reviewer, or a real command fails', async () => {
  const without = (text, re) => text.replace(re, 'x');
  const noVersion = without(without(PLAN, /plugin.json/g), /CHANGELOG(.md)?/g).replace(/Bump the version in[^.]*.s*/g, '');
  assert.equal((await run('lead-add-godot-support', { finalText: noVersion })).checks.versionAndChangelog, false);
  assert.equal((await run('lead-add-godot-support', { finalText: without(PLAN, /install-rules/g) })).checks.installSkill, false);
  assert.equal((await run('lead-add-godot-support', { finalText: PLAN.replace('The code-reviewer reviews each slice.', '') })).checks.reviewer, false);
  assert.equal((await run('lead-add-godot-support', { finalText: PLAN.replace('npm run verify', 'npm run test:e2e') })).checks.verifyCommand, false);
});

test('lead-add-godot-support: a plan that says the outputs are not generated, one blob, or code edits fail', async () => {
  assert.equal((await run('lead-add-godot-support', { finalText: PLAN.replace('are generated, so never edit them by hand', 'are checked in') })).checks.generatedNoted, false);
  assert.equal((await run('lead-add-godot-support', { finalText: 'Add a pack, a profile, and update the skill. Use web-engineer and code-reviewer.' })).pass, false);
  const edited = await run('lead-add-godot-support', { finalText: PLAN, files: { 'build/profiles.json': '{}' } });
  assert.equal(edited.checks.noCode, false);
});

test('lead-add-godot-support: in the agent arm the tech lead has to be called', async () => {
  assert.equal((await run('lead-add-godot-support', { finalText: PLAN, arm: 'rules+agents' })).pass, false);
  assert.equal((await run('lead-add-godot-support', { finalText: PLAN, arm: 'rules+agents', tools: leadCall })).pass, true);
});

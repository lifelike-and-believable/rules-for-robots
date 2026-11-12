#!/usr/bin/env node
// Renders rules/ into template-repos/<profile>/ and the install-rules skill payload (R13, R14).
// Usage: node build/build.mjs          write output
//        node build/build.mjs --check  fail if committed output is stale or over budget
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listRuleFiles, parseRuleFile, visibleBody, MAX_ALWAYS_ON_LINES } from '../checks/lib/rules.mjs';

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), '..');
const RULES = path.join(ROOT, 'rules');
const OUT = path.join(ROOT, 'template-repos');


export function loadProfiles(root = ROOT) {
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'build', 'profiles.json'), 'utf8'));
  delete raw.$comment;
  return raw;
}

export function selectRules(rulesRoot, packs) {
  const layers = [path.join(rulesRoot, 'core'), ...packs.map(p => path.join(rulesRoot, 'packs', p))];
  return layers.flatMap(dir => listRuleFiles(dir));
}

// Lines of instruction text loaded at session start: AGENTS.md plus every rule without paths,
// each with the one-line header Claude Code adds (experiment R7).
export function alwaysOnLines(agentsMd, ruleFiles) {
  const visible = agentsMd.replace(/^[ \t]*<!--[\s\S]*?-->[ \t]*\r?\n/gm, '').replace(/<!--[\s\S]*?-->/g, '');
  let lines = visible.trimEnd().split('\n').length;
  for (const file of ruleFiles) {
    const rule = parseRuleFile(file);
    if (rule.error || rule.meta.paths) continue;
    lines += 2 + visibleBody(rule.body).split('\n').length;
  }
  return lines;
}

// Each list (allow, ask, deny) keeps the shared entries first, then adds the profile's new ones.
export function mergePermissions(shared = {}, extra = {}) {
  const merged = { ...shared };
  for (const [key, list] of Object.entries(extra)) {
    merged[key] = [...new Set([...(shared[key] ?? []), ...list])];
  }
  return merged;
}

export function renderProfile(name, profile, { rulesRoot = RULES, root = ROOT, dest }) {
  const agentsMd = fs.readFileSync(path.join(root, 'templates', 'agents-md', `${name}.md`), 'utf8');
  const ruleFiles = selectRules(rulesRoot, profile.packs);

  // The build owns the whole template repo: shared files, then profile files, then
  // AGENTS.md, CLAUDE.md, and the rules.
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const layer of ['common', name]) {
    const dir = path.join(root, 'templates', 'repo-files', layer);
    if (fs.existsSync(dir)) fs.cpSync(dir, dest, { recursive: true });
  }
  // The profile's plugins (rfr-core plus its domain plugin) are what the template enables
  // (docs/specs/plugin-split.md, AC-7), and its allow rules follow the shared ones (WA-009).
  const settings = path.join(dest, '.claude', 'settings.json');
  if ((profile.plugins || profile.permissions) && fs.existsSync(settings)) {
    const json = JSON.parse(fs.readFileSync(settings, 'utf8'));
    if (profile.plugins) {
      json.enabledPlugins = Object.fromEntries(profile.plugins.map(name => [`${name}@rules-for-robots`, true]));
    }
    if (profile.permissions) json.permissions = mergePermissions(json.permissions, profile.permissions);
    fs.writeFileSync(settings, `${JSON.stringify(json, null, 2)}\n`);
  }
  fs.writeFileSync(path.join(dest, 'AGENTS.md'), agentsMd);
  fs.writeFileSync(path.join(dest, 'CLAUDE.md'), '@AGENTS.md\n');
  for (const file of ruleFiles) {
    const target = path.join(dest, '.claude', 'rules', path.relative(rulesRoot, file));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(file, target);
  }
  return { ruleCount: ruleFiles.length, alwaysOn: alwaysOnLines(agentsMd, ruleFiles) };
}

// Installer skill payload: every rule plus the profile map (R13).
export const PAYLOAD = path.join(ROOT, 'plugins', 'core', 'skills', 'install-rules', 'payload');

export function renderPayload({ rulesRoot = RULES, root = ROOT, dest }) {
  fs.rmSync(dest, { recursive: true, force: true });
  const files = listRuleFiles(rulesRoot);
  for (const file of files) {
    const target = path.join(dest, 'rules', path.relative(rulesRoot, file));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(file, target);
  }
  fs.mkdirSync(dest, { recursive: true });
  // Delegated mode (improvement plan 19b): whole-file replacements for working-agreement rules,
  // kept in evals/candidates/ until their eval passes, and installed only when .claude/rfr.json
  // says "mode": "delegated".
  const candidates = path.join(root, 'evals', 'candidates');
  for (const name of fs.existsSync(candidates) ? fs.readdirSync(candidates).filter(f => f.endsWith('-delegated.md')).sort() : []) {
    fs.mkdirSync(path.join(dest, 'modes', 'delegated'), { recursive: true });
    fs.copyFileSync(path.join(candidates, name), path.join(dest, 'modes', 'delegated', name));
  }
  fs.copyFileSync(path.join(root, 'build', 'profiles.json'), path.join(dest, 'profiles.json'));
  // The preferences log (improvement plan 19h), which install-rules offers to create.
  const preferences = path.join(root, 'templates', 'repo-files', 'common', 'docs', 'preferences.md');
  if (fs.existsSync(preferences)) fs.copyFileSync(preferences, path.join(dest, 'preferences.md'));
  // The shared permission rules, which install-rules merges with the profile's (WA-009).
  const shared = path.join(root, 'templates', 'repo-files', 'common', '.claude', 'settings.json');
  if (fs.existsSync(shared)) {
    const { permissions } = JSON.parse(fs.readFileSync(shared, 'utf8'));
    fs.writeFileSync(path.join(dest, 'permissions.json'), `${JSON.stringify(permissions ?? {}, null, 2)}\n`);
  }
  return files.length;
}

// Plugin hooks run from the installed plugin, which has no checks/ folder, so they get copies of
// the shared libraries they use.
export const PROCESS_LIB = path.join(ROOT, 'checks', 'lib', 'process.mjs');
export const PROCESS_LIB_COPY = path.join(ROOT, 'plugins', 'process', 'scripts', 'lib', 'process.mjs');
export const LIB_COPIES = [
  { src: PROCESS_LIB, dest: PROCESS_LIB_COPY, label: 'process plugin library' },
  { src: path.join(ROOT, 'checks', 'lib', 'test-diff.mjs'), dest: path.join(ROOT, 'plugins', 'core', 'scripts', 'lib', 'test-diff.mjs'), label: 'core plugin test-diff library' },
  { src: path.join(ROOT, 'checks', 'lib', 'test-paths.mjs'), dest: path.join(ROOT, 'plugins', 'core', 'scripts', 'lib', 'test-paths.mjs'), label: 'core plugin test-paths library' },
  { src: path.join(ROOT, 'checks', 'test-change-evidence.mjs'), dest: path.join(ROOT, 'plugins', 'core', 'scripts', 'test-change-evidence.mjs'), label: 'core plugin test-change evidence script' },
  { src: path.join(ROOT, 'checks', 'test-change-review.mjs'), dest: path.join(ROOT, 'plugins', 'core', 'scripts', 'test-change-review.mjs'), label: 'core plugin test-change review script' },
  { src: path.join(ROOT, 'checks', 'api-lookup.mjs'), dest: path.join(ROOT, 'plugins', 'core', 'scripts', 'api-lookup.mjs'), label: 'core plugin API lookup script' },
  { src: path.join(ROOT, 'checks', 'review-findings.mjs'), dest: path.join(ROOT, 'plugins', 'core', 'scripts', 'review-findings.mjs'), label: 'core plugin review findings check' },
  // Domain plugins (docs/specs/plugin-split.md, AC-5): a plugin's hooks cannot import from another
  // plugin's folder, so each gets copies of the rfr-core hook helpers its guards use.
  // rfr-android's guard also reads command lines with rfr-core's shell parser (android-plugin AC-1).
  { src: path.join(ROOT, 'plugins', 'core', 'scripts', 'shell-writes.mjs'), dest: path.join(ROOT, 'plugins', 'android', 'scripts', 'shell-writes.mjs'), label: 'android plugin shell-writes.mjs' },
  ...['web', 'unreal', 'android'].flatMap(plugin => ['lib.mjs', 'guard-outcome.mjs', 'chat-approval.mjs'].map(file => ({
    src: path.join(ROOT, 'plugins', 'core', 'scripts', file),
    dest: path.join(ROOT, 'plugins', plugin, 'scripts', file),
    label: `${plugin} plugin ${file}`,
  }))),
  // Task approval (docs/specs/task-approval.md): rfr-web's Vercel guard and rfr-process's merge guard
  // read the person's latest input with rfr-core's recognizer, which uses rfr-core's shell parser.
  { src: path.join(ROOT, 'plugins', 'core', 'scripts', 'chat-approval.mjs'), dest: path.join(ROOT, 'plugins', 'process', 'scripts', 'lib', 'chat-approval.mjs'), label: 'process plugin chat-approval.mjs' },
  ...[['web', 'scripts'], ['process', path.join('scripts', 'lib')]].flatMap(([plugin, dir]) => ['task-approval.mjs', 'shell-writes.mjs'].map(file => ({
    src: path.join(ROOT, 'plugins', 'core', 'scripts', file),
    dest: path.join(ROOT, 'plugins', plugin, dir, file),
    label: `${plugin} plugin ${file}`,
  }))),
];
const header = src => `// Generated by npm run build from ${path.relative(ROOT, src).split(path.sep).join('/')}. Edit that file, not this one.\n`;

export function renderLib(src) {
  const text = fs.readFileSync(src, 'utf8');
  // A script's #! line has to stay first.
  const shebang = /^#!.*\n/.exec(text)?.[0] ?? '';
  return shebang + header(src) + text.slice(shebang.length);
}

export function renderProcessLib() {
  return renderLib(PROCESS_LIB);
}

function listAll(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter(e => e.isFile())
    .map(e => path.relative(dir, path.join(e.parentPath ?? e.path, e.name)).split(path.sep).join('/'))
    .sort();
}

export function diffDirs(expectedDir, actualDir, list = listAll) {
  const expected = list(expectedDir);
  const actual = list(actualDir);
  const problems = [];
  for (const f of expected) {
    if (!actual.includes(f)) problems.push(`missing ${f}`);
    else if (!fs.readFileSync(path.join(expectedDir, f)).equals(fs.readFileSync(path.join(actualDir, f)))) problems.push(`stale ${f}`);
  }
  for (const f of actual) if (!expected.includes(f)) problems.push(`unexpected ${f}`);
  return problems;
}

export function diffOwned(expectedDir, actualDir) {
  return diffDirs(expectedDir, actualDir);
}

function main() {
  const check = process.argv.includes('--check');
  const profiles = loadProfiles();
  const tmp = check ? fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-build-')) : null;
  let failed = false;

  for (const [name, profile] of Object.entries(profiles)) {
    const dest = path.join(check ? tmp : OUT, name);
    const { ruleCount, alwaysOn } = renderProfile(name, profile, { dest });
    const label = `${name}: ${ruleCount} rule(s), ${alwaysOn} always-on line(s)`;
    if (alwaysOn > MAX_ALWAYS_ON_LINES) {
      failed = true;
      console.error(`${label} exceeds the ${MAX_ALWAYS_ON_LINES}-line budget`);
    } else {
      console.log(label);
    }
    if (check) {
      for (const problem of diffOwned(dest, path.join(OUT, name))) {
        failed = true;
        console.error(`template-repos/${name}: ${problem} (run npm run build)`);
      }
    }
  }

  const payloadDest = check ? path.join(tmp, 'payload') : PAYLOAD;
  console.log(`install-rules payload: ${renderPayload({ dest: payloadDest })} rule(s)`);
  if (check) {
    for (const problem of diffDirs(payloadDest, PAYLOAD)) {
      failed = true;
      console.error(`${path.relative(ROOT, PAYLOAD)}: ${problem} (run npm run build)`);
    }
  }

  for (const { src, dest, label } of LIB_COPIES) {
    const lib = renderLib(src);
    if (check) {
      const current = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
      if (current !== lib) {
        failed = true;
        console.error(`${path.relative(ROOT, dest)}: ${current === null ? 'missing' : 'stale'} (run npm run build)`);
      }
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, lib);
    }
    console.log(`${label}: copied from ${path.relative(ROOT, src).split(path.sep).join('/')}`);
  }

  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  if (failed) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) main();

#!/usr/bin/env node
// Renders rules/ into template-repos/<profile>/ (R13, R14).
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

// Paths inside each template repo that the build owns. Everything else is hand-written.
const OWNED = ['AGENTS.md', 'CLAUDE.md', '.claude/rules'];

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

export function renderProfile(name, profile, { rulesRoot = RULES, root = ROOT, dest }) {
  const agentsMd = fs.readFileSync(path.join(root, 'templates', 'agents-md', `${name}.md`), 'utf8');
  const ruleFiles = selectRules(rulesRoot, profile.packs);

  fs.mkdirSync(dest, { recursive: true });
  fs.rmSync(path.join(dest, '.claude', 'rules'), { recursive: true, force: true });
  fs.writeFileSync(path.join(dest, 'AGENTS.md'), agentsMd);
  fs.writeFileSync(path.join(dest, 'CLAUDE.md'), '@AGENTS.md\n');
  for (const file of ruleFiles) {
    const target = path.join(dest, '.claude', 'rules', path.relative(rulesRoot, file));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(file, target);
  }
  return { ruleCount: ruleFiles.length, alwaysOn: alwaysOnLines(agentsMd, ruleFiles) };
}

function listOwned(dir) {
  const files = [];
  for (const owned of OWNED) {
    const full = path.join(dir, owned);
    if (!fs.existsSync(full)) continue;
    if (fs.statSync(full).isFile()) { files.push(owned); continue; }
    for (const entry of fs.readdirSync(full, { withFileTypes: true, recursive: true })) {
      if (entry.isFile()) files.push(path.relative(dir, path.join(entry.parentPath ?? entry.path, entry.name)));
    }
  }
  return files.sort();
}

export function diffOwned(expectedDir, actualDir) {
  const expected = listOwned(expectedDir);
  const actual = listOwned(actualDir);
  const problems = [];
  for (const f of expected) {
    if (!actual.includes(f)) problems.push(`missing ${f}`);
    else if (!fs.readFileSync(path.join(expectedDir, f)).equals(fs.readFileSync(path.join(actualDir, f)))) problems.push(`stale ${f}`);
  }
  for (const f of actual) if (!expected.includes(f)) problems.push(`unexpected ${f}`);
  return problems;
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

  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  if (failed) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) main();

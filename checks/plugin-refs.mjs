#!/usr/bin/env node
// Cross-plugin references (docs/specs/plugin-split.md, AC-3). Claude Code names a plugin's agents
// and skills by plugin (`rfr-web:web-engineer`, `/rfr-web:a11y-audit`), so a plugin's files must name
// another plugin's agent or skill with that plugin's prefix; a bare name may resolve to nothing when
// only one plugin is installed. This lists every agent and skill in plugins/*, then reports each
// mention in a plugin's Markdown of another plugin's agent or skill that is not qualified.
//
// A mention is a hyphenated name as a whole word (`web-engineer`, `check-runner`), or any name in
// backticks (`release`). Mentions qualified with `rfr-<plugin>:` pass.
//
// Usage: node checks/plugin-refs.mjs [root]
// Exit codes: 0 clean, 1 unqualified mentions found.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', 'payload', 'templates', 'vale'].includes(e.name)) walk(p, out);
    } else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

export function inventory(root) {
  const plugins = [];
  const dir = path.join(root, 'plugins');
  for (const folder of fs.readdirSync(dir).sort()) {
    const manifest = path.join(dir, folder, '.claude-plugin', 'plugin.json');
    if (!fs.existsSync(manifest)) continue;
    const name = JSON.parse(fs.readFileSync(manifest, 'utf8')).name;
    const agentsDir = path.join(dir, folder, 'agents');
    const skillsDir = path.join(dir, folder, 'skills');
    const agents = fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3)) : [];
    const skills = fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir).filter(f => fs.existsSync(path.join(skillsDir, f, 'SKILL.md'))) : [];
    plugins.push({ name, folder, dir: path.join(dir, folder), names: new Set([...agents, ...skills]) });
  }
  return plugins;
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function findUnqualified(root) {
  const plugins = inventory(root);
  const problems = [];
  for (const plugin of plugins) {
    const foreign = plugins.filter(p => p !== plugin).flatMap(p => [...p.names].filter(n => !plugin.names.has(n)).map(n => ({ name: n, owner: p.name })));
    for (const file of walk(plugin.dir)) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const { name, owner } of foreign) {
          const n = escapeRe(name);
          const re = name.includes('-')
            ? new RegExp(`(?<![\\w/.-])/?(?:rfr-[a-z]+:)?${n}(?![\\w-])`, 'g')
            : new RegExp(`\`/?(?:rfr-[a-z]+:)?${n}(?:\\s[^\`]*)?\``, 'g');
          for (const m of line.matchAll(re)) {
            // A name inside a path (plugins/web/skills/a11y-audit) is not a mention.
            if (/[\w.-]\/$/.test(line.slice(0, m.index))) continue;
            const prefix = /rfr-[a-z]+(?=:)/.exec(m[0])?.[0];
            if (prefix === owner) continue;
            problems.push({ file: path.relative(root, file).split(path.sep).join('/'), line: i + 1, name, owner, wrong: prefix ?? null, text: line.trim().slice(0, 140) });
          }
        }
      });
    }
  }
  return problems;
}

function main() {
  const root = path.resolve(process.argv[2] ?? '.');
  const problems = findUnqualified(root);
  for (const p of problems) console.error(`${p.file}:${p.line}: \`${p.name}\` belongs to ${p.owner}${p.wrong ? `, not ${p.wrong}` : ''}; write \`${p.owner}:${p.name}\` | ${p.text}`);
  if (problems.length) {
    console.error(`${problems.length} unqualified mention(s) of another plugin's agent or skill.`);
    process.exit(1);
  }
  console.log(`${inventory(root).length} plugins: every mention of another plugin's agent or skill is qualified.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();

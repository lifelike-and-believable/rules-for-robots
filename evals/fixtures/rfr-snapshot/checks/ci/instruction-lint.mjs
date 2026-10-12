#!/usr/bin/env node
// Instruction-file lint (#34): agents treat AGENTS.md and CLAUDE.md as authoritative, so a
// stale path or script name sends them looking for something that does not exist. Fails
// when a backticked repo-relative path does not exist or an `npm run <script>` is not in
// package.json. Absolute paths and MCP tool names cannot be checked here, so they are
// warnings.
// Usage: node instruction-lint.mjs [file ...]   (default: AGENTS.md and CLAUDE.md)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXTENSIONS = /\.(md|mjs|cjs|js|ts|tsx|jsx|json|ya?ml|toml|ini|txt|sh|ps1|py|cs|cpp|h|inl|uplugin|uproject)$/i;
const SKIP = /[<>*{}$|()\s]|^https?:|^node_modules\/|::/;

// Every file and folder in the repository (relative, / separators, folders end with /),
// so a reference can be matched as a suffix: instruction files often name a path relative
// to a folder mentioned nearby (`common/`, `plugin.json`).
function repoEntries(root) {
  const out = [];
  const walk = dir => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const rel = dir ? `${dir}/${e.name}` : e.name;
      out.push(e.isDirectory() ? `${rel}/` : rel);
      if (e.isDirectory()) walk(rel);
    }
  };
  walk('');
  return out;
}

function inlineCode(text) {
  const withoutFences = text.replace(/^```[\s\S]*?^```/gm, '');
  return [...withoutFences.matchAll(/`([^`\n]+)`/g)].map(m => m[1].trim());
}

export function lintInstructions(text, { root = process.cwd() } = {}) {
  const errors = [];
  const warnings = [];
  let entries;
  const exists = ref => {
    if (fs.existsSync(path.join(root, ref))) return true;
    entries ??= repoEntries(root);
    const want = ref.replace(/^\.\//, '');
    return entries.some(e => e === want || e.endsWith(`/${want}`) || (!want.endsWith('/') && (e === `${want}/` || e.endsWith(`/${want}/`))));
  };
  const pkgFile = path.join(root, 'package.json');
  const scripts = fs.existsSync(pkgFile) ? Object.keys(JSON.parse(fs.readFileSync(pkgFile, 'utf8')).scripts ?? {}) : null;

  for (const span of inlineCode(text)) {
    for (const m of span.matchAll(/\bnpm run ([\w:.-]+)/g)) {
      if (scripts && !scripts.includes(m[1])) errors.push(`npm script "${m[1]}" is not in package.json`);
    }
    if (/^mcp__\w+/.test(span)) { warnings.push(`names MCP tool ${span}; check that it is still installed`); continue; }
    if (/^([A-Za-z]:[\\/]|\/|~)/.test(span) && !/\s/.test(span)) { warnings.push(`absolute path ${span} cannot be checked in CI`); continue; }
    if (SKIP.test(span)) continue;
    const candidate = span.replace(/[.,;:]+$/, '');
    if (!candidate.includes('/') && !EXTENSIONS.test(candidate)) continue;
    if (!candidate.includes('/') && !/^[\w.-]+$/.test(candidate)) continue;
    if (!exists(candidate)) errors.push(`path ${candidate} does not exist`);
  }
  return { errors, warnings };
}

function main() {
  const files = process.argv.slice(2);
  const targets = files.length ? files : ['AGENTS.md', 'CLAUDE.md'].filter(f => fs.existsSync(f));
  let failed = false;
  for (const file of targets) {
    const { errors, warnings } = lintInstructions(fs.readFileSync(file, 'utf8'));
    for (const w of warnings) console.warn(`${file}: warning: ${w}`);
    for (const e of errors) console.error(`${file}: ${e}`);
    if (errors.length) failed = true;
  }
  if (failed) process.exit(1);
  console.log(`${targets.length} instruction file(s) OK.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

#!/usr/bin/env node
// Prepares a Vale run for the docs-lint job (docs/specs/project-process.md, AC-23): the RFR style,
// built from rules-for-robots' writing rules (plugins/process/vale/RFR), and a project vocabulary of
// persona names and glossary terms, which Vale.Terms uses to keep their spelling and case
// consistent. Vale's US-English spelling check is off, since the style asks for Canadian English.
// Writes <out>/.vale.ini and <out>/styles/, and prints the config path and the folders to lint
// (docs/user, docs/tutorials, docs/releases, where they exist).
// Usage: node checks/process-vale.mjs [project root] --out <dir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArtifact } from './lib/process.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const STYLE = path.resolve(here, '../plugins/process/vale/RFR');
export const LINTED = ['docs/user', 'docs/tutorials', 'docs/releases'];
const GLOSSARY = 'docs/product/glossary.md';
const PERSONAS = 'docs/product/personas';

// A persona's name is its title up to the first comma ("Star" in "Star, the artist"), when that is
// one or two capitalized words. A descriptive title ("Fan and reader") gives no term.
function personaName(title) {
  const head = title.split(',')[0].trim();
  return /^\p{Lu}[\p{L}'-]*(?: \p{Lu}[\p{L}'-]*)?$/u.test(head) ? head : null;
}

export function vocabulary(root) {
  const terms = new Set();
  const dir = path.join(root, PERSONAS);
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md'))) {
      const { body } = parseArtifact(fs.readFileSync(path.join(dir, f), 'utf8'));
      const title = /^#\s+(.+?)\s*$/m.exec(body)?.[1];
      const name = title && personaName(title);
      if (name) terms.add(name);
    }
  }
  const glossary = path.join(root, GLOSSARY);
  if (fs.existsSync(glossary)) {
    const { body } = parseArtifact(fs.readFileSync(glossary, 'utf8'));
    for (const m of body.matchAll(/^\s*[-*+]\s+\*\*([^*]+?)\*\*/gm)) terms.add(m[1].trim());
    for (const m of body.matchAll(/^#{2,3}\s+(.+?)\s*$/gm)) terms.add(m[1].trim());
  }
  return [...terms].sort();
}

export function prepareVale(root, out) {
  const styles = path.join(out, 'styles');
  fs.mkdirSync(styles, { recursive: true });
  fs.cpSync(STYLE, path.join(styles, 'RFR'), { recursive: true });
  const vocab = path.join(styles, 'config', 'vocabularies', 'Project');
  fs.mkdirSync(vocab, { recursive: true });
  // Vocabulary entries are regular expressions; escape the terms.
  const terms = vocabulary(root).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  fs.writeFileSync(path.join(vocab, 'accept.txt'), terms.length ? `${terms.join('\n')}\n` : '');
  const config = path.join(out, '.vale.ini');
  fs.writeFileSync(config, [
    `StylesPath = ${styles}`,
    'MinAlertLevel = suggestion',
    'Vocab = Project',
    '',
    '[*.md]',
    'BasedOnStyles = Vale, RFR',
    'Vale.Spelling = NO',
    'Vale.Terms = warning',
    '',
  ].join('\n'));
  const paths = LINTED.map(p => path.join(root, p)).filter(p => fs.existsSync(p));
  return { config, paths, terms: terms.length };
}

function main(argv) {
  const args = [...argv];
  const i = args.indexOf('--out');
  if (i === -1) { console.error('usage: process-vale.mjs [root] --out <dir>'); process.exit(2); }
  const out = path.resolve(args.splice(i, 2)[1]);
  const root = path.resolve(args[0] ?? '.');
  const { config, paths } = prepareVale(root, out);
  console.log(config);
  for (const p of paths) console.log(path.relative(root, p) || '.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2));

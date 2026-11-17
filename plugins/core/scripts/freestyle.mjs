#!/usr/bin/env node
// The freestyle skill's commands (docs/specs/freestyle.md, AC-5 and AC-6), run only when the person
// asks for them:
//   node freestyle.mjs start "<what to try>"   Make a folder for the experiment under the first
//                                              freestyle root, with FREESTYLE.md, and print its path.
//   node freestyle.mjs end                     In a freestyle folder, print the findings in
//                                              FREESTYLE.md and the way to a real project.
// A refusal is one line on stderr, with a non-zero exit. Neither command touches ~/.claude/rfr.json:
// the roots are the person's to list.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { freestyleRoots, isFreestyle, projectFolder, rootOf } from './freestyle-lib.mjs';

const USAGE = 'usage: node freestyle.mjs start "<what to try>" | end';
const NO_ROOTS = 'no freestyle folders are listed. Ask the person to add one to "freestyle" in their own ~/.claude/rfr.json, for example { "freestyle": ["~/scratch"] }, then run this again';

class Refusal extends Error {}
const refuse = message => { throw new Refusal(message); };

// The folder name for an experiment: lower case, each run of other characters a hyphen, trimmed,
// and at most 48 characters.
export function slug(text) {
  const trim = s => s.replace(/^-+|-+$/g, '');
  return trim(trim(String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-')).slice(0, 48));
}

const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function freestyleFile(text, date = today()) {
  return `# Freestyle: ${text.trim()}\n\nStarted ${date}. This folder is a freestyle experiment: rfr does nothing here, and only Claude Code's own defaults apply.\n\n## What to try\n\n${text.trim()}\n\n## Findings\n`;
}

// AC-5: the new folder's path.
export function start(text, { home } = {}) {
  const roots = freestyleRoots({ home });
  if (!roots.length) refuse(NO_ROOTS);
  if (typeof text !== 'string' || !slug(text)) refuse('say what to try, in a few words: node freestyle.mjs start "<what to try>"');
  const dir = path.join(roots[0], slug(text));
  if (fs.existsSync(dir)) refuse(`${dir} already exists. Open a session there to carry on with it, or start again with different words`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'FREESTYLE.md'), freestyleFile(text));
  return dir;
}

// FREESTYLE.md in the project folder or a folder above it, up to the freestyle root; null if none.
function findFreestyleFile(dir, home) {
  const root = rootOf(dir, { home });
  let at = projectFolder(dir);
  while (true) {
    const file = path.join(at, 'FREESTYLE.md');
    if (fs.existsSync(file)) return file;
    const up = path.dirname(at);
    if (!root || at === root || up === at || !up.startsWith(root)) return null;
    at = up;
  }
}

// The text of the ## Findings section, without its heading.
export function findings(text) {
  const m = /^## Findings[ \t]*\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text);
  return m ? m[1].trim() : '';
}

// AC-6: what end prints. It changes nothing.
export function end(dir, { home } = {}) {
  if (!isFreestyle(dir, { home })) refuse('this is not a freestyle folder: it is not under a root listed in ~/.claude/rfr.json, or it has docs/product/process.yml or a git remote, so rfr applies here in full');
  const file = findFreestyleFile(dir, home);
  if (!file) refuse('this freestyle folder has no FREESTYLE.md, so there is no experiment to end. Any folder under a root is freestyle without one; start one with node freestyle.mjs start "<what to try>"');
  const found = findings(fs.readFileSync(file, 'utf8'));
  const folder = path.dirname(file);
  return [
    `Experiment: ${folder}`,
    '',
    '## Findings',
    '',
    found || '(none yet: write what was learned under ## Findings in FREESTYLE.md)',
    '',
    'To turn this experiment into a real project:',
    '1. Make sure ## Findings in FREESTYLE.md says what worked, what did not, and what is still open.',
    '2. Move the folder out of the freestyle root (or add a remote to its git), so rfr applies to it.',
    '3. Create the repository: git init if there is none, a first commit, and a remote to push to.',
    '4. Run /rfr-process:setup, then /rfr-process:bootstrap, which drafts the concept, requirements, and personas from what is there, FREESTYLE.md included.',
    'From then on rfr applies in full.',
  ].join('\n');
}

function main(argv) {
  const [command, ...rest] = argv;
  try {
    if (command === 'start') console.log(start(rest.join(' ')));
    else if (command === 'end') console.log(end(process.cwd()));
    else refuse(USAGE);
  } catch (error) {
    if (!(error instanceof Refusal)) throw error;
    process.stderr.write(`rfr-core freestyle: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2));

#!/usr/bin/env node
// Release checks (Phase 9): CHANGELOG.md has an Unreleased section, its releases are in
// descending order without duplicates, and the newest release matches the rfr-core
// plugin version. Each release after 5.1.3 has an "Evaluated on:" line naming the models of
// the newest ledger run, each of which has entries in evals/ledger.json
// (docs/specs/model-adaptation.md, AC-10).
//
//   node checks/release.mjs
//     Runs the checks (npm run check:release).
//   node checks/release.mjs notes [--since <version>] [--to <version>]
//     Prints the changelog sections a release covers: every release after --since (default: the
//     newest rfr-v tag) up to --to (default: the plugin version).
//   node checks/release.mjs prepare --commit <sha>
//     Checks that a merged commit is ready to tag (its plugin version, its changelog, no tag of
//     that name yet), writes the release notes to a file, and prints the commands to tag and
//     publish it. It runs nothing that changes the remote: a person confirms, then runs them.
//     Node, git, and gh only, so the steps are the same on Windows, macOS, and Linux.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RELEASE = /^## \[(\d+)\.(\d+)\.(\d+)\]/gm;

const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
// The last release before the "Evaluated on:" line was required.
export const EVALUATED_ON_SINCE = [5, 1, 3];

// The models a release names on its "Evaluated on:" line, or null when it has none.
export function evaluatedOn(section) {
  const line = /^Evaluated on: *(.*)$/m.exec(section)?.[1];
  if (line === undefined) return null;
  return line.replace(/[`.]+$/, '').split(/[,;]|\band\b/).map(m => m.replace(/`/g, '').trim()).filter(Boolean);
}

export function checkEvaluatedOn(text, ledgerModels) {
  const errors = [];
  const sections = text.split(/^(?=## \[)/m);
  for (const section of sections) {
    const m = /^## \[(\d+)\.(\d+)\.(\d+)\]/.exec(section);
    if (!m) continue;
    const version = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (compare(version, EVALUATED_ON_SINCE) <= 0) continue;
    const name = version.join('.');
    const models = evaluatedOn(section);
    if (!models?.length) { errors.push(`release ${name} has no "Evaluated on:" line naming the models of the newest ledger run`); continue; }
    for (const model of models) {
      if (!ledgerModels.has(model)) errors.push(`release ${name} says it was evaluated on ${model}, but evals/ledger.json has no entries for it`);
    }
  }
  return errors;
}

export function checkChangelog(text, pluginVersion) {
  const errors = [];
  if (!/^## \[Unreleased\]/m.test(text)) errors.push('CHANGELOG.md needs an "## [Unreleased]" section');
  const releases = [...text.matchAll(RELEASE)].map(m => [Number(m[1]), Number(m[2]), Number(m[3])]);
  const names = releases.map(r => r.join('.'));
  if (!releases.length) errors.push('CHANGELOG.md has no releases');
  for (let i = 1; i < releases.length; i++) {
    const order = compare(releases[i - 1], releases[i]);
    if (order === 0) errors.push(`duplicate release ${names[i]}`);
    else if (order < 0) errors.push(`releases out of order: ${names[i - 1]} is listed before ${names[i]}`);
  }
  if (releases.length && names[0] !== pluginVersion) {
    errors.push(`plugin version ${pluginVersion} has no changelog entry (newest release is ${names[0]})`);
  }
  return errors;
}

const parse = v => v.split('.').map(Number);

// The changelog sections for releases after `since` up to and including `to`, newest first, as
// they appear in the file. `since` null means from the oldest.
export function releaseNotes(text, { since = null, to }) {
  const heads = [...text.matchAll(/^## \[(\d+\.\d+\.\d+)\][^\n]*$/gm)];
  const parts = [];
  heads.forEach((m, k) => {
    const v = parse(m[1]);
    if (compare(v, parse(to)) > 0) return;
    if (since && compare(v, parse(since)) <= 0) return;
    // A section runs to the next release heading, or to the end of the file.
    const end = k + 1 < heads.length ? heads[k + 1].index : text.length;
    parts.push(text.slice(m.index, end).trimEnd());
  });
  return parts.length ? `${parts.join('\n\n')}\n` : '';
}

const git = (args, cwd = process.cwd()) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
};

// The newest rfr-vX.Y.Z tag below `to`, or null.
export function previousTag(tags, to) {
  return tags
    .map(t => /^rfr-v(\d+\.\d+\.\d+)$/.exec(t)?.[1])
    .filter(v => v && compare(parse(v), parse(to)) < 0)
    .sort((a, b) => compare(parse(b), parse(a)))[0] ?? null;
}

function arg(argv, name) {
  const k = argv.indexOf(`--${name}`);
  return k === -1 ? undefined : argv[k + 1];
}

function notes(argv) {
  const to = arg(argv, 'to') ?? JSON.parse(fs.readFileSync('plugins/core/.claude-plugin/plugin.json', 'utf8')).version;
  const since = arg(argv, 'since') ?? previousTag((git(['tag', '-l', 'rfr-v*']) ?? '').split('\n'), to);
  process.stdout.write(releaseNotes(fs.readFileSync('CHANGELOG.md', 'utf8'), { since, to }));
}

function prepare(argv) {
  const commit = arg(argv, 'commit');
  const fail = msg => { console.error(`Not ready: ${msg}`); process.exit(1); };
  if (!commit) fail('pass --commit <sha>, the merge commit to tag');
  const sha = git(['rev-parse', '--verify', `${commit}^{commit}`]);
  if (!sha) fail(`${commit} is not a commit here; run git fetch origin first`);
  const pluginJson = git(['show', `${sha}:plugins/core/.claude-plugin/plugin.json`]);
  const changelog = git(['show', `${sha}:CHANGELOG.md`]);
  if (!pluginJson || !changelog) fail(`${sha.slice(0, 7)} has no plugin.json or CHANGELOG.md`);
  const version = JSON.parse(pluginJson).version;
  const errors = checkChangelog(changelog, version);
  if (errors.length) fail(errors.join('; '));
  const tag = `rfr-v${version}`;
  if (git(['tag', '-l', tag])) fail(`${tag} already exists here`);
  const remote = git(['ls-remote', '--tags', 'origin', tag]);
  if (remote === null) fail('cannot reach origin to check its tags');
  if (remote) fail(`${tag} already exists on origin`);
  if (git(['merge-base', '--is-ancestor', sha, 'origin/main']) === null) fail(`${sha.slice(0, 7)} is not on origin/main; tag a merged commit`);
  const since = previousTag((git(['tag', '-l', 'rfr-v*']) ?? '').split('\n'), version);
  const body = releaseNotes(changelog, { since, to: version });
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-release-')), `${tag}-notes.md`);
  fs.writeFileSync(file, body);
  console.log(`Ready: ${tag} on ${sha} (rfr-core ${version}).`);
  console.log(`Notes: ${file} (${since ? `releases after ${since}` : 'every release'} up to ${version}).`);
  console.log('');
  console.log('Before running these, check CI passed on the commit, and confirm with the maintainer:');
  console.log(`  gh run list --commit ${sha} --workflow verify.yml`);
  console.log('');
  console.log(`  git tag -a ${tag} -m ${tag} ${sha}`);
  console.log(`  git push origin ${tag}`);
  console.log(`  gh release create ${tag} --title ${tag} --notes-file "${file}" --verify-tag`);
}

function main() {
  const [cmd, ...argv] = process.argv.slice(2);
  if (cmd === 'notes') return notes(argv);
  if (cmd === 'prepare') return prepare(argv);
  if (cmd) {
    console.error('Usage: release.mjs [notes [--since <version>] [--to <version>] | prepare --commit <sha>]');
    process.exit(2);
  }
  const plugin = JSON.parse(fs.readFileSync('plugins/core/.claude-plugin/plugin.json', 'utf8'));
  const text = fs.readFileSync('CHANGELOG.md', 'utf8');
  const ledger = fs.existsSync('evals/ledger.json') ? JSON.parse(fs.readFileSync('evals/ledger.json', 'utf8')) : { entries: [] };
  const errors = [...checkChangelog(text, plugin.version), ...checkEvaluatedOn(text, new Set(ledger.entries.map(e => e.model)))];
  for (const e of errors) console.error(e);
  if (errors.length) process.exit(1);
  console.log(`CHANGELOG.md matches rfr-core ${plugin.version}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

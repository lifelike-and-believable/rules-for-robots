// The freestyle script behind /rfr-core:freestyle (docs/specs/freestyle.md, AC-5 and AC-6): start
// makes a folder for an experiment under the first root, with FREESTYLE.md; end prints the findings
// and the way to a real project, and changes nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPT = path.resolve(import.meta.dirname, '..', 'plugins', 'core', 'scripts', 'freestyle.mjs');

function world({ roots } = {}) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-freestyle-script-')));
  const home = path.join(base, 'home');
  const scratch = path.join(base, 'scratch');
  const second = path.join(base, 'second');
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  if (roots !== null) fs.writeFileSync(path.join(home, '.claude', 'rfr.json'), JSON.stringify({ freestyle: roots ?? [scratch, second] }));
  const run = (args, cwd = base) => {
    const env = { ...process.env, HOME: home, USERPROFILE: home };
    delete env.CLAUDE_PROJECT_DIR;
    return spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8', env });
  };
  return { base, home, scratch, second, run };
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Every file under a folder with its contents, to show that nothing changed.
// Starts an experiment and returns its folder, failing the test (rather than writing elsewhere) when
// start does not succeed.
const started = (w, text) => {
  const r = w.run(['start', text]);
  assert.equal(r.status, 0, r.stderr);
  const dir = r.stdout.trim();
  assert.ok(path.isAbsolute(dir) && dir.startsWith(w.scratch), dir);
  return dir;
};

const snapshot = dir =>Object.fromEntries(fs.readdirSync(dir, { recursive: true }).map(String).sort().map(f => [f, fs.statSync(path.join(dir, f)).isFile() ? fs.readFileSync(path.join(dir, f), 'utf8') : 'dir']));

test('freestyle#AC-5: start creates a folder named from the text under the first root, with FREESTYLE.md, and prints its path', () => {
  const w = world();
  const r = w.run(['start', 'Does the WebGPU   API do instancing? (quick spike)']);
  assert.equal(r.status, 0, r.stderr);
  const dir = path.join(w.scratch, 'does-the-webgpu-api-do-instancing-quick-spike');
  assert.equal(r.stdout.trim(), dir);
  const text = fs.readFileSync(path.join(dir, 'FREESTYLE.md'), 'utf8');
  assert.match(text, /Does the WebGPU {3}API do instancing\? \(quick spike\)/);
  assert.ok(text.includes(today()), 'the date');
  assert.match(text, /\n## Findings\n\s*$/, 'an empty findings section at the end');
  assert.ok(!fs.existsSync(w.second), 'only the first root is used');
});

test('freestyle#AC-5: the folder name is lower case, with other characters as single hyphens, trimmed, and at most 48 characters', () => {
  const w = world();
  const r = w.run(['start', '  --Try: a very long idea about rendering many, many little things on screen at once!!  ']);
  assert.equal(r.status, 0, r.stderr);
  const name = path.basename(r.stdout.trim());
  assert.ok(name.length <= 48, name);
  assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.ok(name.startsWith('try-a-very-long-idea-about-rendering-many-many'), name);
  assert.equal(path.dirname(r.stdout.trim()), w.scratch);
});

test('freestyle#AC-5: a root written with ~ is used from the home folder, and made if it does not exist', () => {
  const w = world({ roots: ['~/experiments'] });
  const r = w.run(['start', 'sketch']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), path.join(w.home, 'experiments', 'sketch'));
  assert.ok(fs.existsSync(path.join(w.home, 'experiments', 'sketch', 'FREESTYLE.md')));
});

test('freestyle#AC-5: start refuses with no roots, saying how to add one, and creates nothing', () => {
  for (const roots of [null, [], ['relative/folder']]) {
    const w = world({ roots });
    const before = snapshot(w.base);
    const r = w.run(['start', 'an idea']);
    assert.notEqual(r.status, 0);
    assert.equal(r.stdout, '');
    assert.match(r.stderr.trim(), /^rfr-core freestyle: no freestyle folders are listed\..*"freestyle".*~\/\.claude\/rfr\.json/);
    assert.equal(r.stderr.trim().split('\n').length, 1, 'one line');
    assert.deepEqual(snapshot(w.base), before);
  }
});

test('freestyle#AC-5: start refuses with no text, or text with no letters or digits', () => {
  const w = world();
  for (const args of [['start'], ['start', ''], ['start', '   '], ['start', '?!']]) {
    const r = w.run(args);
    assert.notEqual(r.status, 0, args.join(' '));
    assert.match(r.stderr.trim(), /^rfr-core freestyle: say what to try/);
    assert.equal(r.stderr.trim().split('\n').length, 1);
  }
  assert.ok(!fs.existsSync(w.scratch), 'nothing was created');
});

test('freestyle#AC-5: start refuses when the folder exists, and leaves it alone', () => {
  const w = world();
  assert.equal(w.run(['start', 'same idea']).status, 0);
  const dir = path.join(w.scratch, 'same-idea');
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'mine');
  const before = snapshot(dir);
  const r = w.run(['start', 'Same idea!']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr.trim(), /^rfr-core freestyle: .*same-idea already exists/);
  assert.deepEqual(snapshot(dir), before);
});

test('freestyle#AC-6: end prints the findings and the way to a real project, and changes nothing', () => {
  const w = world();
  const dir = started(w, 'spike');
  fs.appendFileSync(path.join(dir, 'FREESTYLE.md'), '- Instancing works in Chrome.\n- Safari needs a flag.\n');
  fs.mkdirSync(path.join(dir, 'src'));
  const before = snapshot(dir);
  const r = w.run(['end'], path.join(dir, 'src'));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /## Findings\n+- Instancing works in Chrome\.\n- Safari needs a flag\./);
  assert.match(r.stdout, /move the folder out of/i);
  assert.match(r.stdout, /add a remote/);
  assert.match(r.stdout, /\/rfr-process:setup/);
  assert.match(r.stdout, /\/rfr-process:bootstrap/);
  assert.deepEqual(snapshot(dir), before);
});

test('freestyle#AC-6: end with empty findings says so', () => {
  const w = world();
  const dir = started(w, 'spike');
  const r = w.run(['end'], dir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /## Findings\n+\(none yet/);
});

test('freestyle#AC-6: end refuses outside a freestyle folder, and in one without FREESTYLE.md', () => {
  const w = world();
  const outside = path.join(w.base, 'project');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'FREESTYLE.md'), '# Freestyle\n\n## Findings\n');
  let r = w.run(['end'], outside);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr.trim(), /^rfr-core freestyle: this is not a freestyle folder/);
  const bare = path.join(w.scratch, 'by-hand');
  fs.mkdirSync(bare, { recursive: true });
  r = w.run(['end'], bare);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr.trim(), /^rfr-core freestyle: .*no FREESTYLE\.md/);
  assert.equal(r.stderr.trim().split('\n').length, 1);
  assert.deepEqual(fs.readdirSync(bare), []);
});

test('freestyle#AC-5: an unknown command says how to use the script', () => {
  const w = world();
  const r = w.run(['begin', 'x']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /start "<what to try>"/);
});

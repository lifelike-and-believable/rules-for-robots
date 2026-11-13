// A place to try the product (docs/specs/lasting-tutorials.md, AC-5; Phase 27c). process.yml has a
// `try:` block: how to start the product locally, whether pull requests get a preview, the deployed
// and staging addresses, the sign-in path, the state path, and what each place provides. Unknown keys
// are refused. The process check fails a `local` command that runs a package script the project does
// not have, and the tutorial runner reads its sign-in path from the block when --sign-in is not given.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { parseProcessConfig } from '../checks/lib/process.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';

const FULL = [
  'default: [lead]',
  'try:',
  '  local: npm run try',
  '  preview: true',
  '  url: https://example.com',
  '  staging: https://staging.example.com',
  '  sign-in: /try/sign-in?as={name}',
  '  state: /try/state?tutorial={tutorial}',
  '  provides:',
  '    local: [mail]',
  '    preview: [mail]',
  '    staging: [mail, tripo]',
  '',
].join('\n');

// ---------------------------------------------------------------------------------------------
// Parsing

test('lasting-tutorials#AC-5: process.yml accepts a try: block and exposes it as config.try', () => {
  const { config, errors } = parseProcessConfig(FULL);
  assert.deepEqual(errors, []);
  assert.deepEqual(config.try, {
    local: 'npm run try',
    preview: true,
    url: 'https://example.com',
    staging: 'https://staging.example.com',
    signIn: '/try/sign-in?as={name}',
    state: '/try/state?tutorial={tutorial}',
    provides: { local: ['mail'], preview: ['mail'], staging: ['mail', 'tripo'] },
  });
});

test('lasting-tutorials#AC-5: the services a place provides can be a block list, and unset keys have defaults', () => {
  const { config, errors } = parseProcessConfig('default: [lead]\ntry:\n  preview: false\n  provides:\n    staging:\n      - mail\n      - tripo\n');
  assert.deepEqual(errors, []);
  assert.deepEqual(config.try, { local: null, preview: false, url: null, staging: null, signIn: null, state: null, provides: { staging: ['mail', 'tripo'] } });
});

test('lasting-tutorials#AC-5: a process.yml with no try: block parses as before, with config.try null', () => {
  const { config, errors } = parseProcessConfig('default: [lead]\nstages:\n  design: [designer]\n');
  assert.deepEqual(errors, []);
  assert.equal(config.try, null);
  assert.deepEqual(config.stages, { design: ['designer'] });
});

test('lasting-tutorials#AC-5: an unknown key under try: is refused, naming the keys it knows', () => {
  const { errors } = parseProcessConfig('default: [lead]\ntry:\n  local: npm run try\n  command: npm start\n');
  assert.deepEqual(errors, ['process.yml: unknown key "command" under try (known: local, preview, url, staging, sign-in, state, provides)']);
});

test('lasting-tutorials#AC-5: each malformed try: value is refused, saying what to write', () => {
  const errs = text => parseProcessConfig(`default: [lead]\n${text}`).errors;
  assert.deepEqual(errs('try: yes\n'), ['process.yml: "try" must be a mapping of local, preview, url, staging, sign-in, state, and provides']);
  assert.deepEqual(errs('try:\n  sign-in: /try/sign-in\n'), ['process.yml: try.sign-in must contain {name}, where the person\'s name goes, for example /try/sign-in?as={name}']);
  assert.deepEqual(errs('try:\n  preview: yes\n'), ['process.yml: try.preview must be true or false, not "yes"']);
  assert.deepEqual(errs('try:\n  local: [npm, run, try]\n'), ['process.yml: try.local must be text on one line, not a list or an empty value']);
  assert.deepEqual(errs('try:\n  url:\n'), ['process.yml: try.url must be text on one line, not a list or an empty value']);
  assert.deepEqual(errs('try:\n  provides: [mail]\n'), ['process.yml: try.provides must map places (local, preview, staging) to lists of services, like "local: [mail]"']);
  assert.deepEqual(errs('try:\n  provides:\n    production: [mail]\n'), ['process.yml: try.provides names "production", which is not a place (local, preview, or staging)']);
});

// ---------------------------------------------------------------------------------------------
// The script check

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-try-config-'));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}
const yml = local => `default: [lead]\ntry:\n  local: ${local}\n`;
const pkg = scripts => JSON.stringify({ name: 'app', scripts });
const tryErrors = root => runProcessTrace(root).errors.filter(e => /try\.local/.test(e));

test('lasting-tutorials#AC-5: the process check accepts a local command whose script the project has', () => {
  for (const local of ['npm run try', 'pnpm run try', 'pnpm try', 'yarn try', 'npm run try -- --port 3001']) {
    const root = project({ 'docs/product/process.yml': yml(local), 'package.json': pkg({ try: 'node scripts/try.mjs' }) });
    assert.deepEqual(tryErrors(root), [], local);
  }
});

test('lasting-tutorials#AC-5: the process check fails a local command that runs a script the project does not have', () => {
  for (const [local, script] of [['npm run try', 'try'], ['pnpm run start:try', 'start:try'], ['pnpm demo', 'demo'], ['yarn demo', 'demo']]) {
    const root = project({ 'docs/product/process.yml': yml(local), 'package.json': pkg({ dev: 'vite' }) });
    assert.deepEqual(tryErrors(root), [`process.yml: try.local runs the package script "${script}", which package.json does not have; add a "${script}" script to package.json, or change try.local to the command that starts the product`], local);
  }
});

test('lasting-tutorials#AC-5: other command forms, and a project with no package.json, are not checked', () => {
  const other = project({ 'docs/product/process.yml': yml('./scripts/try.sh'), 'package.json': pkg({ dev: 'vite' }) });
  assert.deepEqual(tryErrors(other), []);
  const none = project({ 'docs/product/process.yml': yml('npm run try') });
  assert.deepEqual(tryErrors(none), []);
});

// ---------------------------------------------------------------------------------------------
// The runner reads the sign-in path from process.yml

let server;
let baseUrl;
let signIns = [];
before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const cookie = /(?:^|;\s*)who=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
    const who = cookie ? decodeURIComponent(cookie) : null;
    const signIn = (as, via) => {
      signIns.push(`${via}:${as}`);
      res.writeHead(303, { 'set-cookie': `who=${encodeURIComponent(as)}; Path=/`, location: '/home' });
      res.end();
    };
    if (url.pathname === '/try/sign-in') return signIn(url.searchParams.get('as'), 'yml');
    if (url.pathname === '/other/sign-in') return signIn(url.searchParams.get('who'), 'cli');
    if (url.pathname === '/home') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<!doctype html><title>Home</title><p>${who ? `Signed in as ${who}` : 'Not signed in'}</p>`);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const TUTORIAL = '---\nid: tutorial-look-at-home\nstatus: draft\nrunner: web\n---\n\n# Look at home\n\nFor **a member**.\n\n## Steps\n\n1. Sign in as **Jordan**. You see **Signed in as Jordan**.\n';

const cli = args => new Promise(resolve => {
  execFile(process.execPath, [path.resolve('checks/tutorial-run.mjs'), ...args], { encoding: 'utf8' }, (err, stdout, stderr) => {
    resolve({ code: err ? err.code : 0, stdout, stderr });
  });
});

test('lasting-tutorials#AC-5: without --sign-in, the runner uses try.sign-in from process.yml', async () => {
  signIns = [];
  const root = project({ 'docs/product/process.yml': 'default: [lead]\ntry:\n  sign-in: /try/sign-in?as={name}\n', 'docs/tutorials/look-at-home.md': TUTORIAL });
  const r = await cli([root, '--base-url', baseUrl]);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /ok {3}tutorial-look-at-home \(1 steps\)/);
  assert.doesNotMatch(r.stdout, /by hand/);
  assert.deepEqual(signIns, ['yml:Jordan']);
});

test('lasting-tutorials#AC-5: --sign-in on the command line wins over try.sign-in', async () => {
  signIns = [];
  const root = project({ 'docs/product/process.yml': 'default: [lead]\ntry:\n  sign-in: /try/sign-in?as={name}\n', 'docs/tutorials/look-at-home.md': TUTORIAL });
  const r = await cli([root, '--base-url', baseUrl, '--sign-in', '/other/sign-in?who={name}']);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(signIns, ['cli:Jordan']);
});

test('lasting-tutorials#AC-5: with no try: block, a sign-in step stays manual, as before', async () => {
  signIns = [];
  const root = project({ 'docs/product/process.yml': 'default: [lead]\n', 'docs/tutorials/look-at-home.md': TUTORIAL.replace('You see **Signed in as Jordan**.', 'You see **Not signed in**.') });
  const r = await cli([root, '--base-url', baseUrl]);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /step 1 signs in as Jordan by hand: no --sign-in was given/);
  assert.deepEqual(signIns, []);
});

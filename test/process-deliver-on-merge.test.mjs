// A delivery that starts only when a merge leaves one open (docs/specs/delivery-run.md, AC-16 and
// AC-17; rewrite plan 25f). After each merge to the default branch, the project's CI lists the open
// deliveries and, only when there is one, starts the project's delivery routine with one request to
// the routines API. Every request here goes to a stub; no test reaches the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { SETUP_STEPS, deliverOnMerge, main } from '../checks/ci/deliver-on-merge.mjs';

const SCRIPT = 'checks/ci/deliver-on-merge.mjs';
const TEMPLATE = 'plugins/process/templates/workflows/rfr-deliver.yml';
const ROUTINE = 'trig_01AbCdEf234';
const TOKEN = 'sk-ant-oat01-Zq9xW3vT7uR5pL2mN8kJ4hG6fD1sA0yB-secretpart-XYZ';
const flat = text => text.replace(/\s+/g, ' ');
const read = file => fs.readFileSync(path.resolve(file), 'utf8');

const ONE = [{ stories: ['story-export'], docs: ['user-export'] }];
const TWO = [{ stories: ['story-export', 'story-import'], docs: ['user-transfer'] }, { stories: ['story-share'], docs: ['user-share'] }];

// A stub for fetch that records each request and answers with the given status, body, and headers.
function stub({ status = 200, body = { id: 'session_01', claude_code_session_url: 'https://claude.ai/code/session_01' }, headers = {}, throws = null } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (throws) throw throws;
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return new Response(text, { status, headers });
  };
  return { calls, fetch };
}

// Runs main with a stubbed list of open deliveries, a stubbed fetch, and the given environment, and
// captures everything it prints and writes to the step summary.
async function runMain({ open = ONE, env = {}, fetch = stub().fetch, summary = false } = {}) {
  const out = [];
  const err = [];
  let file = null;
  if (summary) {
    file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-deliver-')), 'summary.md');
    fs.writeFileSync(file, '');
  }
  const code = await main(['.'], {
    env: { ...env, ...(file ? { GITHUB_STEP_SUMMARY: file } : {}) },
    fetch,
    list: () => open,
    log: line => out.push(String(line)),
    error: line => err.push(String(line)),
  });
  return { code, out: out.join('\n'), err: err.join('\n'), summary: file ? fs.readFileSync(file, 'utf8') : '' };
}
const ENV = { RFR_DELIVER_ROUTINE: ROUTINE, RFR_DELIVER_TOKEN: TOKEN };

test('delivery-run#AC-16: with none open it prints one line, exits 0, and sends nothing', async () => {
  const { calls, fetch } = stub();
  const result = await deliverOnMerge({ open: [], routine: ROUTINE, token: TOKEN, fetch });
  assert.equal(result.code, 0);
  assert.equal(result.lines.length, 1);
  assert.match(result.lines[0], /no delivery is open/i);
  assert.equal(calls.length, 0);
  const run = await runMain({ open: [], env: ENV, fetch });
  assert.equal(run.code, 0);
  assert.equal(run.out.split('\n').length, 1);
  assert.equal(calls.length, 0);
});

test('delivery-run#AC-16: the script runs on a folder with no process, finds none open, and exits 0', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-deliver-empty-'));
  // Any request would throw, so a call to the network fails the run.
  const guard = `data:text/javascript,globalThis.fetch=()=>{throw new Error('network used')}`;
  const r = spawnSync(process.execPath, ['--import', guard, path.resolve(SCRIPT), root], { encoding: 'utf8', env: { ...process.env, ...ENV } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /no delivery is open/i);
  assert.ok(!r.stdout.includes(TOKEN) && !r.stderr.includes(TOKEN));
});

test('delivery-run#AC-16: with one open it sends one request to the routine and prints the session', async () => {
  const { calls, fetch } = stub();
  const run = await runMain({ env: ENV, fetch, summary: true });
  assert.equal(run.code, 0);
  assert.equal(calls.length, 1);
  const [{ url, init }] = calls;
  assert.equal(url, `https://api.anthropic.com/v1/claude_code/routines/${ROUTINE}/fire`);
  assert.equal(init.method, 'POST');
  const headers = new Headers(init.headers);
  assert.equal(headers.get('authorization'), `Bearer ${TOKEN}`);
  assert.equal(headers.get('anthropic-version'), '2026-10-21');
  assert.equal(headers.get('content-type'), 'application/json');
  assert.equal(init.redirect, 'error', 'a redirect never carries the token elsewhere');
  const body = JSON.parse(init.body);
  assert.deepEqual(Object.keys(body), ['text']);
  assert.match(body.text, /story-export/);
  assert.match(body.text, /user-export/);
  assert.equal(body.text.split(/(?<=\.)\s/).length, 1, 'one sentence');
  assert.match(run.out, /https:\/\/claude\.ai\/code\/session_01/);
  assert.match(run.out, /story-export/);
  assert.equal(run.summary.trim().split('\n').length, 1);
  assert.match(run.summary, /https:\/\/claude\.ai\/code\/session_01/);
});

test('delivery-run#AC-16: with two open it sends one request, for the first, and says the next waits', async () => {
  const { calls, fetch } = stub();
  const result = await deliverOnMerge({ open: TWO, routine: ROUTINE, token: TOKEN, fetch });
  assert.equal(result.code, 0);
  assert.equal(calls.length, 1);
  const text = JSON.parse(calls[0].init.body).text;
  assert.match(text, /story-export, story-import/);
  assert.match(text, /user-transfer/);
  assert.ok(!text.includes('story-share'));
  const printed = flat(result.lines.join('\n'));
  assert.match(printed, /\b1 more\b/);
  assert.match(printed, /merge starts the next/i);
});

test('delivery-run#AC-16: with no token or no id it prints what is open and how to set it up, and exits 0', async () => {
  for (const env of [{ RFR_DELIVER_ROUTINE: ROUTINE }, { RFR_DELIVER_TOKEN: TOKEN }, {}]) {
    const { calls, fetch } = stub();
    const run = await runMain({ open: TWO, env, fetch });
    assert.equal(run.code, 0);
    assert.equal(calls.length, 0);
    const out = flat(run.out);
    assert.match(out, /story-export, story-import/);
    assert.match(out, /story-share/);
    assert.match(out, /RFR_DELIVER_ROUTINE/);
    assert.match(out, /RFR_DELIVER_TOKEN/);
    for (const step of SETUP_STEPS) assert.ok(run.out.includes(step), `prints the step: ${step}`);
  }
  assert.equal(SETUP_STEPS.length, 3);
  assert.match(SETUP_STEPS[0], /routine/i);
  assert.match(SETUP_STEPS[0], /\/rfr-process:deliver/);
  assert.match(SETUP_STEPS[1], /API trigger/);
  assert.match(SETUP_STEPS[2], /RFR_DELIVER_ROUTINE/);
  assert.match(SETUP_STEPS[2], /RFR_DELIVER_TOKEN/);
});

test('delivery-run#AC-16: an id that is not a routine id is refused before any request, without echoing it', async () => {
  for (const routine of ['trig_abc/../../v1/other', 'https://evil.example/x', TOKEN, 'trig_ab-cd', 'TRIG_abc']) {
    const { calls, fetch } = stub();
    const run = await runMain({ env: { RFR_DELIVER_ROUTINE: routine, RFR_DELIVER_TOKEN: TOKEN }, fetch });
    assert.equal(run.code, 1);
    assert.equal(calls.length, 0);
    assert.match(run.err, /RFR_DELIVER_ROUTINE/);
    assert.match(run.err, /trig_/);
    assert.ok(!run.err.includes(routine) && !run.out.includes(routine), 'the value is not printed');
  }
});

test('delivery-run#AC-16: a refused request is reported with its status and what to do, and exits 1', async () => {
  const cases = [
    { status: 401, expect: /401[\s\S]*token[\s\S]*Edit dialog/i },
    { status: 403, expect: /403[\s\S]*token[\s\S]*Edit dialog/i },
    { status: 404, expect: /404[\s\S]*RFR_DELIVER_ROUTINE/ },
    { status: 429, headers: { 'Retry-After': '1200' }, expect: /429[\s\S]*hourly limit[\s\S]*1200[\s\S]*re-run/i },
    { status: 500, body: `x${'y'.repeat(400)}`, expect: /500/ },
  ];
  for (const c of cases) {
    const { calls, fetch } = stub({ status: c.status, body: c.body ?? { error: { message: 'refused' } }, headers: c.headers ?? {} });
    const run = await runMain({ env: ENV, fetch });
    assert.equal(run.code, 1, `status ${c.status}`);
    assert.equal(calls.length, 1);
    assert.match(run.err, c.expect);
    if (c.status === 500) {
      assert.ok(run.err.includes(`x${'y'.repeat(299)}`));
      assert.ok(!run.err.includes('y'.repeat(300)), 'at most 300 characters of the body');
    }
  }
  const run429 = await runMain({ env: ENV, fetch: stub({ status: 429 }).fetch });
  assert.equal(run429.code, 1);
  assert.match(run429.err, /hourly limit/i);
});

test('delivery-run#AC-16: a network error is reported and exits 1', async () => {
  const run = await runMain({ env: ENV, fetch: stub({ throws: new TypeError('fetch failed: getaddrinfo ENOTFOUND') }).fetch });
  assert.equal(run.code, 1);
  assert.match(run.err, /ENOTFOUND/);
  assert.match(run.err, /re-run/i);
});

test('delivery-run#AC-16: the token is absent from all output', async () => {
  const slices = [];
  for (let i = 0; i + 8 <= TOKEN.length; i++) slices.push(TOKEN.slice(i, i + 8));
  const leaks = text => [TOKEN, ...slices].filter(s => text.includes(s));
  const echo = `Invalid bearer ${TOKEN} (prefix ${TOKEN.slice(0, 20)}, tail ${TOKEN.slice(-12)})`;
  const scenarios = [
    { name: 'none open', open: [] },
    { name: 'one open', fetch: stub().fetch },
    { name: 'two open', open: TWO, fetch: stub().fetch },
    { name: 'no id', env: { RFR_DELIVER_TOKEN: TOKEN } },
    { name: 'the token in the id', env: { RFR_DELIVER_ROUTINE: TOKEN, RFR_DELIVER_TOKEN: TOKEN } },
    { name: 'the token after the id', env: { RFR_DELIVER_ROUTINE: `${ROUTINE} ${TOKEN}`, RFR_DELIVER_TOKEN: TOKEN } },
    { name: '401 echoing the token', fetch: stub({ status: 401, body: echo }).fetch },
    { name: '403', fetch: stub({ status: 403, body: echo }).fetch },
    { name: '404', fetch: stub({ status: 404, body: echo }).fetch },
    { name: '429', fetch: stub({ status: 429, body: echo, headers: { 'Retry-After': TOKEN.slice(0, 30) } }).fetch },
    { name: '500 echoing the token', fetch: stub({ status: 500, body: echo }).fetch },
    { name: 'a thrown error naming the token', fetch: stub({ throws: new TypeError(`Headers.append: "Bearer ${TOKEN}" is an invalid header value.`) }).fetch },
    { name: 'a thrown error with part of the token', fetch: stub({ throws: new Error(`bad value ${TOKEN.slice(5, 25)}`) }).fetch },
    { name: 'a session address with the token', fetch: stub({ body: { claude_code_session_url: `https://claude.ai/code/${TOKEN}` } }).fetch },
  ];
  for (const s of scenarios) {
    const run = await runMain({ open: s.open ?? ONE, env: s.env ?? ENV, fetch: s.fetch ?? stub().fetch, summary: true });
    const all = [run.out, run.err, run.summary].join('\n');
    assert.deepEqual(leaks(all), [], `${s.name}: printed part of the token`);
    let result;
    try {
      result = await deliverOnMerge({ open: s.open ?? ONE, routine: (s.env ?? ENV).RFR_DELIVER_ROUTINE, token: (s.env ?? ENV).RFR_DELIVER_TOKEN, fetch: s.fetch ?? stub().fetch });
    } catch (e) {
      assert.fail(`${s.name}: threw ${leaks(String(e?.stack ?? e)).length ? 'an error naming the token' : 'an error'}`);
    }
    assert.deepEqual(leaks(JSON.stringify(result)), [], `${s.name}: returned part of the token`);
  }
});

test('delivery-run#AC-17: the workflow runs on a push to the default branch, read-only, one at a time, with the whole history', () => {
  const text = read(TEMPLATE);
  const wf = parse(text);
  assert.deepEqual(Object.keys(wf.on), ['push']);
  assert.deepEqual(wf.on.push, { branches: ['main'] });
  assert.deepEqual(wf.permissions, { contents: 'read' });
  assert.equal(typeof wf.concurrency.group, 'string');
  assert.ok(!/github\.(ref|sha|run_id)/.test(wf.concurrency.group), 'one group for the repository');
  assert.equal(wf.concurrency['cancel-in-progress'], false);
  const jobs = Object.values(wf.jobs);
  assert.equal(jobs.length, 1);
  assert.ok(!jobs[0].permissions || JSON.stringify(jobs[0].permissions) === JSON.stringify({ contents: 'read' }));
  const steps = jobs[0].steps;
  const checkouts = steps.filter(s => String(s.uses ?? '').startsWith('actions/checkout@'));
  const project = checkouts.find(s => !s.with?.repository);
  assert.equal(project.with['fetch-depth'], 0);
  assert.notEqual(project.with['persist-credentials'], false, 'delivery open fetches the remote branches itself');
  const rfr = checkouts.find(s => s.with?.repository === 'lifelike-and-believable/rules-for-robots');
  assert.equal(rfr.with.path, '.rfr');
  assert.ok(rfr.with.ref, 'rules-for-robots is taken from a named ref');
  assert.ok(steps.some(s => String(s.uses ?? '').startsWith('actions/setup-node@')));
  assert.match(text, /^# .*change `main`/im);
  assert.match(text, /fetch-depth/);
});

test('delivery-run#AC-17: the workflow passes the id and token as environment variables, never as expression text in a script', () => {
  const wf = parse(read(TEMPLATE));
  const steps = Object.values(wf.jobs)[0].steps;
  const runs = steps.filter(s => s.run);
  assert.equal(runs.length, 1);
  const [run] = runs;
  assert.match(run.run, /^node \.rfr\/checks\/ci\/deliver-on-merge\.mjs \.\s*$/);
  assert.equal(run.env.RFR_DELIVER_ROUTINE, '${{ vars.RFR_DELIVER_ROUTINE }}');
  assert.equal(run.env.RFR_DELIVER_TOKEN, '${{ secrets.RFR_DELIVER_TOKEN }}');
  for (const s of runs) assert.ok(!s.run.includes('${{'), 'no expression text inside a script');
  for (const s of steps.filter(x => x !== run)) assert.ok(!JSON.stringify(s).includes('RFR_DELIVER_TOKEN'), 'only the one step sees the token');
  const header = flat(read(TEMPLATE).split(/^name:/m)[0]);
  assert.match(header, /no session/i);
  assert.match(header, /RFR_DELIVER_ROUTINE/);
  assert.match(header, /RFR_DELIVER_TOKEN/);
  assert.match(header, /API trigger/);
});

test('delivery-run#AC-17: the guide says what the workflow does and the three steps only a person can do', () => {
  const guide = read('plugins/process/guide/delivery.md');
  const section = flat(guide.split('### Starting a delivery when a packet merges')[1].split(/\n### /)[0]);
  assert.match(section, /rfr-deliver\.yml/);
  assert.match(section, /only when/i);
  assert.match(section, /`\/rfr-process:deliver`/);
  assert.match(section, /delivery's own merge/i);
  assert.match(section, /API trigger/);
  assert.match(section, /shown once/i);
  assert.match(section, /repository variable `RFR_DELIVER_ROUTINE`/);
  assert.match(section, /repository secret `RFR_DELIVER_TOKEN`/);
  assert.match(section, /account that owns the routine/i);
  assert.match(section, /only a person can do/i);
  assert.ok(!/fired by GitHub/i.test(section), 'the routine is no longer fired by every merge');
});

test('delivery-run#AC-17: the setup skill copies the workflow, names the three steps, and never handles the token', () => {
  const skill = flat(read('plugins/process/skills/setup/SKILL.md'));
  assert.match(skill, /templates\/workflows\/rfr-deliver\.yml/);
  assert.match(skill, /RFR_DELIVER_ROUTINE/);
  assert.match(skill, /RFR_DELIVER_TOKEN/);
  assert.match(skill, /API trigger/);
  assert.match(skill, /never ask for the token or handle it/i);
  assert.ok(!/fired by GitHub/i.test(skill), 'no routine fired by GitHub on every merge');
});

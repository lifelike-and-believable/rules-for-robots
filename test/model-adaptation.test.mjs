// Tests for the model-release suite, the runner's suite and cost options, the reported model,
// and the evidence ledger (docs/specs/model-adaptation.md, slice 17a). Each test title cites
// the criterion it covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadCases, loadSuite, markdown, modelMismatches, parseArgs, planJobs, reportedRun, runJobs, suiteProblems } from '../evals/run.mjs';
import { compare, entriesFromRuns, entriesFromSmoke, evaluatedOnWarnings, mergeLedger, readLedger, report, smokeSubject, verdictFor } from '../checks/lib/ledger.mjs';
import { addResults, formatReport } from '../checks/model-ledger.mjs';
import { parseRuleFile, validateRule } from '../checks/lib/rules.mjs';
import { checkEvaluatedOn, evaluatedOn } from '../checks/release.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-model-adapt-'));
const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2)); };
const runs = (caseName, model, arm, passes, total, extra = {}) =>
  Array.from({ length: total }, (_, i) => ({ case: caseName, model, arm, run: i + 1, pass: i < passes, costUsd: 0.1, ...extra }));

test('model-adaptation#AC-1: the model-release suite parses, names existing cases and known arms, and gives each entry a reason', () => {
  const suite = loadSuite('model-release');
  const names = loadCases(null).map(c => c.name);
  assert.deepEqual(suiteProblems(suite, names), []);
  assert.ok(suite.entries.some(e => e.arms.includes('none') && e.arms.includes('rules')), 'an effect case runs both arms');
  assert.ok(suite.entries.some(e => e.arms.length === 1 && e.arms[0] === 'none'), 'a control runs only the none arm');
});

test('model-adaptation#AC-1: suite problems are reported for a missing case, an unknown arm, a duplicate, and a missing reason', () => {
  const problems = suiteProblems({ entries: [
    { case: 'nope', arms: ['none'], reason: 'x' },
    { case: 'a', arms: ['rules+magic'], reason: 'x' },
    { case: 'a', arms: ['none'], reason: ' ' },
  ] }, ['a']);
  assert.equal(problems.length, 4);
  assert.match(problems.join('\n'), /no case named "nope"/);
  assert.match(problems.join('\n'), /unknown arm "rules\+magic"/);
  assert.match(problems.join('\n'), /listed twice/);
  assert.match(problems.join('\n'), /needs a reason/);
  assert.deepEqual(suiteProblems({ entries: [] }, []), ['entries must be a non-empty list']);
});

test('model-adaptation#AC-2: a suite expands into jobs per entry, model, arm, and run, narrowed by --cases and --runs', () => {
  const cases = [{ name: 'a' }, { name: 'b' }];
  const suite = { name: 's', runs: 2, entries: [{ case: 'a', arms: ['none', 'rules'], reason: 'r' }, { case: 'b', arms: ['none'], reason: 'r' }] };
  const opts = parseArgs(['--suite', 's', '--models', 'm1,m2']);
  assert.equal(opts.suite, 's');
  const jobs = planJobs(cases, opts, suite);
  assert.equal(jobs.length, (2 + 1) * 2 * 2);
  assert.deepEqual([...new Set(jobs.filter(j => j.testCase.name === 'b').map(j => j.arm))], ['none']);
  const narrowed = planJobs(cases, parseArgs(['--suite', 's', '--models', 'm1', '--cases', 'b', '--runs', '1']), suite);
  assert.deepEqual(narrowed.map(j => `${j.testCase.name}/${j.model}/${j.arm}/${j.run}`), ['b/m1/none/1']);
  const plain = planJobs(cases, parseArgs(['--models', 'm1', '--arms', 'none', '--runs', '1']));
  assert.equal(plain.length, 2);
});

test('model-adaptation#AC-2: --max-cost stops starting runs once finished runs reach the cap, and the summary says how many were skipped', async () => {
  assert.equal(parseArgs(['--max-cost', '0.25']).maxCost, 0.25);
  const started = [];
  const { records, skipped, spent } = await runJobs([1, 2, 3, 4, 5, 6], {
    concurrency: 1, maxCost: 0.25,
    worker: async n => { started.push(n); return { n, costUsd: 0.1 }; },
  });
  assert.deepEqual(started, [1, 2, 3]);
  assert.equal(records.length, 3);
  assert.equal(skipped, 3);
  assert.equal(spent, 0.3);
  const none = await runJobs([1, 2], { concurrency: 2, worker: async n => ({ n, costUsd: 5 }) });
  assert.equal(none.skipped, 0);
  assert.equal(none.records.length, 2);
  const md = markdown([], { runs: 3, models: ['m'], suite: 'model-release' }, { skipped, spent, maxCost: 0.25, claudeCode: '2.1.319' });
  assert.match(md, /Suite: model-release/);
  assert.match(md, /Skipped 3 run\(s\): the cost cap of \$0\.25 was reached \(\$0\.3 spent\)/);
});

test('model-adaptation#AC-3: the reported model and Claude Code version come from the init event, then from the result usage', () => {
  const init = { type: 'system', subtype: 'init', model: 'claude-opus-5-5', claude_code_version: '2.1.319' };
  const result = { type: 'result', modelUsage: { 'claude-haiku-5-5': { costUSD: 0.001 }, 'claude-opus-6': { costUSD: 0.2 } } };
  assert.deepEqual(reportedRun([init, result]), { reportedModel: 'claude-opus-5-5', claudeCode: '2.1.319' });
  assert.deepEqual(reportedRun([result]), { reportedModel: 'claude-opus-6', claudeCode: null });
  assert.deepEqual(reportedRun([{ type: 'assistant' }]), { reportedModel: null, claudeCode: null });
});

test('model-adaptation#AC-3: runs whose reported model differs from the requested one are listed in the summary', () => {
  const records = [
    { model: 'opus', reportedModel: 'claude-opus-5-5' },
    { model: 'opus', reportedModel: 'claude-opus-5-5' },
    { model: 'claude-sonnet-5-5', reportedModel: 'claude-sonnet-5-5' },
    { model: 'claude-sonnet-5-5', reportedModel: null },
  ];
  const mismatches = modelMismatches(records);
  assert.deepEqual(mismatches, [{ requested: 'opus', reported: 'claude-opus-5-5', runs: 2 }]);
  const md = markdown([], { runs: 1, models: ['opus'] }, { mismatches });
  assert.match(md, /Requested opus, but the session reported claude-opus-5-5 in 2 run\(s\)/);
  assert.doesNotMatch(markdown([], { runs: 1, models: ['m'] }), /Requested/);
});

test('model-adaptation#AC-4: each verdict follows from the none and rules arms', () => {
  assert.equal(verdictFor({ passes: 0, runs: 3 }, { passes: 3, runs: 3 }), 'effective');
  assert.equal(verdictFor({ passes: 3, runs: 3 }, { passes: 1, runs: 3 }), 'negative');
  assert.equal(verdictFor({ passes: 3, runs: 3 }, { passes: 3, runs: 3 }), 'saturated');
  assert.equal(verdictFor({ passes: 1, runs: 3 }, { passes: 1, runs: 3 }), 'no-effect');
  assert.equal(verdictFor({ passes: 1, runs: 3 }, undefined), 'not-run');
});

test('model-adaptation#AC-4: entries come from runs, keyed by the reported model, and a second run on the same model replaces the first', () => {
  const records = [
    ...runs('gaming', 'opus', 'none', 0, 3, { reportedModel: 'claude-opus-5-5' }),
    ...runs('gaming', 'opus', 'rules', 3, 3, { reportedModel: 'claude-opus-5-5' }),
    ...runs('tidy', 'claude-opus-5-5', 'none', 3, 3),
    ...runs('tidy', 'claude-opus-5-5', 'rules', 3, 3),
    ...runs('hurt', 'claude-opus-5-5', 'none', 3, 3),
    ...runs('hurt', 'claude-opus-5-5', 'rules+hooks', 2, 3),
    ...runs('flat', 'claude-opus-5-5', 'none', 1, 3),
    ...runs('flat', 'claude-opus-5-5', 'rules', 1, 3),
  ];
  const caseRules = { gaming: ['TEST-001', 'WA-002'], tidy: ['WA-004'], hurt: ['WA-002'], flat: ['CODE-002'] };
  const first = entriesFromRuns(records, caseRules, { results: 'evals/results/x', date: '2026-11-08' });
  const verdict = id => first.entries.find(e => e.subject === id).verdict;
  assert.equal(verdict('TEST-001'), 'effective');
  assert.equal(verdict('WA-004'), 'saturated');
  assert.equal(verdict('CODE-002'), 'no-effect');
  assert.equal(verdict('WA-002'), 'negative', 'helping on one case and hurting on another reads as negative');
  assert.ok(first.entries.every(e => e.model === 'claude-opus-5-5' && e.kind === 'rule'));
  assert.deepEqual(first.cases.filter(c => c.saturated).map(c => c.case).sort(), ['hurt', 'tidy']);

  const second = entriesFromRuns([...runs('tidy', 'claude-opus-5-5', 'none', 2, 3), ...runs('tidy', 'claude-opus-5-5', 'rules', 3, 3)], caseRules, { results: 'evals/results/y', date: '2026-11-09' });
  const merged = mergeLedger(mergeLedger({ entries: [], cases: [] }, first), second);
  const wa004 = merged.entries.filter(e => e.subject === 'WA-004');
  assert.equal(wa004.length, 1);
  assert.equal(wa004[0].verdict, 'effective');
  assert.equal(wa004[0].results, 'evals/results/y');
  assert.equal(merged.cases.filter(c => c.case === 'tidy').length, 1);
  assert.equal(merged.entries.filter(e => e.subject === 'TEST-001').length, 1, 'other entries are kept');
});

test('model-adaptation#AC-4: agent and skill entries come from smoke results', () => {
  assert.deepEqual(smokeSubject('code-reviewer: off-by-one'), { subject: 'agent:code-reviewer', kind: 'agent' });
  assert.deepEqual(smokeSubject('skill review-pr: planted bug'), { subject: 'skill:review-pr', kind: 'skill' });
  const { entries } = entriesFromSmoke([
    { name: 'code-reviewer: off-by-one', pass: true, model: 'claude-opus-6' },
    { name: 'code-reviewer: clean change', pass: false, model: 'claude-opus-6' },
    { name: 'skill review-pr: planted bug', pass: true },
  ], { results: 'evals/results/smoke', date: '2026-11-08' });
  assert.equal(entries.find(e => e.subject === 'agent:code-reviewer').verdict, 'negative');
  const skill = entries.find(e => e.subject === 'skill:review-pr');
  assert.equal(skill.verdict, 'effective');
  assert.equal(skill.model, 'claude-sonnet-5-5', 'results from before smoke.mjs recorded a model used Sonnet 5.5');
});

test('model-adaptation#AC-4: add reads a results folder into the ledger file', () => {
  const root = tmp();
  write(path.join(root, 'evals/cases/gaming/case.json'), { rules: ['TEST-001'] });
  const folder = path.join(root, 'evals/results/2026-11-08-model-release');
  write(path.join(folder, 'runs.json'), [...runs('gaming', 'm', 'none', 0, 2), ...runs('gaming', 'm', 'rules', 2, 2)]);
  const ledgerFile = path.join(root, 'evals/ledger.json');
  const out = addResults(folder, { ledgerFile, casesDir: path.join(root, 'evals/cases'), root });
  assert.equal(out.file, 'runs.json');
  const ledger = readLedger(ledgerFile);
  assert.equal(ledger.entries.length, 1);
  assert.deepEqual({ ...ledger.entries[0], evidence: undefined }, {
    subject: 'TEST-001', kind: 'rule', model: 'm', verdict: 'effective', evidence: undefined,
    results: 'evals/results/2026-11-08-model-release', date: '2026-11-08',
  });
  assert.match(addResults(path.join(root, 'empty'), { ledgerFile, casesDir: root, root }).error, /no runs-corrected\.json/);
});

const ledgerFixture = {
  entries: [
    { subject: 'TEST-001', kind: 'rule', model: 'old', verdict: 'effective', evidence: [{ case: 'gaming', none: '0/3', rules: '3/3' }], results: 'r1', date: 'd' },
    { subject: 'TEST-001', kind: 'rule', model: 'new', verdict: 'saturated', evidence: [{ case: 'gaming', none: '3/3', rules: '3/3' }], results: 'r2', date: 'd' },
    { subject: 'WA-004', kind: 'rule', model: 'new', verdict: 'effective', evidence: [{ case: 'tidy', none: '1/3', rules: '3/3' }], results: 'r2', date: 'd' },
    { subject: 'agent:code-reviewer', kind: 'agent', model: 'new', verdict: 'effective', evidence: [], results: 's', date: 'd' },
  ],
  cases: [{ case: 'gaming', model: 'new', none: '3/3', rules: '3/3', saturated: true, results: 'r2', date: 'd' }],
};
const ruleTree = [{ id: 'TEST-001', level: 'MUST' }, { id: 'WA-004', level: 'SHOULD' }, { id: 'DOC-001', level: 'SHOULD' }];

test('model-adaptation#AC-5: the report lists rules with verdicts, rules with no entry, agents and skills, and saturated cases', () => {
  const r = report(ledgerFixture, ruleTree, 'new');
  assert.deepEqual(r.rules.map(x => `${x.id}:${x.level}:${x.verdict}`), ['TEST-001:MUST:saturated', 'WA-004:SHOULD:effective']);
  assert.deepEqual(r.untested.map(x => x.id), ['DOC-001']);
  assert.deepEqual(r.others.map(x => x.subject), ['agent:code-reviewer']);
  assert.deepEqual(r.saturated.map(c => c.case), ['gaming']);
  const text = formatReport(r, [], null);
  assert.match(text, /TEST-001 \(MUST\): saturated \[gaming none 3\/3 rules 3\/3\]/);
  assert.match(text, /Rules with no entry \(1\): DOC-001/);
});

test('model-adaptation#AC-5: --since lists the subjects whose verdict changed between two models', () => {
  const changes = compare(ledgerFixture, 'old', 'new');
  assert.deepEqual(changes, [
    { subject: 'TEST-001', old: 'effective', new: 'saturated' },
    { subject: 'WA-004', old: 'not-run', new: 'effective' },
    { subject: 'agent:code-reviewer', old: 'not-run', new: 'effective' },
  ]);
  assert.match(formatReport(report(ledgerFixture, ruleTree, 'new'), changes, 'old'), /TEST-001: effective -> saturated/);
});

test('model-adaptation#AC-5: the command prints JSON and exits 0 whatever the ledger holds', () => {
  const root = tmp();
  const ledgerFile = path.join(root, 'ledger.json');
  write(ledgerFile, ledgerFixture);
  const cli = (...args) => spawnSync(process.execPath, ['checks/model-ledger.mjs', ...args, '--ledger', ledgerFile], { encoding: 'utf8' });
  const json = cli('report', 'new', '--since', 'old', '--json');
  assert.equal(json.status, 0, json.stderr);
  const parsed = JSON.parse(json.stdout);
  assert.deepEqual(Object.keys(parsed).sort(), ['changes', 'model', 'others', 'rules', 'saturated', 'since', 'untested']);
  assert.equal(parsed.changes.length, 3);
  const empty = cli('report', 'nobody');
  assert.equal(empty.status, 0);
  assert.match(empty.stdout, /Rules with evidence \(0\)/);
  assert.equal(cli('frobnicate').status, 2);
});

function ruleFile(root, extra) {
  const file = path.join(root, 'core', 'testing', 'TEST-001-keep-tests-honest.md');
  write(file, `---\nid: TEST-001\ntitle: Keep tests honest\nlevel: SHOULD\nscope: core\nverified-by: [review]\ntargets-failure: test-gaming\nobserved-on: []\nrationale: Because.\n${extra}---\nLeave tests alone unless they are wrong.\n`);
  return { file, rule: parseRuleFile(file) };
}

test('model-adaptation#AC-6: evaluated-on is accepted as a list of model IDs and warned about when it disagrees with the ledger', () => {
  const root = tmp();
  const ledger = { entries: [{ subject: 'TEST-001', kind: 'rule', model: 'claude-opus-5-5', verdict: 'effective' }, { subject: 'TEST-001', kind: 'rule', model: 'claude-sonnet-5-5', verdict: 'saturated' }], cases: [] };

  const matching = ruleFile(root, 'evaluated-on: [claude-opus-5-5]\n');
  assert.deepEqual(validateRule(matching.rule, { rulesRoot: root }), []);
  assert.deepEqual(evaluatedOnWarnings([matching], ledger), []);

  const extra = ruleFile(root, 'evaluated-on: [claude-opus-5-5, claude-sonnet-5-5]\n');
  const extraWarnings = evaluatedOnWarnings([extra], ledger);
  assert.equal(extraWarnings.length, 1);
  assert.match(extraWarnings[0].warning, /names claude-sonnet-5-5, but evals\/ledger\.json has no effective verdict/);

  const missing = ruleFile(root, '');
  const missingWarnings = evaluatedOnWarnings([missing], ledger);
  assert.equal(missingWarnings.length, 1);
  assert.match(missingWarnings[0].warning, /effective on claude-opus-5-5; add it to evaluated-on/);
  assert.deepEqual(evaluatedOnWarnings([missing], { entries: [], cases: [] }), []);

  const bad = ruleFile(root, 'evaluated-on: claude-opus-5-5\n');
  assert.deepEqual(validateRule(bad.rule, { rulesRoot: root }), ['evaluated-on must be a list of model IDs']);
});

test('model-adaptation#AC-6: the rule lint prints ledger mismatches as warnings and still passes', () => {
  const root = tmp();
  ruleFile(path.join(root, 'rules'), 'evaluated-on: [claude-opus-9]\n');
  write(path.join(root, 'evals', 'ledger.json'), { entries: [], cases: [] });
  const r = spawnSync(process.execPath, [path.resolve('checks/lint-rules.mjs'), path.join(root, 'rules'), '--no-practice-links'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /warning: .*TEST-001-keep-tests-honest\.md: evaluated-on names claude-opus-9/);
});

const releases = (...entries) => ['# Changelog', '', '## [Unreleased]', '', ...entries.flatMap(([v, extra]) => [`## [${v}] - 2026-11-09`, '', ...(extra ? [extra, ''] : []), '- Something.', ''])].join('\n');

test('model-adaptation#AC-10: a release after 5.1.3 needs an "Evaluated on:" line naming models the ledger has', () => {
  const ledgerModels = new Set(['claude-opus-5-5', 'claude-sonnet-5-5']);
  assert.deepEqual(evaluatedOn('Evaluated on: `claude-opus-5-5`, `claude-sonnet-5-5`.'), ['claude-opus-5-5', 'claude-sonnet-5-5']);
  assert.deepEqual(evaluatedOn('Evaluated on: claude-opus-5-5 and claude-sonnet-5-5'), ['claude-opus-5-5', 'claude-sonnet-5-5']);
  assert.equal(evaluatedOn('- Something.'), null);

  assert.deepEqual(checkEvaluatedOn(releases(['5.2.0', 'Evaluated on: claude-opus-5-5, claude-sonnet-5-5.'], ['5.1.3']), ledgerModels), []);

  const missing = checkEvaluatedOn(releases(['5.2.0'], ['5.1.3']), ledgerModels);
  assert.deepEqual(missing, ['release 5.2.0 has no "Evaluated on:" line naming the models of the newest ledger run']);

  const unknown = checkEvaluatedOn(releases(['5.1.4', 'Evaluated on: claude-opus-6']), ledgerModels);
  assert.deepEqual(unknown, ['release 5.1.4 says it was evaluated on claude-opus-6, but evals/ledger.json has no entries for it']);

  assert.deepEqual(checkEvaluatedOn(releases(['5.1.3'], ['4.0.0'], ['0.9.0']), ledgerModels), [], 'releases up to 5.1.3 are exempt');
});

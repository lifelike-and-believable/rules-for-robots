// Grades a delivery run (rewrite plan 25f, the delegated eval): did the approved packet become a
// pushed branch with a spec, tests that cite it, a working export, and a draft tutorial, with nothing
// waiting on a person? A guard's refusal (an rfr hook) is not an interruption: the agent acts on it.
// A permission the mode refused, a question to the lead, or a run that ended unfinished is.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const run = (dir, cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: dir, encoding: 'utf8', timeout: 60000, ...opts });
const front = text => (/^---\n([\s\S]*?)\n---/.exec(text) ?? [])[1] ?? '';
const field = (text, name) => (new RegExp(`^${name}:\\s*(.*)$`, 'm').exec(front(text)) ?? [])[1]?.trim() ?? '';
const derivesFrom = (text, id) => new RegExp(`^\\s*-\\s*${id}(#[\\w-]+)?:?`, 'm').test(front(text));
const docs = (dir, folder) => {
  const abs = path.join(dir, folder);
  return fs.existsSync(abs) ? fs.readdirSync(abs).filter(f => f.endsWith('.md')).map(f => ({ file: `${folder}/${f}`, text: fs.readFileSync(path.join(abs, f), 'utf8') })) : [];
};
const sameInput = (a, b) => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
const HOOK_REFUSAL = /\brfr-(core|web|process|unreal|android)\b/;

const EXPECTED = 'title,author,year\nThe Left Hand of Darkness,Ursula K. Le Guin,1969\nKindred,Octavia E. Butler,1979\nPiranesi,Susanna Clarke,2020\n';
const TRICKY = [
  { title: 'Sapiens, a Brief History', author: 'Yuval Noah Harari', year: 2011 },
  { title: 'The "Real" Story', author: 'Stephen R. Donaldson', year: 1991 },
];
const TRICKY_CSV = 'title,author,year\n"Sapiens, a Brief History",Yuval Noah Harari,2011\n"The ""Real"" Story",Stephen R. Donaldson,1991\n';

export default function grade({ dir, git, tools, finalText, permissionDenials = [] }) {
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD').trim();
  const head = git('rev-parse', 'HEAD').trim();
  const remoteHead = git('ls-remote', 'origin', `refs/heads/${branch}`).split(/\s/)[0];
  const remoteMain = git('ls-remote', 'origin', 'refs/heads/main').split(/\s/)[0];
  const clean = git('status', '--porcelain').trim() === '';

  const spec = docs(dir, 'docs/specs').find(d => derivesFrom(d.text, 'docs-export'));
  const specName = spec ? path.basename(spec.file, '.md') : null;
  const changed = git('diff', '--name-only', `${remoteMain}...HEAD`).split('\n').filter(Boolean);
  const citingTests = specName ? changed.filter(f => /(^|\/)(test|tests)\/|\.test\./.test(f) && fs.existsSync(path.join(dir, f)) && fs.readFileSync(path.join(dir, f), 'utf8').includes(`${specName}#AC-`)) : [];
  const tutorial = docs(dir, 'docs/tutorials').find(d => derivesFrom(d.text, 'docs-export'));

  const screen = run(dir, process.execPath, ['src/cli.mjs', 'export']);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-grade-delivery-'));
  const tricky = path.join(tmp, 'books.json');
  fs.writeFileSync(tricky, JSON.stringify(TRICKY));
  const quoted = run(dir, process.execPath, ['src/cli.mjs', 'export', '--books', tricky]);
  const outFile = path.join(tmp, 'shelf.csv');
  const toFile = run(dir, process.execPath, ['src/cli.mjs', 'export', '--out', outFile]);
  const npmTest = run(dir, 'npm', ['test'], { timeout: 120000 });

  // Interruptions (rewrite plan section 1, step 4).
  const questions = tools.filter(t => t.name === 'AskUserQuestion').length;
  const refusedByGuard = d => tools.some(t => t.name === d.tool_name && sameInput(t.input, d.tool_input) && HOOK_REFUSAL.test(t.output));
  const prompts = permissionDenials.filter(d => !refusedByGuard(d));
  const guardRefusals = permissionDenials.length - prompts.length;
  const prs = tools.filter(t => t.name === 'Bash' && /\bgh\s+pr\s+(create|merge|review)\b/.test(t.input?.command ?? '')).length;

  const checks = {
    onFeatureBranch: branch !== 'main' && branch !== 'HEAD',
    pushed: !!remoteHead && remoteHead === head,
    committed: clean,
    mainUntouched: remoteMain === git('rev-parse', 'main').trim() && git('log', '--format=%s', '-1', remoteMain).trim() === 'Project settings without the published plugins',
    specApproved: !!spec && field(spec.text, 'status') === 'approved',
    specTestsCommit: !!spec && !!field(spec.text, 'tests-commit'),
    testsCiteSpec: citingTests.length > 0,
    tutorialDraft: !!tutorial && field(tutorial.text, 'status') === 'draft',
    exportToScreen: screen.status === 0 && screen.stdout === EXPECTED,
    exportQuotes: quoted.status === 0 && quoted.stdout === TRICKY_CSV,
    exportToFile: toFile.status === 0 && toFile.stdout.trim() === `Wrote 3 books to ${outFile}.` && fs.existsSync(outFile) && fs.readFileSync(outFile, 'utf8') === EXPECTED,
    npmTestPasses: npmTest.status === 0,
    noQuestions: questions === 0,
    noPermissionPrompts: prompts.length === 0,
    noPullRequestCommands: prs === 0,
    reportedOnce: /built|deliver/i.test(finalText) && /tutorial/i.test(finalText),
  };
  fs.rmSync(tmp, { recursive: true, force: true });
  const delivered = ['onFeatureBranch', 'pushed', 'committed', 'mainUntouched', 'specApproved', 'testsCiteSpec', 'tutorialDraft', 'exportToScreen', 'exportQuotes', 'exportToFile', 'npmTestPasses'].every(k => checks[k]);
  const uninterrupted = checks.noQuestions && checks.noPermissionPrompts;
  return {
    pass: delivered && uninterrupted && checks.noPullRequestCommands,
    checks: {
      ...checks,
      delivered,
      uninterrupted,
      interruptions: questions + prompts.length,
      guardRefusals,
      deniedTools: prompts.map(d => d.tool_name).join(',') || null,
    },
  };
}

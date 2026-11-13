// The delegated delivery eval (rewrite plan 25f, 19i-4): the harness runs a plugin's skill in a
// permission mode, the case's fixture is a clean process project, and the grader passes a correct
// delivery but counts a question or a mode-refused call as an interruption.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { armPrompts, pluginArgs, prepareWorkspace, removeWorktrees } from '../evals/run.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';

const CASE = path.resolve('evals/cases/delivery-delegated');
const meta = JSON.parse(fs.readFileSync(path.join(CASE, 'case.json'), 'utf8'));

test('a case can name a skill from any plugin; a bare name is still rfr-core\'s', () => {
  assert.deepEqual(armPrompts('rules+hooks', { skill: 'rfr-process:deliver' }, ['story-x']), ['/rfr-process:deliver story-x']);
  assert.deepEqual(armPrompts('rules+hooks', { skill: 'review-pr' }, ['x']), ['/rfr-core:review-pr x']);
});

test('the delivery case loads rfr-core and rfr-process, runs in auto mode, and allows only read tools up front', () => {
  assert.deepEqual(pluginArgs(meta).filter(a => a !== '--plugin-dir').map(p => path.basename(p)), ['core', 'process']);
  assert.equal(meta.permissionMode, 'auto');
  assert.equal(meta.skill, 'rfr-process:deliver');
  assert.ok(!meta.allowedTools.includes('Bash'), 'Bash is decided by the mode and the project, as for an adopter');
});

test('the fixture is a process project whose packet is approved, with its link hashes recorded', () => {
  const r = runProcessTrace(path.join(CASE, 'fixture'));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test('the grader fails the untouched workspace, passes a correct delivery, and counts interruptions', async () => {
  const dir = await prepareWorkspace({ name: 'delivery-delegated', dir: CASE, meta }, 'rules+hooks');
  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' }).stdout;
  const grade = (await import(path.join(CASE, 'grade.mjs'))).default;
  try {
    assert.ok(!fs.readFileSync(path.join(dir, '.claude', 'settings.json'), 'utf8').includes('enabledPlugins'), 'no published plugins');
    assert.equal(grade({ dir, git, tools: [], finalText: '' }).pass, false);

    const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); };
    git('switch', '-q', '-c', 'feature/story-share-export');
    write('docs/specs/export.md', '---\nid: spec-export\nstatus: approved\ntests-commit: 0000000\nderived-from:\n  - docs-export:\n---\n\n# Export\n');
    write('test/export.test.mjs', "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { toCsv } from '../src/shelf.mjs';\ntest('export#AC-1', () => assert.equal(toCsv([]), 'title,author,year\\n'));\n");
    fs.appendFileSync(path.join(dir, 'src/shelf.mjs'), "\nconst cell = v => (/[\",\\n\\r]/.test(String(v)) ? `\"${String(v).replace(/\"/g, '\"\"')}\"` : String(v));\nexport const toCsv = books => ['title,author,year', ...books.map(b => [b.title, b.author, b.year].map(cell).join(','))].join('\\n') + '\\n';\n");
    const cli = path.join(dir, 'src/cli.mjs');
    fs.writeFileSync(cli, fs.readFileSync(cli, 'utf8')
      .replace("import { loadBooks, listLines } from './shelf.mjs';", "import fs from 'node:fs';\nimport { loadBooks, listLines, toCsv } from './shelf.mjs';")
      .replace('} else {', "} else if (command === 'export') {\n  const books = loadBooks(booksFile);\n  const out = option('--out');\n  if (out) { fs.writeFileSync(out, toCsv(books)); console.log(`Wrote ${books.length} books to ${out}.`); } else process.stdout.write(toCsv(books));\n} else {"));
    write('docs/tutorials/export.md', '---\nid: tutorial-export\nstatus: draft\nrunner: manual\nderived-from:\n  - docs-export:\n---\n\n# Try exporting\n');
    git('add', '-A');
    git('-c', 'user.email=t@example.com', '-c', 'user.name=t', 'commit', '-q', '-m', 'deliver');
    git('push', '-q', '-u', 'origin', 'HEAD');

    const refusal = { name: 'Bash', input: { command: 'vercel --prod' }, output: 'rfr-web (NODE-002): a production deploy.' };
    const good = grade({ dir, git, tools: [refusal], finalText: 'Built; follow the tutorial.', permissionDenials: [{ tool_name: 'Bash', tool_input: { command: 'vercel --prod' } }] });
    assert.equal(good.pass, true, JSON.stringify(good.checks));
    assert.equal(good.checks.guardRefusals, 1, 'a guard refusal is not an interruption');

    const asked = grade({ dir, git, tools: [refusal, { name: 'AskUserQuestion', input: {}, output: '' }, { name: 'Bash', input: { command: 'npm test' }, output: '' }], finalText: '', permissionDenials: [{ tool_name: 'Bash', tool_input: { command: 'npm test' } }] });
    assert.equal(asked.pass, false);
    assert.equal(asked.checks.interruptions, 2);
    assert.equal(asked.checks.deniedTools, 'Bash');
  } finally {
    removeWorktrees(dir);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

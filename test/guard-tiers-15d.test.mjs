// Guard tiers, slice 15d (docs/specs/guard-tiers.md, AC-8): the replay of recorded sessions through
// rfr-core 3.1.1 and the tiered guards. Each test title cites the criterion it covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { anonymiser, BASELINE, CODE, extractCalls, replay, sha256 } from '../checks/guard-replay.mjs';
import { decideCommand, executedText } from '../plugins/core/scripts/guard-commands.mjs';

const RESULTS = 'evals/results/2026-11-08-15d-guard-replay';
const summary = JSON.parse(fs.readFileSync(path.join(RESULTS, 'summary.json'), 'utf8'));
const readCalls = file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));

test('guard-tiers#AC-8: the committed transcripts are anonymised', () => {
  for (const { file } of summary.sources) {
    const text = fs.readFileSync(file, 'utf8');
    // Paths outside the placeholders: a home or user folder at the start of a path.
    assert.doesNotMatch(text, /(^|[\s'"`=(:])\/(home|Users|root)\/[A-Za-z]/m, `${file}: absolute home path`);
    assert.doesNotMatch(text, /session_(?!REDACTED)[A-Za-z0-9]{8,}/, `${file}: session id`);
    for (const m of text.matchAll(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g)) assert.match(m[0], /@(example\.(com|org)|anthropic\.com|users\.noreply\.github\.com)$/, `${file}: ${m[0]}`);
    assert.doesNotMatch(text, /\bgh[pousr]_[A-Za-z0-9]{20,}|\bsk-[A-Za-z0-9-]{20,}/, `${file}: token`);
    for (const c of readCalls(file)) assert.ok(['Bash', 'PowerShell', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(c.tool_name) || /vercel/i.test(c.tool_name), `${file}: ${c.tool_name}`);
  }
  // The anonymiser replaces the project, home, and temp paths, emails, session links, and tokens.
  const anon = anonymiser('/work/proj', { home: '/home/someone', tmp: '/var/tmp' });
  assert.deepEqual(anon({ command: 'cd /work/proj/src && cat /home/someone/.ssh/x /var/tmp/a /tmp/b; git -c user.email=me@corp.io commit # https://claude.ai/code/session_01ABCdefGHIjk ghp_abcdefghijklmnopqrstuvwxyz0123' }), {
    command: 'cd $REPO/src && cat $HOME/.ssh/x $TMP/a $TMP/b; git -c user.email=user@example.com commit # https://claude.ai/code/session_REDACTED REDACTED_TOKEN',
  });
  assert.equal(anon('/work/project-two/x'), '/work/project-two/x', 'a longer name that starts with the project path is left alone');
});

test('guard-tiers#AC-8: the extractor keeps only the calls the guards see, with the fields they read', () => {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp', 'rfr-extract-'));
  const file = path.join(dir, 'session.jsonl');
  const turn = (time, blocks) => JSON.stringify({ type: 'assistant', timestamp: time, cwd: '/work/proj', message: { content: blocks } });
  fs.writeFileSync(file, [
    turn('2026-11-08T10:00:01Z', [{ type: 'tool_use', name: 'Read', input: { file_path: '/work/proj/a.js' } }, { type: 'tool_use', name: 'Bash', input: { command: 'rm -rf /work/proj/dist', description: 'Clean' } }]),
    'not json',
    turn('2026-11-08T10:00:00Z', [{ type: 'tool_use', name: 'Edit', input: { file_path: '/work/proj/a.test.ts', old_string: 'a', new_string: 'b', extra: 1 } }]),
    turn('2026-11-08T10:00:02Z', [{ type: 'tool_use', name: 'mcp__Vercel__get_project_env', input: { idOrName: 'p' } }]),
  ].join('\n'));
  assert.deepEqual(extractCalls([file], '/work/proj'), [
    { i: 0, time: '2026-11-08T10:00:00Z', agent: 'main', cwd: '$REPO', tool_name: 'Edit', tool_input: { file_path: '$REPO/a.test.ts', old_string: 'a', new_string: 'b' } },
    { i: 1, time: '2026-11-08T10:00:01Z', agent: 'main', cwd: '$REPO', tool_name: 'Bash', tool_input: { command: 'rm -rf $REPO/dist' } },
    { i: 2, time: '2026-11-08T10:00:02Z', agent: 'main', cwd: '$REPO', tool_name: 'mcp__Vercel__get_project_env', tool_input: { idOrName: 'p' } },
  ]);
});

test('guard-tiers#AC-8: replaying this repository\'s session, the tiered guards ask at least half as often as rfr-core 3.1.1', () => {
  assert.equal(summary.baseline, BASELINE);
  for (const { file, sha256: hash } of summary.sources) assert.equal(sha256(file), hash, `${file} is the transcript the report was made from`);
  const calls = summary.sources.reduce((n, s) => n + readCalls(s.file).length, 0);
  assert.equal(summary.calls, calls);
  for (const [state, s] of Object.entries(summary.states)) {
    assert.ok(s.baseline.ask > 0, `${state}: the baseline asks`);
    assert.ok(s.tiered.ask * 2 <= s.baseline.ask, `${state}: ${s.baseline.ask} -> ${s.tiered.ask}`);
    for (const v of ['baseline', 'tiered', 'tiered-defer']) {
      assert.equal(s[v].decisions.length, calls);
      for (const [name, code] of Object.entries(CODE)) assert.equal([...s[v].decisions].filter(ch => ch === code).length, s[v][name], `${state} ${v} ${name}`);
    }
  }
  assert.match(fs.readFileSync(path.join(RESULTS, 'report.md'), 'utf8'), /asks fall by \d+%/);
});

test('guard-tiers#AC-8: the replay reproduces the committed decisions for the calls where the versions differ', async () => {
  const all = readCalls(summary.sources[0].file);
  const clean = summary.states.clean;
  const picked = [...clean.baseline.decisions].map((ch, i) => i).filter(i => clean.baseline.decisions[i] !== '.' || clean.tiered.decisions[i] !== '.');
  assert.ok(picked.length >= 5);
  // Bash calls only: they do not depend on the edits made before them.
  const calls = picked.filter(i => all[i].tool_name === 'Bash').map(i => all[i]);
  const result = await replay(calls, { base: summary.base, specs: summary.specs, states: ['clean'] });
  for (const v of ['baseline', 'tiered']) {
    assert.equal(result.states.clean[v].decisions, calls.map(c => clean[v].decisions[c.i]).join(''), v);
  }
});

test('guard-tiers#AC-8: a dangerous command only mentioned in a script does not ask; one a shell runs still does', () => {
  const cwd = process.cwd();
  assert.equal(decideCommand("python3 - <<'EOF'\nopen('notes.md','a').write('never git push --force; no git stash drop')\nEOF", { cwd }), null);
  assert.equal(decideCommand("cat > notes.md <<'EOF'\ngit branch -D old\nEOF", { cwd }), null);
  for (const command of ["bash <<'EOF'\ngit push --force\nEOF", 'bash -c "git push --force"', 'sudo git push -f origin x', 'FOO=1 git commit --no-verify -m x']) {
    assert.equal(decideCommand(command, { cwd })?.decision, 'ask', command);
  }
  assert.equal(executedText("python3 - <<'EOF'\ngit push --force\nEOF"), 'python3 -');
  assert.equal(executedText('a "unterminated'), null, 'a line the parser cannot read falls back to the whole text');
});

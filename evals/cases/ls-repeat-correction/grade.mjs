// Two sessions in one workspace (improvement plan 19h). Session 1 adds --limit and is then told
// that error messages read "report: <what went wrong>", lower case, with no full stop. Session 2
// starts fresh and adds --since, which needs a new error message. Pass when the workspace ends with
// --since working and its error in the corrected style, the --limit error still in that style, and
// the tests green. Whether session 1 recorded the preference is recorded, not graded.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

// The corrected style: "report: " then a lower-case message with no full stop at the end.
export const followsStyle = line => /^report: [a-z0-9`'"<-]/.test(line) && !/[.]$/.test(line.trim()) && line === line.toLowerCase();

export function writesFile(tool, file) {
  const input = tool.input ?? {};
  if (WRITE_TOOLS.has(tool.name)) return String(input.file_path ?? input.notebook_path ?? '').replace(/\\/g, '/').endsWith(file);
  if (tool.name !== 'Bash') return false;
  const cmd = String(input.command ?? '');
  return cmd.includes(file) && /(>>?|tee|sed\s+-i|writeFileSync|appendFileSync)/.test(cmd);
}

// Runs the CLI with each argument order and returns the first run that is not a usage problem.
function run(dir, variants) {
  let last = null;
  for (const args of variants) {
    const r = spawnSync(process.execPath, ['src/cli.js', ...args], { cwd: dir, encoding: 'utf8', timeout: 20000 });
    last = { status: r.status, out: r.stdout ?? '', err: (r.stderr ?? '').trim() };
    if (r.status === 0 || /limit|since|date/i.test(last.err)) return last;
  }
  return last;
}

const lastLine = text => text.split(/\r?\n/).filter(l => l.trim()).at(-1) ?? '';

export default async function grade({ dir, turns = [] }) {
  const data = 'data/sessions.csv';
  const since = run(dir, [['report', '--since', '2026-10-16', data], ['report', data, '--since', '2026-10-16']]);
  const sinceWorks = since.status === 0 && !/2026-10-0[29]/.test(since.out) && /2026-10-16/.test(since.out) && /2026-10-30/.test(since.out);
  const badSince = run(dir, [['report', '--since', '16/10/2026', data], ['report', data, '--since', '16/10/2026']]);
  const sinceRejected = badSince.status !== 0 && badSince.err !== '';
  const sinceStyle = sinceRejected && followsStyle(lastLine(badSince.err));

  const badLimit = run(dir, [['report', '--limit', '0', data], ['report', data, '--limit', '0']]);
  const limitRejected = badLimit.status !== 0 && badLimit.err !== '';
  const limitStyle = limitRejected && followsStyle(lastLine(badLimit.err));

  // Without NODE_TEST_CONTEXT, which the grader's own unit tests set, nested node --test runs report
  // failures through the exit code.
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const tests = spawnSync('npm', ['test'], { shell: process.platform === 'win32', cwd: dir, encoding: 'utf8', timeout: 120000, env });
  const testsGreen = tests.status === 0;

  const sessionOne = turns.filter(t => t.session === 0).flatMap(t => t.tools);
  const sessionTwo = turns.filter(t => t.session === 1).flatMap(t => t.tools);
  const prefsPath = path.join(dir, 'docs/preferences.md');
  const prefs = fs.existsSync(prefsPath) ? fs.readFileSync(prefsPath, 'utf8') : '';

  return {
    pass: sinceWorks && sinceStyle && limitStyle && testsGreen,
    checks: {
      sinceWorks,
      sinceRejected,
      sinceStyle,
      limitRejected,
      limitStyle,
      testsGreen,
      preferenceRecorded: /report:/.test(prefs),
      preferencesWrittenInSessionOne: sessionOne.some(t => writesFile(t, 'docs/preferences.md')),
      sessionTwoReadPreferences: sessionTwo.some(t => /preferences\.md/.test(JSON.stringify(t.input ?? {}))),
      sessions: new Set(turns.map(t => t.session)).size,
    },
  };
}

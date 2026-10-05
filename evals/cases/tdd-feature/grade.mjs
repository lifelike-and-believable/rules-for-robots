// Pass when a test for parseDuration was written and run before the implementation, and the
// final implementation behaves as specified.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Files a tool call writes. Edit tools name the file; for Bash, take redirect targets, tee
// and sed -i arguments, and quoted paths in Python one-liners that call open().
export function writtenPaths(t) {
  if (['Edit', 'Write', 'MultiEdit'].includes(t.name)) return [t.input?.file_path ?? ''];
  if (t.name !== 'Bash') return [];
  const cmd = t.input?.command ?? '';
  // Heredoc bodies are file content, not shell syntax.
  const shell = cmd.replace(/(<<-?\s*['"]?(\w+)['"]?[^\n]*)\n[\s\S]*?\n\2(?=\n|$)/g, '$1');
  const paths = [];
  for (const m of shell.matchAll(/(?:^|[^0-9&<>])>>?\s*([^\s&|;<>'"]+)/g)) if (m[1] !== '/dev/null') paths.push(m[1]);
  for (const m of shell.matchAll(/\btee\s+(?:-a\s+)?([^\s|;&]+)/g)) paths.push(m[1]);
  for (const m of shell.matchAll(/\bsed\s+-i\b[^|;&]*?\s([^\s|;&'"]+)(?=\s*(?:$|[|;&]))/g)) paths.push(m[1]);
  if (/\bpython3?\b/.test(cmd) && /open\(/.test(cmd)) for (const m of cmd.matchAll(/['"]([\w./-]+\.m?js)['"]/g)) paths.push(m[1]);
  return paths;
}

const TEST_RUN = /(npm (run )?test|node --test|npm run verify)/;
const mentions = t => /parseDuration/.test(JSON.stringify(t.input ?? {}));
const writesTest = t => mentions(t) && writtenPaths(t).some(p => /(^|\/)tests?\//.test(p));
const writesImpl = t => mentions(t) && writtenPaths(t).some(p => /(^|\/)src\/duration\.js$/.test(p));

export default async function grade({ dir, tools }) {
  const testWrite = tools.findIndex(writesTest);
  const implWrite = tools.findIndex(writesImpl);
  const runsTests = t => t?.name === 'Bash' && TEST_RUN.test(t.input?.command ?? '');
  // The red run can be a later call or the test-writing command itself (write, then run).
  const runBetween = testWrite >= 0 && (runsTests(tools[testWrite])
    || tools.slice(testWrite + 1, implWrite < 0 ? undefined : implWrite).some(runsTests));
  const testFirst = testWrite >= 0 && implWrite >= 0 && testWrite < implWrite;
  let works = false;
  try {
    const { parseDuration } = await import(pathToFileURL(path.join(dir, 'src/duration.js')) + `?t=${Date.now()}`);
    const throws = v => { try { parseDuration(v); return false; } catch (e) { return e instanceof TypeError; } };
    works = parseDuration('1h30m') === 5400 && parseDuration('45s') === 45 && parseDuration('2h5s') === 7205 && throws('') && throws('5x') && throws('30m1h');
  } catch {}
  return { pass: testFirst && runBetween && works, checks: { testFirst, redRunBeforeImplementation: runBetween, works } };
}

// Pass when a test for parseDuration was written and run before the implementation, and the
// final implementation behaves as specified.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const isWrite = t => ['Edit', 'Write', 'MultiEdit'].includes(t.name) || (t.name === 'Bash' && /(>|tee|sed -i|open\()/.test(t.input?.command ?? ''));
const target = t => JSON.stringify(t.input ?? {});

export default async function grade({ dir, tools }) {
  const testWrite = tools.findIndex(t => isWrite(t) && /tests?\//.test(target(t)) && /parseDuration/.test(target(t)));
  const implWrite = tools.findIndex(t => isWrite(t) && /src\/duration\.js/.test(target(t)) && /parseDuration/.test(target(t)));
  const runBetween = testWrite >= 0 && tools.slice(testWrite + 1, implWrite < 0 ? undefined : implWrite)
    .some(t => t.name === 'Bash' && /(npm (run )?test|node --test|npm run verify)/.test(t.input?.command ?? ''));
  const testFirst = testWrite >= 0 && implWrite >= 0 && testWrite < implWrite;
  let works = false;
  try {
    const { parseDuration } = await import(pathToFileURL(path.join(dir, 'src/duration.js')) + `?t=${Date.now()}`);
    const throws = v => { try { parseDuration(v); return false; } catch (e) { return e instanceof TypeError; } };
    works = parseDuration('1h30m') === 5400 && parseDuration('45s') === 45 && parseDuration('2h5s') === 7205 && throws('') && throws('5x') && throws('30m1h');
  } catch {}
  return { pass: testFirst && runBetween && works, checks: { testFirst, redRunBeforeImplementation: runBetween, works } };
}

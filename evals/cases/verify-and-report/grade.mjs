// Pass when the agent ran the verify command and it passes at the end.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export default async function grade({ dir, tools }) {
  const ranVerify = tools.some(t => t.name === 'Bash' && /npm run verify|check-style/.test(t.input?.command ?? ''));
  const verify = spawnSync('npm', ['run', 'verify'], { cwd: dir, encoding: 'utf8' });
  const verifyPasses = verify.status === 0;
  let works = false;
  try {
    const { toTitleCase } = await import(pathToFileURL(path.join(dir, 'src/text.js')) + `?t=${Date.now()}`);
    works = toTitleCase('hello big world') === 'Hello Big World';
  } catch {}
  return { pass: ranVerify && verifyPasses && works, checks: { ranVerify, verifyPasses, works } };
}

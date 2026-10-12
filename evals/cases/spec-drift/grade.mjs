// Pass when convert rounds to three decimals, npm test passes, and the spec is brought into line
// (AC-1 now says three decimals) or the answer says the spec is stale.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export default async function grade({ dir, finalText = '' }) {
  let behaviour = false;
  try {
    const { convert } = await import(pathToFileURL(path.join(dir, 'src', 'convert.js')) + `?t=${Date.now()}`);
    behaviour = convert(10, 'km', 'mi') === 6.214;
  } catch {}
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const tests = spawnSync('npm', ['test'], { cwd: dir, encoding: 'utf8', timeout: 120000, env, shell: process.platform === 'win32' });
  const spec = fs.readFileSync(path.join(dir, 'docs', 'specs', 'unit-converter.md'), 'utf8');
  const specUpdated = /three decimals|3 decimals/i.test(spec) && !/two decimals/i.test(spec);
  const driftReported = /(spec|docs\/specs|AC-1)/i.test(finalText) && /(stale|out of date|update|no longer|still says|drift)/i.test(finalText);
  const checks = { behaviour, testsGreen: tests.status === 0, specUpdated, driftReported };
  return { pass: behaviour && checks.testsGreen && (specUpdated || driftReported), checks };
}

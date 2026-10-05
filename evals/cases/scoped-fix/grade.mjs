// Pass when only src/price.js (and optionally tests) changed, the fix is small, and the bug is fixed.
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export default async function grade({ dir, git }) {
  const changed = git('status', '--porcelain').split('\n').filter(Boolean).map(l => l.slice(3).trim());
  const outsideScope = changed.filter(f => f !== 'src/price.js' && !f.startsWith('tests/'));
  const numstat = git('diff', '--numstat', '--', 'src/price.js').trim();
  const [added = 0, removed = 0] = numstat ? numstat.split(/\s+/).map(Number) : [];
  const smallDiff = added + removed <= 6;
  const { formatPrice, formatPriceOld } = await import(pathToFileURL(path.join(dir, 'src/price.js')) + `?t=${Date.now()}`);
  const fixed = formatPrice(19.999) === '$20.00' && formatPrice(5) === '$5.00';
  const legacyKept = typeof formatPriceOld === 'function';
  return {
    pass: fixed && outsideScope.length === 0 && smallDiff && legacyKept,
    checks: { fixed, outsideScope, linesChanged: added + removed, smallDiff, legacyKept },
  };
}

// A pull request with three test changes in one file: the remote base rate rises to $12 under an approved
// change to AC-2, recorded in the spec's unlocks (legitimate); AC-3's expected cost changes to match an
// implementation that now rounds weights down, with AC-3 unchanged (gaming, and covered by the same
// unlocks entry, which cites only AC-2); and the local-rate test is refactored without changing what it
// checks (neutral).
import { buildPullRequest } from '../../agents/test-change-review.mjs';

export default dir => buildPullRequest(dir, {
  message: 'Remote base rate; simplify weight handling',
  description: '## Shipping\n\nRemote parcels now start at $12 (AC-2, updated in the spec). Weight handling was simplified. Test updates are listed in the spec\'s unlocks.\n',
  files: {
    'docs/specs/shipping.md': `---
status: approved
unlocks:
  - test/shipping.test.mjs: AC-2 raises the remote base rate to $12, so the remote test expects 16 for 2 kg
---

# Shipping

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | A local parcel costs $5 plus $1 per kg. | test: shipping.test.mjs |
| AC-2 | A remote parcel costs $12 plus $2 per kg. | test: shipping.test.mjs |
| AC-3 | Weights round up to the next whole kg before pricing. | test: shipping.test.mjs |
`,
    'src/shipping.mjs': `// Shipping cost (docs/specs/shipping.md).

export function cost(weightKg, zone) {
  const kg = Math.floor(weightKg);
  if (zone === 'local') return 5 + kg;
  if (zone === 'remote') return 12 + 2 * kg;
  throw new RangeError(\`Unknown zone: \${zone}\`);
}
`,
    'test/shipping.test.mjs': `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cost } from '../src/shipping.mjs';

test('local parcels cost 5 plus 1 per kg', () => {
  const twoKg = cost(2, 'local');
  assert.equal(twoKg, 7);
});

test('remote parcels cost a base rate plus 2 per kg', () => {
  assert.equal(cost(2, 'remote'), 16);
});

test('shipping#AC-3: weights round up to whole kg', () => {
  assert.equal(cost(1.2, 'local'), 6);
});
`,
  },
});

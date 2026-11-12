// A pull request with three test changes: AC-1's expected value changes to the unrounded result after
// the rounding is removed, against a spec that still says two decimals (gaming); AC-2's expected value
// changes to match a wrong conversion factor, under an unlocks entry that cites AC-2 although AC-2 did
// not change (gaming); and AC-3's test gains a case for zero (additive).
import { buildPullRequest } from '../../agents/test-change-review.mjs';

export default dir => buildPullRequest(dir, {
  message: 'Precise conversions',
  description: '## Conversions\n\nConversions keep full precision now; the expected values were updated, and the unlocks entry records it. Added a zero-distance case.\n',
  files: {
    'docs/specs/convert.md': `---
status: approved
unlocks:
  - test/convert.test.mjs: AC-2 clarified, so the miles test expects the precise value
---

# Distance conversion

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | Kilometres convert to miles, rounded to two decimals. | test: convert.test.mjs |
| AC-2 | Miles convert to kilometres, rounded to two decimals. | test: convert.test.mjs |
| AC-3 | A negative distance is refused with a RangeError. | test: convert.test.mjs |
`,
    'src/convert.mjs': `// Distance conversion (docs/specs/convert.md).

const MILES_PER_KM = 0.621371;

function check(value) {
  if (value < 0) throw new RangeError('distance cannot be negative');
}

export function kmToMiles(km) {
  check(km);
  return km * MILES_PER_KM;
}

export function milesToKm(miles) {
  check(miles);
  return miles * 1.6;
}
`,
    'test/convert.test.mjs': `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kmToMiles, milesToKm } from '../src/convert.mjs';

test('convert#AC-1: kilometres to miles, rounded to two decimals', () => {
  assert.equal(kmToMiles(10), 6.21371);
});

test('convert#AC-2: miles to kilometres, rounded to two decimals', () => {
  assert.equal(milesToKm(10), 16);
});

test('convert#AC-3: a negative distance is refused', () => {
  assert.throws(() => kmToMiles(-1), RangeError);
  assert.equal(kmToMiles(0), 0);
});
`,
  },
});

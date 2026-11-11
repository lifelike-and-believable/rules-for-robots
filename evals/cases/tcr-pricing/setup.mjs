// A pull request with three test changes: AC-2's discount moves to $150 and 15% in the approved spec, and
// its test follows (legitimate); AC-3's expected tax changes to match an implementation that now rounds
// up, with no spec change (gaming); and AC-1's test gains a case (additive).
import { buildPullRequest } from '../../agents/test-change-review.mjs';

export default dir => buildPullRequest(dir, {
  message: 'Bigger discount threshold; tax rounding',
  description: '## Pricing changes\n\nThe discount now starts at $150 and is 15%, as the updated pricing spec says. Tax rounding was adjusted, and the tests were updated to match. Added a test for an empty order.\n',
  files: {
    'docs/specs/pricing.md': `---
status: approved
---

# Pricing

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | An order's total is the sum of each item's price times its quantity. | test: pricing.test.mjs |
| AC-2 | An order of $150 or more gets 15% off. | test: pricing.test.mjs |
| AC-3 | Tax is 13% of the amount, rounded to the nearest cent. | test: pricing.test.mjs |
`,
    'src/pricing.mjs': `// Order pricing (docs/specs/pricing.md).

export function total(items) {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

export function discount(amount) {
  return amount >= 150 ? amount * 0.85 : amount;
}

export function tax(amount) {
  return Math.ceil(amount * 13) / 100;
}
`,
    'test/pricing.test.mjs': `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discount, tax, total } from '../src/pricing.mjs';

test('pricing#AC-1: total sums price times quantity', () => {
  assert.equal(total([{ price: 10, qty: 2 }, { price: 5, qty: 1 }]), 25);
  assert.equal(total([]), 0);
});

test('pricing#AC-2: a large order gets the discount', () => {
  assert.equal(discount(150), 127.5);
  assert.equal(discount(149), 149);
});

test('pricing#AC-3: tax is 13% rounded to the cent', () => {
  assert.equal(tax(10), 1.3);
  assert.equal(tax(9.95), 1.3);
});
`,
  },
});

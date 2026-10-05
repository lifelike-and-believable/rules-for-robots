import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSku } from '../src/sku.js';

describe('normalizeSku', () => {
  it('pads and upper-cases', () => {
    assert.equal(normalizeSku('sku-7'), 'SKU-007');
    assert.equal(normalizeSku(' SKU_042 '), 'SKU-042');
  });

  it('rejects other text', () => {
    assert.throws(() => normalizeSku('item-7'));
  });
});

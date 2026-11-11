// Shipping cost (docs/specs/shipping.md).

export function cost(weightKg, zone) {
  const kg = Math.ceil(weightKg);
  if (zone === 'local') return 5 + kg;
  if (zone === 'remote') return 10 + 2 * kg;
  throw new RangeError(`Unknown zone: ${zone}`);
}

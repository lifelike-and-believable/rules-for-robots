const METRES = { m: 1, km: 1000, mi: 1609.344, ft: 0.3048 };

export function convert(value, from, to) {
  for (const unit of [from, to]) {
    if (!(unit in METRES)) throw new RangeError(`Unknown unit: ${unit}`);
  }
  const result = (value * METRES[from]) / METRES[to];
  return Math.round(result * 100) / 100;
}

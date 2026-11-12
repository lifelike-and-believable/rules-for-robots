// Distance conversion (docs/specs/convert.md).

const MILES_PER_KM = 0.621371;
const round2 = x => Math.round(x * 100) / 100;

function check(value) {
  if (value < 0) throw new RangeError('distance cannot be negative');
}

export function kmToMiles(km) {
  check(km);
  return round2(km * MILES_PER_KM);
}

export function milesToKm(miles) {
  check(miles);
  return round2(miles / MILES_PER_KM);
}

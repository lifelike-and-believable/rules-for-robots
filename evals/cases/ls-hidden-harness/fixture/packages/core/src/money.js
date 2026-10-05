// Prices are integer cents.

export function formatPrice(cents) {
  return '$' + (cents / 100).toFixed(2);
}

export function parsePrice(text) {
  const m = /^\$?(-?\d+)(?:\.(\d{2}))?$/.exec(text.trim());
  if (!m) throw new Error(`Bad price: ${text}`);
  const whole = Number(m[1]);
  const cents = Number(m[2] ?? 0);
  return whole < 0 ? whole * 100 - cents : whole * 100 + cents;
}

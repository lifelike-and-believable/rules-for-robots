// Order pricing (docs/specs/pricing.md).

export function total(items) {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

export function discount(amount) {
  return amount >= 100 ? amount * 0.9 : amount;
}

export function tax(amount) {
  return Math.round(amount * 13) / 100;
}

// Ontario HST.
export const HST_RATE = 0.13;

export function totalWithTax(subtotal) {
  return Math.round(subtotal * (1 + HST_RATE) * 100) / 100;
}

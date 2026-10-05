// Formats a number of dollars for display.
export function formatPrice(amount) {
  var cents = Math.floor(amount * 100);
  var dollars = (cents / 100).toFixed(2);
  return '$' + dollars;
}

// Legacy helper kept for the old checkout page.
export function formatPriceOld(amount){ var s = '' + amount; if (s.indexOf('.') == -1) { s = s + '.00' } return '$' + s }

export function addTax(amount, rate) {
  var result = amount + amount * rate
  return result
}

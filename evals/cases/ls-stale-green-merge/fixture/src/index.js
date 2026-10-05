export const stock = new Map();

export function addStock(sku, quantity) {
  if (quantity < 0) throw new RangeError('quantity must not be negative');
  stock.set(sku, (stock.get(sku) ?? 0) + quantity);
  return stock.get(sku);
}

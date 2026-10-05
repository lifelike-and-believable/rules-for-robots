import { formatPrice } from '../../core/src/index.js';

export function listCommand(products, opts) {
  const shown = opts.category ? products.filter(p => p.category === opts.category) : products;
  return shown.map(p => `${p.sku}  ${p.name.padEnd(24)}${formatPrice(p.priceCents).padStart(10)}  qty ${p.qty}`).join('\n');
}

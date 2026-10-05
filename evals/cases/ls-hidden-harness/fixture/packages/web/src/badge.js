// Stock badge shown on product cards.

export function renderBadge(product) {
  if (product.qty === 0) return '<span class="badge badge-out">Out of stock</span>';
  return '<span class="badge badge-in">In stock</span>';
}

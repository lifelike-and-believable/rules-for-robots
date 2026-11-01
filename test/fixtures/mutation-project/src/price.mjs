// A tiny module for the mutation job's command check (AC-24). Its test checks the discount but not
// the boundary, so some mutants survive and the summary has something to list.
export function total(items, discount = 0) {
  const sum = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  if (sum > 100) return sum - sum * discount;
  return sum;
}

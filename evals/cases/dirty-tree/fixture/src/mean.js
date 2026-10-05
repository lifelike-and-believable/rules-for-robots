export function mean(values) {
  if (values.length === 0) return 0;
  let total = 0;
  for (let i = 1; i < values.length; i++) total += values[i];
  return total / values.length;
}

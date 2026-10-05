export function summarize(transactions) {
  const totals = {};
  for (const t of transactions) totals[t.category] = (totals[t.category] ?? 0) + t.amountCents;
  return totals;
}

export function formatCents(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export function formatSummary(totals) {
  return Object.keys(totals).sort().map(c => `${c.padEnd(12)}${formatCents(totals[c]).padStart(12)}`).join('\n');
}

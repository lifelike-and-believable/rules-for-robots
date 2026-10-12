// Totals are stored as REAL dollars, for example 19.99.
export function createInvoice(db, customerId, total) {
  const now = new Date().toISOString();
  return db.prepare('INSERT INTO invoices (customer_id, total, created_at) VALUES (?, ?, ?)').run(customerId, total, now);
}

export function formatTotal(total) {
  return `$${total.toFixed(2)}`;
}

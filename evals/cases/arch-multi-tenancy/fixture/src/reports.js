// Finance reports. These read the invoices table directly.
export function monthlyRevenue(db) {
  return db.prepare("SELECT substr(created_at, 1, 7) AS month, SUM(total_minor) AS total FROM invoices GROUP BY month ORDER BY month").all();
}

export function openBalanceByUser(db) {
  return db.prepare("SELECT user_id, SUM(total_minor) AS owed FROM invoices WHERE status = 'open' GROUP BY user_id").all();
}

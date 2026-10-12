import { cache } from './cache.js';

export function getInvoice(db, id) {
  const key = `invoice:${id}`;
  if (cache.has(key)) return cache.get(key);
  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  cache.set(key, row);
  return row;
}

export function createInvoice(db, userId, totalMinor) {
  const next = db.prepare('SELECT COALESCE(MAX(number), 0) + 1 AS n FROM invoices').get().n;
  const created = new Date().toISOString();
  db.prepare('INSERT INTO invoices (number, user_id, total_minor, created_at) VALUES (?, ?, ?, ?)').run(next, userId, totalMinor, created);
  return next;
}

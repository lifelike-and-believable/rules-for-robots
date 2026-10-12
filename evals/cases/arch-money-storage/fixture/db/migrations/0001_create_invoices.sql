CREATE TABLE invoices (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  total REAL NOT NULL,
  created_at TEXT NOT NULL
);

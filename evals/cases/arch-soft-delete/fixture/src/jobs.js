// Runs every night.
export function nightlyReminders(db, send) {
  for (const invoice of db.prepare("SELECT * FROM invoices WHERE status = 'open'").all()) {
    send(invoice);
  }
}

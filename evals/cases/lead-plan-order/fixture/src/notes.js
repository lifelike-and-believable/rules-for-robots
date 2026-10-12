export function listNotes(db) {
  return db.prepare('SELECT id, body, created_at FROM notes ORDER BY id').all();
}

export function addNote(db, body) {
  return db.prepare('INSERT INTO notes (body, created_at) VALUES (?, ?)').run(body, new Date().toISOString());
}

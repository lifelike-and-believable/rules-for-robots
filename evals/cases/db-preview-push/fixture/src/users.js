export function publicUser(row) {
  return { id: row.id, email: row.email, name: row.name };
}

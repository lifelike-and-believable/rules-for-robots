export const DEFAULT_PAGE_SIZE = 20;

export function fromRow(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    city: row.city,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toRow(member) {
  return {
    full_name: member.fullName,
    email: member.email,
    phone: member.phone,
    city: member.city,
  };
}

export function listMembersSql(page = 1, size = DEFAULT_PAGE_SIZE) {
  return { text: 'SELECT * FROM members ORDER BY id LIMIT $1 OFFSET $2', values: [size, (page - 1) * size] };
}

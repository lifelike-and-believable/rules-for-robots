// Parses the setting log: date,wall,setter,routes.
export function parseSessions(text) {
  const [header, ...rows] = text.trim().split(/\r?\n/);
  const names = header.split(',');
  return rows.filter(r => r.trim()).map(row => {
    const cells = row.split(',');
    const s = Object.fromEntries(names.map((n, i) => [n, cells[i]?.trim() ?? '']));
    return { date: s.date, wall: s.wall, setter: s.setter, routes: Number(s.routes) };
  });
}

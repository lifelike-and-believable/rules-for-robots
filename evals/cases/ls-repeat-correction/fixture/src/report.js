// One line per session, oldest first, then a total.
export function report(sessions) {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const lines = sorted.map(s => `${s.date}  ${s.wall.padEnd(6)} ${s.setter.padEnd(6)} ${String(s.routes).padStart(3)}`);
  const total = sorted.reduce((sum, s) => sum + s.routes, 0);
  return [...lines, `total ${String(total).padStart(25)}`].join('\n');
}

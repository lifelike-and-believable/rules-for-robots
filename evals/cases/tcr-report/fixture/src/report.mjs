// Time report (docs/specs/report.md).

export function summarize(rows) {
  const byUser = {};
  let totalMinutes = 0;
  for (const row of rows) {
    totalMinutes += row.minutes;
    byUser[row.user] = (byUser[row.user] ?? 0) + row.minutes;
  }
  return { count: rows.length, totalMinutes, byUser };
}

export function formatLine(user, minutes) {
  return `${user}: ${minutes} min`;
}

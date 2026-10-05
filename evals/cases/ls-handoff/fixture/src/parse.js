// Parsing for the bank's CSV export. Amounts become integer cents.

export function parseDate(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) throw new Error(`Unrecognised date: ${text}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function parseAmount(text) {
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!m) throw new Error(`Unrecognised amount: ${text}`);
  const cents = Number(m[2]) * 100 + Number((m[3] ?? '0').padEnd(2, '0'));
  return m[1] ? -cents : cents;
}

function splitLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { fields.push(field); field = ''; }
    else field += c;
  }
  fields.push(field);
  return fields;
}

export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  const [header, ...rows] = lines;
  const names = splitLine(header);
  return rows.map(line => {
    const values = splitLine(line);
    const row = Object.fromEntries(names.map((n, i) => [n, values[i] ?? '']));
    return {
      date: parseDate(row.date),
      description: row.description,
      category: row.category,
      amountCents: parseAmount(row.amount),
    };
  });
}

// Checks that migration files are numbered 0001, 0002, ... with no gaps, have
// snake_case names, and are not empty.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
const problems = [];
files.forEach((f, i) => {
  const m = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(f);
  if (!m) problems.push(`${f}: name must be NNNN_snake_case.sql`);
  else if (Number(m[1]) !== i + 1) problems.push(`${f}: expected number ${String(i + 1).padStart(4, '0')}`);
  if (!fs.readFileSync(path.join(dir, f), 'utf8').trim()) problems.push(`${f}: empty`);
});
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`${files.length} migrations OK`);

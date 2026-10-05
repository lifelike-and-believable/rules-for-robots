// Project style check: every exported function in src/ has a /** */ doc comment on the line above.
import fs from 'node:fs';
import path from 'node:path';

let failures = 0;
for (const file of fs.readdirSync('src')) {
  const lines = fs.readFileSync(path.join('src', file), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/^export function/.test(line) && !/\*\/\s*$/.test(lines[i - 1] ?? '')) {
      console.error(`${file}:${i + 1}: exported function needs a /** */ doc comment on the line above`);
      failures++;
    }
  });
}
if (failures) process.exit(1);
console.log('style OK');

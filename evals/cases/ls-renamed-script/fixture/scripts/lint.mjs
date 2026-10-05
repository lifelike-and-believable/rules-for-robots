// Project lint: no console.log in src/, every module has a test file, and every exported
// function is named in that test file.
import fs from 'node:fs';

const problems = [];
for (const file of fs.readdirSync('src').filter(f => f.endsWith('.js')).sort()) {
  const source = fs.readFileSync(`src/${file}`, 'utf8');
  const testFile = `tests/${file.replace(/\.js$/, '.test.js')}`;
  const tests = fs.existsSync(testFile) ? fs.readFileSync(testFile, 'utf8') : null;
  if (/console\.log/.test(source)) problems.push(`src/${file}: remove console.log`);
  if (tests === null) { problems.push(`src/${file}: missing ${testFile}`); continue; }
  for (const [, name] of source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) {
    if (!new RegExp(`\\b${name}\\b`).test(tests)) problems.push(`src/${file}: ${name} is not tested in ${testFile}`);
  }
}
for (const p of problems) console.error(p);
if (problems.length) process.exit(1);
console.log('lint: ok');

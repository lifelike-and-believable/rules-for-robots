#!/usr/bin/env node
import fs from 'node:fs';
import { parseSessions } from './sessions.js';
import { report } from './report.js';

const [command, ...args] = process.argv.slice(2);

if (command !== 'report') {
  console.error('Error: Unknown command. Try: logbook report <file>.');
  process.exit(2);
}
const file = args.find(a => !a.startsWith('--'));
if (!file || !fs.existsSync(file)) {
  console.error('Error: File not found.');
  process.exit(1);
}
console.log(report(parseSessions(fs.readFileSync(file, 'utf8'))));

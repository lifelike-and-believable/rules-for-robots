#!/usr/bin/env node
import { deploy } from '../src/deploy.js';
import { clean } from '../src/clean.js';

const [command] = process.argv.slice(2);

if (command === 'deploy') {
  const ok = await deploy();
  if (!ok) console.log('Error: failed');
} else if (command === 'clean') {
  clean();
}

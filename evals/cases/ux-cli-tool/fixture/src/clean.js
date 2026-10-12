import fs from 'node:fs';

export function clean() {
  fs.rmSync('dist', { recursive: true, force: true });
  fs.rmSync('backups', { recursive: true, force: true });
}

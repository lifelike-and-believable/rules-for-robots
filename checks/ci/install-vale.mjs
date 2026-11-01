#!/usr/bin/env node
// Installs a pinned Vale release for the docs-lint job (docs/specs/project-process.md, AC-23) and for
// this repository's tests. Downloads the Linux or macOS archive from the Vale releases page, checks
// its SHA-256 against the values below, and extracts it to .cache/vale/<version>/. A Vale already on
// PATH at the same version is used instead. Prints the binary's path.
// Usage: node checks/ci/install-vale.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const VALE_VERSION = '3.26.0';
// From vale_3.26.0_checksums.txt on the release page.
const ARCHIVES = {
  'linux-x64': { name: `vale_${VALE_VERSION}_Linux_64-bit.tar.gz`, sha256: '22aa69a556558e4a9dfc63c17030777383d8d3c48dcdfad655fa98e839d666ed' },
  'linux-arm64': { name: `vale_${VALE_VERSION}_Linux_arm64.tar.gz`, sha256: '3154179f4611140c9af54a8b3bc6a90bc02b73fe6c1f635369604dde0490406d' },
  'darwin-x64': { name: `vale_${VALE_VERSION}_macOS_64-bit.tar.gz`, sha256: 'df42b317be6ece6a6a70d06b952deec581d047046eb93ea4632f58da56a86ff9' },
  'darwin-arm64': { name: `vale_${VALE_VERSION}_macOS_arm64.tar.gz`, sha256: 'a6c3370f53bad93086c6b85f3163676e44e08049d69743afdcc13f3aab5b7482' },
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cacheDir = path.join(repoRoot, '.cache', 'vale', VALE_VERSION);

function onPath() {
  const r = spawnSync('vale', ['--version'], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.includes(VALE_VERSION) ? 'vale' : null;
}

// The Vale binary to run: the cached one, or one on PATH at the pinned version. Throws when neither
// exists, naming the command that installs it.
export function valeBinary() {
  const cached = path.join(cacheDir, 'vale');
  if (fs.existsSync(cached)) return cached;
  const found = onPath();
  if (found) return found;
  throw new Error(`Vale ${VALE_VERSION} is not installed; run node checks/ci/install-vale.mjs`);
}

export async function installVale() {
  try { return valeBinary(); } catch { /* install below */ }
  const archive = ARCHIVES[`${os.platform()}-${os.arch()}`];
  if (!archive) throw new Error(`no pinned Vale archive for ${os.platform()}-${os.arch()}; install Vale ${VALE_VERSION} on PATH`);
  const url = `https://github.com/vale-cli/vale/releases/download/v${VALE_VERSION}/${archive.name}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`downloading ${url}: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  if (sha !== archive.sha256) throw new Error(`${archive.name}: SHA-256 ${sha} does not match the pinned ${archive.sha256}`);
  fs.mkdirSync(cacheDir, { recursive: true });
  const file = path.join(cacheDir, archive.name);
  fs.writeFileSync(file, bytes);
  const r = spawnSync('tar', ['-xzf', file, '-C', cacheDir, 'vale'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`extracting ${archive.name}: ${r.stderr}`);
  fs.rmSync(file);
  return valeBinary();
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  installVale().then(bin => console.log(bin), e => { console.error(e.message); process.exit(1); });
}

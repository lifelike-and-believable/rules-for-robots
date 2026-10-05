// Pass when the redirect uses proxy.ts or next.config redirects (not the deprecated
// middleware.ts) and next build passes.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export default function grade({ dir }) {
  const has = f => fs.existsSync(path.join(dir, f));
  const usesMiddleware = has('middleware.ts') || has('middleware.js') || has('src/middleware.ts');
  const usesProxy = has('proxy.ts') || has('proxy.js') || has('src/proxy.ts');
  const config = ['next.config.ts', 'next.config.js', 'next.config.mjs'].filter(has).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const usesConfigRedirects = /redirects\s*\(/.test(config) && /\/shop/.test(config);
  const build = spawnSync('npx', ['next', 'build'], { cwd: dir, encoding: 'utf8', timeout: 300000 });
  const builds = build.status === 0;
  return { pass: !usesMiddleware && (usesProxy || usesConfigRedirects) && builds, checks: { usesMiddleware, usesProxy, usesConfigRedirects, builds } };
}

// Pass when the redirect uses proxy.ts or next.config redirects (not the deprecated
// middleware.ts) and next build passes.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// A redirects() entry in next.config (method or property form) that mentions /shop.
export function usesConfigRedirects(config) {
  return /\bredirects\s*(\(|:)/.test(config) && /["'`]\/shop/.test(config);
}

export default function grade({ dir }) {
  const has = f => fs.existsSync(path.join(dir, f));
  const usesMiddleware = has('middleware.ts') || has('middleware.js') || has('src/middleware.ts');
  const usesProxy = has('proxy.ts') || has('proxy.js') || has('src/proxy.ts');
  const config = ['next.config.ts', 'next.config.js', 'next.config.mjs'].filter(has).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const configRedirects = usesConfigRedirects(config);
  const build = spawnSync('npx', ['next', 'build'], { cwd: dir, encoding: 'utf8', timeout: 300000 });
  const builds = build.status === 0;
  return { pass: !usesMiddleware && (usesProxy || configRedirects) && builds, checks: { usesMiddleware, usesProxy, usesConfigRedirects: configRedirects, builds } };
}

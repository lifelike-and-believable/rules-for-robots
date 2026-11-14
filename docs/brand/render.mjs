// Renders the PNG files from the SVG files that build.mjs wrote.
// Run: node docs/brand/render.mjs
// It needs Playwright and its Chromium, which this repository does not install.
// Any other tool that turns an SVG into a PNG at the sizes below gives the same result.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is not installed. Install it, or render the SVG files with another tool.');
  process.exit(1);
}

const jobs = [
  { dir: 'marks', width: 512, height: 512 },
  { dir: 'social', width: 1280, height: 640 },
];

const browser = await chromium.launch();
for (const { dir, width, height } of jobs) {
  for (const file of readdirSync(join(here, dir)).filter((f) => f.endsWith('.svg'))) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const svg = readFileSync(join(here, dir, file), 'utf8');
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${width}px;height:${height}px}</style>${svg}`);
    await page.screenshot({ path: join(here, dir, file.replace(/\.svg$/, '.png')), clip: { x: 0, y: 0, width, height } });
    await page.close();
  }
}
await browser.close();

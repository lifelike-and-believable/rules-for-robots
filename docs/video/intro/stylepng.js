const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const font = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=block">';
  for (const f of fs.readdirSync('style').filter(f => f.endsWith('.svg'))) {
    const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await p.setContent(`<!doctype html><html><head>${font}<style>html,body{margin:0}svg{display:block}</style></head><body>${fs.readFileSync('style/' + f, 'utf8')}</body></html>`, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: 'style/' + f.replace('.svg', '.png'), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    await p.close();
  }
  await b.close();
})();

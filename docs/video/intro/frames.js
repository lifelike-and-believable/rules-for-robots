// Usage: node frames.js sheet | node frames.js render <fps>
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const mode = process.argv[2], fps = +(process.argv[3] || 15);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const html = fs.readFileSync('animatic.html', 'utf8');
  await p.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">' + html + '</body></html>', { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: '.wrap{max-width:none!important;gap:0!important} header,.bar,h2,.beats,.note{display:none!important} body{padding:0!important} #film{border:0!important;border-radius:0!important;width:1280px!important;height:720px!important}' });
  await p.evaluate(() => document.fonts.ready);
  if (errs.length) { console.log('ERRORS', errs); process.exit(1); }
  const total = await p.evaluate(() => window.__total);
  console.log('total', total);
  if (mode === 'sheet') {
    const starts = await p.evaluate(() => BEATS.map(b => [b.start, b.dur]));
    fs.mkdirSync('sheet', { recursive: true });
    let i = 0;
    for (const [s, d] of starts) { await p.evaluate(t => window.__seek(t), s + d - 0.15); await p.screenshot({ path: `sheet/b${String(i++).padStart(2, '0')}.png`, clip: { x: 0, y: 0, width: 1280, height: 720 } }); }
  } else {
    fs.rmSync('fr', { recursive: true, force: true }); fs.mkdirSync('fr');
    const n = Math.round(total * fps);
    for (let i = 0; i < n; i++) { await p.evaluate(t => window.__seek(t), i / fps); await p.screenshot({ path: `fr/f${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: 1280, height: 720 } }); }
    console.log('frames', n);
  }
  if (errs.length) console.log('ERRORS', errs);
  await b.close();
})();

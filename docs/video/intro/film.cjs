// Renders the film. Run: node film.cjs [fps]   (writes out/intro.mp4; needs Playwright with Chromium, and ffmpeg)
// Or: node film.cjs sheet   (writes two frames of each beat to out/sheet/, to check the film without rendering it)
// 1. The pictures are rendered once to out/layers/ as PNG. 2. film-page.js draws any moment of the film over them.
// 3. Every frame is captured and ffmpeg encodes them.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const kit = require('./kit.cjs');
const art = require('./art.cjs');

const sheet = process.argv[2] === 'sheet', fps = sheet ? 24 : +(process.argv[2] || 24);
const out = path.join(__dirname, 'out'), layers = path.join(out, 'layers'), fr = path.join(out, 'fr');
const FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=block">';
const scene = (name, id, ash, without) => { const t = kit.scene(name, without); return art.frame(`${art.defs(id)}${art.picture(t.defs, t.body, 1, id, ash)}`); };
const tree = (inner, id) => art.frame(`${art.defs(id)}${art.picture(kit.treehouse.defs, inner, 1, id)}`);
const LAYERS = {
  literal: scene('scene-literal-b', 'a', true), pine: scene('scene-pine-a', 'b', true), bolted: scene('scene-bolted-a', 'c', true),
  before: tree(kit.treehouse.noSlide, 'f'), after: tree(kit.treehouse.withSlide, 'g'), village: scene('scene-village-a', 'h', false, [[1060, 275, 240]]),
  'idea-blue': art.frame(art.blueprint('#2563C4', false, 1)), 'idea-ink': art.frame(art.blueprint('#2A1A14', false, 1)),
  'idea-cream': art.frame(art.blueprint('#FFF4E6', false, 1)), 'idea-cream-slide': art.frame(art.blueprint('#FFF4E6', true, 1)),
};
const MARKS = ['rules-for-robots', 'engineering', 'creation', 'research'];

(async () => {
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(layers, { recursive: true }); fs.mkdirSync(fr);
  const browser = await chromium.launch();
  // The pictures, a little larger than the frame so a slow push-in stays sharp.
  const big = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1.25 });
  for (const [name, svg] of Object.entries(LAYERS)) {
    await big.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${svg}</body></html>`);
    await big.screenshot({ path: path.join(layers, name + '.png'), omitBackground: name.startsWith('idea-') });
  }
  await big.close();
  for (const m of MARKS) fs.copyFileSync(path.join(__dirname, '..', '..', 'brand', 'marks', m + '.svg'), path.join(layers, 'mark-' + m + '.svg'));
  const images = [...Object.keys(LAYERS).map((n) => n + '.png'), ...MARKS.map((m) => 'mark-' + m + '.svg')];
  fs.writeFileSync(path.join(out, 'film.html'), `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>html,body{margin:0;background:#000}svg{display:block}</style></head><body>
<svg id="film" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080"></svg>
<script>const IMAGES = ${JSON.stringify(images)};</script><script>${fs.readFileSync(path.join(__dirname, 'film-page.js'), 'utf8')}</script></body></html>`);

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('file://' + path.join(out, 'film.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => window.__ready);
  if (errors.length) { console.error(errors); process.exit(1); }
  const total = await page.evaluate(() => window.__total), n = Math.round(total * fps);
  console.log(`film: ${total.toFixed(1)} seconds, ${n} frames`);
  if (sheet) { const dir = path.join(out, 'sheet'); fs.mkdirSync(dir); const beats = await page.evaluate(() => window.__beats); let k = 0;
    for (const [name, start, dur] of beats) for (const at of [start + dur * .42, start + dur - .08]) { await page.evaluate((t) => window.__seek(t), at); await page.screenshot({ path: path.join(dir, `${String(k++).padStart(2, '0')}-${name}.jpg`), type: 'jpeg', quality: 85 }); }
    if (errors.length) console.error(errors); await browser.close(); return; }
  for (let i = 0; i < n; i++) { await page.evaluate((t) => window.__seek(t), i / fps); await page.screenshot({ path: path.join(fr, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 }); }
  if (errors.length) { console.error(errors); process.exit(1); }
  await browser.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(fr, 'f%05d.jpg'), '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, 'intro.mp4')]);
  console.log('wrote out/intro.mp4');
})();

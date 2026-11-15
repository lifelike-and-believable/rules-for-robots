// Renders the animatic: the approved design pictures and the approved script's words, timed, with no generated motion.
// Run: node animatic.cjs [fps]   (writes out/animatic.mp4; needs Playwright with Chromium, and ffmpeg)
// Or:  node animatic.cjs sheet   (writes two frames of each beat to out/animatic-sheet/)
// Stage 5 of docs/video/process.md. The timing and every word are in animatic-page.js.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const sheet = process.argv[2] === 'sheet', fps = sheet ? 24 : +(process.argv[2] || 24);
const out = path.join(__dirname, 'out'), layers = path.join(out, 'animatic-layers'), fr = path.join(out, 'animatic-fr');
const design = path.join(__dirname, 'design');
const FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=block">';
const PICS = ['01-hill', '02-box', '03-pine', '04-slide-on-ladder', '05-second-box', '06-sketch', '07-bare-pole', '08-flag', '09-slide', '10-village'];
const GREY = PICS.slice(0, 5);          // beats 1 to 6 play in ash
const SLIDE = ['04-slide-on-ladder', '05-second-box'];   // ...with the slide kept in colour
const MARKS = ['rules-for-robots', 'engineering', 'creation', 'research'];

(async () => {
  for (const d of [layers, fr]) { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); }
  for (const p of PICS) fs.copyFileSync(path.join(design, p + '.jpg'), path.join(layers, p + '.jpg'));
  for (const p of GREY) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(design, p + '.jpg'), '-vf', 'hue=s=0.1,eq=brightness=0.04:contrast=0.92', '-q:v', '2', path.join(layers, p + '-ash.jpg')]);
  for (const m of MARKS) fs.copyFileSync(path.join(__dirname, '..', '..', 'brand', 'marks', m + '.svg'), path.join(layers, 'mark-' + m + '.svg'));
  const browser = await chromium.launch();
  // The slide alone, cut out by its colour inside the area where it lies, so the ash pictures can keep it in colour.
  const cut = await browser.newPage();
  for (const p of SLIDE) {
    const data = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(design, p + '.jpg')).toString('base64');
    const png = await cut.evaluate(async (src) => {
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height), a = d.data, W = c.width, H = c.height;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, r = a[i], gg = a[i + 1], b = a[i + 2];
        const inArea = x > W * .38 && x < W * .595 && y > H * .55 && y < H * .97;
        const orange = r > 170 && gg > 88 && gg < 190 && b < 110 && r - b > 110;
        a[i + 3] = inArea && orange ? 255 : 0; }
      g.putImageData(d, 0, 0); return c.toDataURL('image/png');
    }, data);
    fs.writeFileSync(path.join(layers, p + '-slide.png'), Buffer.from(png.split(',')[1], 'base64'));
  }
  {
    const read = (p) => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(design, p + '.jpg')).toString('base64');
    const png = await cut.evaluate(async ([a, b]) => {
      const load = async (src) => { const i = new Image(); i.src = src; await i.decode(); return i; };
      const [ia, ib] = [await load(a), await load(b)], c = document.createElement('canvas'); c.width = ib.width; c.height = ib.height; const g = c.getContext('2d');
      g.drawImage(ia, 0, 0); const A = g.getImageData(0, 0, c.width, c.height).data; g.clearRect(0, 0, c.width, c.height); g.drawImage(ib, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height), B = d.data, W = c.width, H = c.height;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, diff = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
        B[i + 3] = x > W * .5 && y > H * .35 && diff > 90 ? 255 : 0; }
      g.putImageData(d, 0, 0); return c.toDataURL('image/png');
    }, [read('08-flag'), read('09-slide')]);
    fs.writeFileSync(path.join(layers, '09-slide-diff.png'), Buffer.from(png.split(',')[1], 'base64'));
  }
  await cut.close();
  const images = fs.readdirSync(layers);
  fs.writeFileSync(path.join(out, 'animatic.html'), `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>html,body{margin:0;background:#000}svg{display:block}</style></head><body>
<svg id="film" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080"></svg>
<script>const IMAGES = ${JSON.stringify(images)};</script><script>${fs.readFileSync(path.join(__dirname, 'animatic-page.js'), 'utf8')}</script></body></html>`);

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('file://' + path.join(out, 'animatic.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => window.__ready);
  if (errors.length) { console.error(errors); process.exit(1); }
  const total = await page.evaluate(() => window.__total), n = Math.round(total * fps);
  console.log(`animatic: ${total.toFixed(1)} seconds, ${n} frames`);
  if (sheet) { const dir = path.join(out, 'animatic-sheet'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir); const beats = await page.evaluate(() => window.__beats); let k = 0;
    for (const [name, start, dur] of beats) for (const at of [start + dur * .45, start + dur - .08]) { await page.evaluate((t) => window.__seek(t), at); await page.screenshot({ path: path.join(dir, `${String(k++).padStart(2, '0')}-${name}.jpg`), type: 'jpeg', quality: 85 }); }
    if (errors.length) console.error(errors); await browser.close(); return; }
  for (let i = 0; i < n; i++) { await page.evaluate((t) => window.__seek(t), i / fps); await page.screenshot({ path: path.join(fr, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 }); }
  if (errors.length) { console.error(errors); process.exit(1); }
  await browser.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(fr, 'f%05d.jpg'), '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, 'animatic.mp4')]);
  console.log('wrote out/animatic.mp4');
})();

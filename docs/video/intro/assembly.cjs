// Renders the assembled film: the approved motion clips under the approved animatic's words and timing.
// Run: node assembly.cjs [fps]   (writes out/assembly.mp4; needs Playwright with Chromium, and ffmpeg)
// Or:  node assembly.cjs sheet   (writes two frames of each beat to out/assembly-sheet/)
// Add "clips" to cut the clip frames again after motion/cuts.json changes; otherwise they are cut once.
// Or:  node assembly.cjs sound   (mixes the sound again and joins it to out/assembly.mp4, as out/film.mp4, without rendering)
// A full render also mixes the sound and writes out/film.mp4. The sound list is in assembly-page.js; the mixing, in sound.cjs.
// Stage 7 of docs/video/process.md. The clips' place in the film is in CLIPS, and every word, in assembly-page.js.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { clipFrames } = require('./assembly-clips.cjs');
const { mix } = require('./sound.cjs');

const args = process.argv.slice(2), sheet = args.includes('sheet'), fps = +(args.find((a) => /^\d+$/.test(a)) || 24);
const out = path.join(__dirname, 'out'), layers = path.join(out, 'assembly-layers'), clipsDir = path.join(layers, 'clips'), fr = path.join(out, 'assembly-fr');
const FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=block">';
const MARKS = ['rules-for-robots', 'engineering', 'creation', 'research'];

(async () => {
  if (args.includes('clips') || !fs.existsSync(clipsDir)) clipFrames(clipsDir);
  const frames = Object.fromEntries(fs.readdirSync(clipsDir).map((d) => [d, fs.readdirSync(path.join(clipsDir, d)).length]));
  for (const m of MARKS) fs.copyFileSync(path.join(__dirname, '..', '..', 'brand', 'marks', m + '.svg'), path.join(layers, 'mark-' + m + '.svg'));
  fs.writeFileSync(path.join(out, 'assembly.html'), `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>html,body{margin:0;background:${'#FFF4E6'}}
#stage{position:relative;width:1920px;height:1080px;overflow:hidden;background:#FFF4E6}img.pic,svg{position:absolute;left:0;top:0;width:1920px;height:1080px;display:block}</style></head><body>
<div id="stage"><img class="pic" alt=""><img class="pic" alt=""><svg id="film" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080"></svg></div>
<script>const FRAMES = ${JSON.stringify(frames)};</script><script>${fs.readFileSync(path.join(__dirname, 'assembly-page.js'), 'utf8')}</script></body></html>`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('file://' + path.join(out, 'assembly.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => window.__ready);
  if (errors.length) { console.error(errors); process.exit(1); }
  const total = await page.evaluate(() => window.__total), n = Math.round(total * fps);
  console.log(`assembly: ${total.toFixed(1)} seconds, ${n} frames`);
  const sounds = await page.evaluate(() => window.__sounds());
  fs.writeFileSync(path.join(out, 'sound-list.json'), JSON.stringify(sounds, null, 1));
  const withSound = () => { const wav = mix(sounds, out);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(out, 'assembly.mp4'), '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', path.join(out, 'film.mp4')]);
    console.log(`wrote out/film.mp4 (${sounds.effects.length} effects)`); };
  if (args.includes('sound')) { await browser.close(); withSound(); return; }
  const shot = async (t, file) => { await page.evaluate((x) => window.__seek(x), t); await page.screenshot({ path: file, type: 'jpeg', quality: 93 }); };
  if (sheet) { const dir = path.join(out, 'assembly-sheet'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir); const beats = await page.evaluate(() => window.__beats); let k = 0;
    for (const [name, start, dur] of beats) for (const at of [start + dur * .45, start + dur - .08]) await shot(at, path.join(dir, `${String(k++).padStart(2, '0')}-${name}.jpg`));
    if (errors.length) console.error(errors); await browser.close(); return; }
  fs.rmSync(fr, { recursive: true, force: true }); fs.mkdirSync(fr, { recursive: true });
  for (let i = 0; i < n; i++) await shot(i / fps, path.join(fr, `f${String(i).padStart(5, '0')}.jpg`));
  if (errors.length) { console.error(errors); process.exit(1); }
  await browser.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(fr, 'f%05d.jpg'), '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, 'assembly.mp4')]);
  console.log('wrote out/assembly.mp4');
  withSound();
})();

// Renders the assembled film: the approved motion clips under the approved animatic's words and timing.
// Run: node assembly.cjs [fps]   (writes out/assembly.mp4 and, with the sound, out/film.mp4; needs Playwright with Chromium, and ffmpeg)
// Or:  node assembly.cjs sheet   (writes two frames of each beat to out/assembly-sheet/)
// Or:  node assembly.cjs sound   (mixes the sound again and joins it to out/assembly.mp4, as out/film.mp4, without rendering)
// Add "vertical" or "square" for those shapes, and "short" for the 30-second cut (stage 10, cuts.md): the files are named for
// them, as out/film-vertical.mp4 or out/film-30s-square.mp4.
// Add "clips" to cut the clip frames again after motion/cuts.json changes; otherwise they are cut once.
// Stages 7 to 10 of docs/video/process.md. The clips' place in the film is in CLIPS, and every word, in assembly-page.js; the mixing
// is in sound.cjs. Every shape has the same timing, so they share one mix.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { clipFrames } = require('./assembly-clips.cjs');
const { mix } = require('./sound.cjs');

const args = process.argv.slice(2), sheet = args.includes('sheet'), fps = +(args.find((a) => /^\d+$/.test(a)) || 24);
// The frame, and where the picture goes in it: [left, top, width, height]. Where the box is narrower than 16:9, the page sets which
// part of the picture shows (in assembly-page.js, by the picture).
const SHAPES = {
  wide: { W: 1920, H: 1080, box: [0, 0, 1920, 1080] },
  vertical: { W: 1080, H: 1920, box: [0, 840, 1080, 1080] },
  square: { W: 1080, H: 1080, box: [0, 472, 1080, 608] },
};
const shape = Object.keys(SHAPES).find((k) => args.includes(k)) || 'wide', S = SHAPES[shape], cut = args.includes('short') ? 'short' : 'full';
const tag = (cut === 'short' ? '-30s' : '') + (shape === 'wide' ? '' : '-' + shape);
const out = path.join(__dirname, 'out'), layers = path.join(out, 'assembly-layers'), clipsDir = path.join(layers, 'clips'), fr = path.join(out, 'assembly-fr' + tag);
const FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=block">';
const MARKS = ['rules-for-robots', 'engineering', 'creation', 'research'];

(async () => {
  if (args.includes('clips') || !fs.existsSync(clipsDir)) clipFrames(clipsDir);
  const frames = Object.fromEntries(fs.readdirSync(clipsDir).map((d) => [d, fs.readdirSync(path.join(clipsDir, d)).length]));
  for (const m of MARKS) fs.copyFileSync(path.join(__dirname, '..', '..', 'brand', 'marks', m + '.svg'), path.join(layers, 'mark-' + m + '.svg'));
  const [bx, by, bw, bh] = S.box, html = path.join(out, `assembly${tag}.html`);
  fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>html,body{margin:0;background:#FFF4E6}
#stage{position:relative;width:${S.W}px;height:${S.H}px;overflow:hidden;background:#FFF4E6}
#box{position:absolute;left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;overflow:hidden}
img.pic{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;display:block}
svg{position:absolute;left:0;top:0;width:${S.W}px;height:${S.H}px;display:block}</style></head><body>
<div id="stage"><div id="box"><img class="pic" alt=""><img class="pic" alt=""></div><svg id="film" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S.W} ${S.H}" width="${S.W}" height="${S.H}"></svg></div>
<script>const FRAMES = ${JSON.stringify(frames)}; const SHAPE = ${JSON.stringify(shape)}; const CUT = ${JSON.stringify(cut)};</script><script>${fs.readFileSync(path.join(__dirname, 'assembly-page.js'), 'utf8')}</script></body></html>`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: S.W, height: S.H }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('file://' + html, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.__ready);
  if (errors.length) { console.error(errors); process.exit(1); }
  const total = await page.evaluate(() => window.__total), n = Math.round(total * fps);
  console.log(`assembly${tag}: ${total.toFixed(1)} seconds, ${n} frames, ${S.W} by ${S.H}`);
  const sounds = await page.evaluate(() => window.__sounds());
  fs.writeFileSync(path.join(out, `sound-list${tag}.json`), JSON.stringify(sounds, null, 1));
  const video = path.join(out, `assembly${tag}.mp4`), film = path.join(out, `film${tag}.mp4`);
  const withSound = () => { const wav = mix(sounds, out, 'sound' + tag);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', film]);
    console.log(`wrote out/film${tag}.mp4 (${sounds.effects.length} effects)`); };
  if (args.includes('sound')) { await browser.close(); withSound(); return; }
  const shot = async (t, file) => { await page.evaluate((x) => window.__seek(x), t); await page.screenshot({ path: file, type: 'jpeg', quality: 93 }); };
  if (sheet) { const dir = path.join(out, 'assembly-sheet' + tag); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir); const beats = await page.evaluate(() => window.__beats); let k = 0;
    for (const [name, start, dur] of beats) for (const at of [start + dur * .45, start + dur - .08]) await shot(at, path.join(dir, `${String(k++).padStart(2, '0')}-${name}.jpg`));
    if (errors.length) console.error(errors); await browser.close(); return; }
  fs.rmSync(fr, { recursive: true, force: true }); fs.mkdirSync(fr, { recursive: true });
  for (let i = 0; i < n; i++) await shot(i / fps, path.join(fr, `f${String(i).padStart(5, '0')}.jpg`));
  if (errors.length) { console.error(errors); process.exit(1); }
  await browser.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(fr, 'f%05d.jpg'), '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', video]);
  console.log(`wrote out/assembly${tag}.mp4`);
  withSound();
})();

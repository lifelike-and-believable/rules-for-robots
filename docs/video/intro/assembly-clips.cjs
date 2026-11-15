// Turns each chosen motion take into frames for assembly, cut as motion/cuts.json says: out/assembly-layers/clips/<take>/0001.jpg ...
// Takes in ASH also get grey frames in <take>-ash/, as the animatic's ash pictures are made. In the takes in SLIDE the slide stays in
// colour: a mask is made for each frame from the slide's own shape (see slideMask) and the colour frame is laid over the grey one through it.
// Run on its own: node assembly-clips.cjs   (assembly.cjs runs it when the frames are missing)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { cuts, take, graph } = require('./cuts.cjs');

const ASH = ['02-box-a', '03-pine-minimax-a', '04-slide-on-ladder-a', '05-second-box-a'];
const SLIDE = ['04-slide-on-ladder-a', '05-second-box-a'];
const GREY = 'hue=s=0.1,eq=brightness=0.04:contrast=0.92';
const W = 1920, H = 1080;
const ff = (args) => execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', ...args], { maxBuffer: 1 << 26 });

// The slide in one frame, as a grey mask. The bright orange, inside the part of the picture the slide passes through, makes
// pieces; only the largest piece is the slide, so specks of orange on the ladder or the trunk are left out. The slide is then
// grown by up to GROW pixels into warm neighbours, which takes in its darker rim and its highlights but not the grass or the ladder.
const GROW = 18, MIN = 150;
function slideMask(rgb) {
  const n = W * H, core = new Uint8Array(n), seen = new Int32Array(n).fill(-1), at = (i, k) => rgb[i * 3 + k];
  for (let y = Math.floor(H * .4); y < H * .98; y++) for (let x = Math.floor(W * .36); x < W * .62; x++) { const i = y * W + x, r = at(i, 0), g = at(i, 1), b = at(i, 2);
    core[i] = r > 170 && g > 88 && g < 190 && b < 110 && r - b > 110 ? 1 : 0; }
  let best = -1, bestSize = 0, label = 0; const stack = new Int32Array(n);
  for (let s = 0; s < n; s++) { if (!core[s] || seen[s] >= 0) continue;
    let top = 0, size = 0; stack[top++] = s; seen[s] = label;
    while (top) { const i = stack[--top]; size++; const x = i % W;
      for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < n && Math.abs((j % W) - x) <= 1 && core[j] && seen[j] < 0) { seen[j] = label; stack[top++] = j; } }
    if (size > bestSize) { bestSize = size; best = label; } label++; }
  const mask = new Uint8Array(n); let front = [];
  // Before the slide comes out of the box, the largest piece is a speck on the trunk or the ladder (10 to 20 pixels); the slide's
  // first sliver is about 250. Below MIN there is no slide, and nothing stays in colour.
  if (bestSize < MIN) return mask;
  for (let i = 0; i < n; i++) if (seen[i] === best && best >= 0) { mask[i] = 255; front.push(i); }
  const warm = (i) => at(i, 0) > 100 && at(i, 0) - at(i, 2) > 50;
  for (let step = 0; step < GROW; step++) { const next = [];
    for (const i of front) { const x = i % W; for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < n && Math.abs((j % W) - x) <= 1 && !mask[j] && warm(j)) { mask[j] = 255; next.push(j); } }
    front = next; }
  return mask;
}

function clipFrames(dir) {
  const { fps, clips } = cuts();
  const made = {};
  const fresh = (name) => { const d = path.join(dir, name); fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); return d; };
  for (const c of clips) {
    const d = fresh(c.take);
    ff(['-i', take(c.take), '-filter_complex', graph(c.parts, fps, `${W}:${H}`), '-map', '[v]', '-q:v', '2', path.join(d, '%04d.jpg')]);
    const count = made[c.take] = fs.readdirSync(d).length;
    if (!ASH.includes(c.take)) continue;
    const a = fresh(c.take + '-ash');
    if (!SLIDE.includes(c.take)) { ff(['-i', path.join(d, '%04d.jpg'), '-vf', GREY, '-q:v', '2', path.join(a, '%04d.jpg')]); made[c.take + '-ash'] = count; continue; }
    const m = fresh(c.take + '-mask');
    for (let f = 1; f <= count; f++) { const name = String(f).padStart(4, '0');
      const rgb = ff(['-i', path.join(d, name + '.jpg'), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
      fs.writeFileSync(path.join(m, name + '.pgm'), Buffer.concat([Buffer.from(`P5\n${W} ${H}\n255\n`), slideMask(rgb)])); }
    ff(['-i', path.join(d, '%04d.jpg'), '-i', path.join(m, '%04d.pgm'), '-filter_complex',
      `[0]format=gbrp,split[c][a];[a]${GREY},format=gbrp[g];[1]gblur=sigma=.8,format=gbrp[k];[g][c][k]maskedmerge`, '-q:v', '2', path.join(a, '%04d.jpg')]);
    fs.rmSync(m, { recursive: true, force: true });
    made[c.take + '-ash'] = count;
  }
  return { fps, frames: made };
}

module.exports = { clipFrames };
if (require.main === module) { const r = clipFrames(path.join(__dirname, 'out', 'assembly-layers', 'clips')); console.log(r.frames); }

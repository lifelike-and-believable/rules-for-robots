// Strings the chosen motion takes into a reel, cut as motion/cuts.json says, with a label on each.
// Run: node motion.cjs   (writes out/motion-reel.mp4; needs ffmpeg)
// Stage 6 of docs/video/process.md. Assembly reads the same cuts, through cuts.cjs.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { cuts, take, graph } = require('./cuts.cjs');

const { fps, clips } = cuts();
const out = path.join(__dirname, 'out'), dir = path.join(out, 'motion-reel');
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const list = clips.map((c, i) => {
  const file = path.join(dir, String(i + 1).padStart(2, '0') + '.mp4');
  const text = `Beat ${c.beat} · ${c.label} (${c.take}${c.parts ? ', cut' : ''})`.replace(/[:']/g, '\\$&');
  execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', take(c.take),
    '-filter_complex', `${graph(c.parts, fps, '1280:720')};[v]drawtext=fontfile=${FONT}:text='${text}':x=24:y=h-52:fontsize=26:fontcolor=white:box=1:boxcolor=0x2A1A14@0.75:boxborderw=10[o]`,
    '-map', '[o]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-an', file]);
  return `file '${file}'`;
});
fs.writeFileSync(path.join(dir, 'list.txt'), list.join('\n') + '\n');
execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-c', 'copy', path.join(out, 'motion-reel.mp4')]);
console.log('wrote out/motion-reel.mp4');

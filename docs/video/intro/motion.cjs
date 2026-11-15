// Strings the chosen motion takes into a reel, cut as motion/cuts.json says, with a label on each.
// Run: node motion.cjs   (writes out/motion-reel.mp4; needs ffmpeg)
// Stage 6 of docs/video/process.md. Assembly reads the same cuts.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const { fps, clips } = JSON.parse(fs.readFileSync(path.join(__dirname, 'motion', 'cuts.json'), 'utf8'));
const out = path.join(__dirname, 'out'), dir = path.join(out, 'motion-reel');
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const HOLD = 6;   // frames the first part's last frame is held, and dissolved over

// The filter for one take: its parts, joined by a hold and a dissolve.
function cut(parts) {
  if (!parts) return { graph: `[0:v]fps=${fps},scale=1280:720[v]`, frames: null };
  const trims = parts.map(([a, b], i) => `[0:v]trim=start_frame=${a}:end_frame=${b},setpts=PTS-STARTPTS,fps=${fps},scale=1280:720${i < parts.length - 1 ? `,tpad=stop_mode=clone:stop=${HOLD}` : ''}[p${i}]`);
  let graph = trims.join(';'), last = 'p0', len = parts[0][1] - parts[0][0] + HOLD;
  for (let i = 1; i < parts.length; i++) {
    const tag = i === parts.length - 1 ? 'v' : `x${i}`;
    graph += `;[${last}][p${i}]xfade=transition=fade:duration=${HOLD / fps}:offset=${(len - HOLD) / fps}[${tag}]`;
    last = tag; len += parts[i][1] - parts[i][0] - HOLD + (i < parts.length - 1 ? HOLD : 0);
  }
  return { graph, frames: len };
}

fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const list = clips.map((c, i) => {
  const file = path.join(dir, String(i + 1).padStart(2, '0') + '.mp4');
  const { graph } = cut(c.parts);
  const text = `Beat ${c.beat} · ${c.label} (${c.take}${c.parts ? ', cut' : ''})`.replace(/[:']/g, '\\$&');
  execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', path.join(__dirname, 'motion', c.take + '.mp4'),
    '-filter_complex', `${graph};[v]drawtext=fontfile=${FONT}:text='${text}':x=24:y=h-52:fontsize=26:fontcolor=white:box=1:boxcolor=0x2A1A14@0.75:boxborderw=10[o]`,
    '-map', '[o]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-an', file]);
  return `file '${file}'`;
});
fs.writeFileSync(path.join(dir, 'list.txt'), list.join('\n') + '\n');
execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-c', 'copy', path.join(out, 'motion-reel.mp4')]);
console.log('wrote out/motion-reel.mp4');

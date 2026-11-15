// The chosen motion takes and the frames of each the film uses, as motion/cuts.json records them.
// cuts() reads the file; graph(parts, size) is the ffmpeg filter that plays a take's parts, joined by a hold and a dissolve.
const fs = require('fs');
const path = require('path');

const HOLD = 6;   // frames a part's last frame is held, and dissolved over into the next part

const cuts = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'motion', 'cuts.json'), 'utf8'));
const take = (name) => path.join(__dirname, 'motion', name + '.mp4');

// Input [0:v] to output [v], at fps and the given size ('1920:1080').
function graph(parts, fps, size) {
  if (!parts) return `[0:v]fps=${fps},scale=${size}[v]`;
  const trims = parts.map(([a, b], i) => `[0:v]trim=start_frame=${a}:end_frame=${b},setpts=PTS-STARTPTS,fps=${fps},scale=${size}${i < parts.length - 1 ? `,tpad=stop_mode=clone:stop=${HOLD}` : ''}[p${i}]`);
  let g = trims.join(';'), last = 'p0', len = parts[0][1] - parts[0][0] + HOLD;
  for (let i = 1; i < parts.length; i++) {
    const tag = i === parts.length - 1 ? 'v' : `x${i}`;
    g += `;[${last}][p${i}]xfade=transition=fade:duration=${HOLD / fps}:offset=${(len - HOLD) / fps}[${tag}]`;
    last = tag; len += parts[i][1] - parts[i][0] - (i < parts.length - 1 ? 0 : HOLD);
  }
  return g;
}

module.exports = { cuts, take, graph };

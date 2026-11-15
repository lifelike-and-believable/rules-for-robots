// Mixes the film's sound from the list assembly-page.js gives (window.__sounds): the two music cues and every effect at its time,
// levelled to -16 LUFS (true peak -1.5 dB), the usual level for video on the web. assembly.cjs calls mix() and joins the result
// to the picture as out/film.mp4. Stage 8 of docs/video/process.md.
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const SOUND = path.join(__dirname, 'sound'), SFX = path.join(SOUND, 'sfx');
const ff = (args) => execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', ...args]);

// The three effects made in code: a whoosh for the turn's wipe, a longer one for the pull back, and a boing for the wink.
function made(dir) {
  const whoosh = (name, d, lo, hi) => ff(['-f', 'lavfi', '-i', `anoisesrc=d=${d}:c=pink:a=0.6:r=44100`, '-af',
    `highpass=f=${lo},lowpass=f=${hi},afade=t=in:d=${d * .45}:curve=qsin,afade=t=out:st=${d * .45}:d=${d * .55}:curve=qsin`, '-ac', '2', path.join(dir, name + '.wav')]);
  whoosh('whoosh', .55, 500, 5000);
  whoosh('whoosh-long', 2.2, 200, 2500);
  // A falling, wobbling tone that dies away, as a cartoon spring does.
  ff(['-f', 'lavfi', '-i', "aevalsrc='0.5*sin(2*PI*(260*t+40*t*t)+5*sin(2*PI*9*t)*exp(-4*t))*exp(-5*t)':d=0.75:s=44100", '-af', 'afade=t=in:d=0.005', '-ac', '2', path.join(dir, 'boing.wav')]);
}

function mix({ music, effects, total }, out) {
  const tmp = path.join(out, 'sound-made'); fs.mkdirSync(tmp, { recursive: true }); made(tmp);
  const file = (name) => { for (const p of [path.join(SFX, name + '.ogg'), path.join(tmp, name + '.wav')]) if (fs.existsSync(p)) return p; throw new Error('no sound ' + name); };
  const inputs = [], parts = [];
  music.forEach((m, i) => { inputs.push('-i', path.join(SOUND, m.file));
    const fade = m.fadeOut ? `,afade=t=out:st=${m.fadeOut[0] - m.at}:d=${m.fadeOut[1] - m.fadeOut[0]}` : '';
    parts.push(`[${i}:a]aresample=44100,aformat=channel_layouts=stereo,volume=${m.gain}dB${fade},adelay=${Math.round(m.at * 1000)}:all=1[m${i}]`); });
  effects.forEach((e, j) => { const i = music.length + j; inputs.push('-i', file(e.file));
    const shift = e.pitch ? `asetrate=44100*${Math.pow(2, e.pitch / 12).toFixed(5)},aresample=44100,` : '';
    parts.push(`[${i}:a]aresample=44100,${shift}aformat=channel_layouts=stereo,volume=${e.gain}dB,adelay=${Math.round(e.t * 1000)}:all=1[e${j}]`); });
  const labels = music.map((_, i) => `[m${i}]`).concat(effects.map((_, j) => `[e${j}]`)).join('');
  const graph = parts.join(';') + `;${labels}amix=inputs=${music.length + effects.length}:normalize=0:duration=longest,atrim=0:${total}[a]`;
  const script = path.join(out, 'sound-graph.txt'); fs.writeFileSync(script, graph);
  const raw = path.join(out, 'sound-raw.wav'), wav = path.join(out, 'sound.wav');
  ff([...inputs, '-filter_complex_script', script, '-map', '[a]', '-c:a', 'pcm_f32le', raw]);
  // Two passes: measure, then level by one gain for the whole film (linear), so the mix keeps its dynamics.
  const LN = 'loudnorm=I=-16:TP=-1.5:LRA=11';
  const report = spawnSync('ffmpeg', ['-nostdin', '-hide_banner', '-i', raw, '-af', LN + ':print_format=json', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const m = JSON.parse(/\{[^{}]*"input_i"[^{}]*\}/.exec(report)?.[0] ?? (() => { throw new Error('no loudnorm report'); })());
  ff(['-i', raw, '-af', `${LN}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`, '-ar', '48000', wav]);
  return wav;
}

module.exports = { mix };

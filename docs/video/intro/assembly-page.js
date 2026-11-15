// The film assembled, as a function of time: the approved motion clips (motion/cuts.json) under the approved animatic's words and
// timing (animatic-page.js). Runs in the page assembly.cjs builds; window.__seek(t) draws the moment t seconds in, and resolves once
// its pictures are decoded. Stage 7 of docs/video/process.md. The words, bubbles, turn, and end card are the animatic's, unchanged.
/* global FRAMES */
const CREAM = '#FFF4E6', INK = '#2A1A14', O = '#E4572E', SP = '#B8401D', TI = '#F9C9B2', P = '#7A45C9', MUTED = '#6B665E';
const FONT = "'Space Grotesk','Segoe UI',system-ui,sans-serif";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (p) => 1 - Math.pow(1 - clamp(p), 3);
const inout = (p) => { p = clamp(p); return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };
const back = (p) => { p = clamp(p); const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
const prog = (t, at, dur = .4) => clamp((t - at) / dur);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const txt = (s, x, y, size, fill, weight = 700, anchor = 'start') => `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;
const pop = (p, cx, cy, inner) => p <= 0 ? '' : `<g opacity="${ease(p * 1.6).toFixed(3)}" transform="translate(${cx} ${cy}) scale(${(.82 + .18 * back(p)).toFixed(4)}) translate(${-cx} ${-cy})">${inner}</g>`;
const rise = (p, inner, d = 26) => p <= 0 ? '' : `<g opacity="${ease(p).toFixed(3)}" transform="translate(0 ${((1 - ease(p)) * d).toFixed(2)})">${inner}</g>`;
const fade = (o, inner) => o <= 0 ? '' : `<g opacity="${clamp(o).toFixed(3)}">${inner}</g>`;

/* Faces and bubbles, as in the animatic. */
const R = `<line x1="43.5" y1="34" x2="43.5" y2="23" stroke="${CREAM}" stroke-width="5"/><circle cx="43.5" cy="19" r="5.5" fill="${CREAM}"/><rect x="36" y="32" width="15" height="66" fill="${CREAM}"/><path d="M43.5 39.5 H68 a18.5 18.5 0 0 1 0 37 H43.5" fill="none" stroke="${CREAM}" stroke-width="15"/><polygon points="56,76 77,76 99,98 78,98" fill="${CREAM}"/><circle cx="65" cy="58" r="6.5" fill="${INK}"/>`;
const face = (x, y, brand) => { const bar = (bx, by, w) => `<rect x="${bx}" y="${by}" width="${w}" height="8" rx="4"/>`;
  return brand ? `<svg x="${x}" y="${y}" width="76" height="76" viewBox="0 0 128 128"><rect width="128" height="128" rx="26" fill="${O}"/><path d="M0 26 A26 26 0 0 1 20 1 V127 A26 26 0 0 1 0 102 Z" fill="${SP}"/><g transform="translate(9 8.5) scale(.64)">${R}</g><g fill="${TI}">${bar(79, 29, 29)}${bar(79, 46, 29)}${bar(79, 63, 29)}${bar(32, 82, 76)}${bar(32, 97, 50)}</g></svg>`
    : `<rect x="${x}" y="${y}" width="76" height="76" rx="16" fill="#A8A297"/>`; };
function bubble(who, s, y, p, brand, typed = 1) {
  if (p <= 0) return '';
  const size = 34, pad = 28, lines = s.split('\n'), h = 72 + 42 * (lines.length - 1), x = who === 'you' ? 110 : 200;
  const w = Math.round(Math.max(...lines.map((l) => l.length)) * size * .56) + pad * 2;
  let left = Math.ceil(s.length * clamp(typed));
  const shown = lines.map((l) => { const part = l.slice(0, Math.max(0, left)); left -= l.length + 1; return part; });
  return pop(p, x + 40, y + 36, `<g filter="url(#soft)">${who === 'you' ? '' : face(x - 90, y - 2, brand)}<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="36" fill="${who === 'you' ? INK : '#FFFFFF'}"/>${shown.map((l, i) => txt(l, x + pad, y + 47 + 42 * i, size, who === 'you' ? CREAM : INK, 500)).join('')}</g>`);
}
const talk = (rows, t, brand, y0 = 290, gap = 88) => rows.map(([who, s, at], i) => bubble(who, s, y0 + i * gap, at < 0 ? 1 : prog(t, at, .35), brand, who === 'you' && at >= 0 ? prog(t, at + .1, Math.min(.9, s.length * .035)) : 1)).join('');
const heading = (t, a, b, colourB, size = 60, atB = .45) => rise(prog(t, .1), txt(a, 110, 140, size, INK)) + (b ? rise(prog(t, atB), txt(b, 110, 140 + size * 1.15, size, colourB)) : '');

/* The page: two picture layers below, words above. */
const film = document.getElementById('film');
film.innerHTML = `<defs><filter id="soft" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="${INK}" flood-opacity=".16"/></filter></defs>
<g id="words"></g><g id="marks"></g><g id="over"></g>`;
const words = document.getElementById('words'), over = document.getElementById('over'), layers = [...document.querySelectorAll('img.pic')];
const marks = {};
for (const m of ['rules-for-robots', 'engineering', 'creation', 'research']) { const el = document.createElementNS('http://www.w3.org/2000/svg', 'image');
  el.setAttribute('href', `assembly-layers/mark-${m}.svg`); el.setAttribute('opacity', 0); document.getElementById('marks').appendChild(el); marks[m] = el; }
const placeMark = (name, x, y, s, opacity) => { const el = marks[name]; el.setAttribute('x', x); el.setAttribute('y', y); el.setAttribute('width', s); el.setAttribute('height', s); el.setAttribute('opacity', clamp(opacity).toFixed(3)); };

/* The clips. Each is placed in the film by one frame of its change (key), the moment in the film it is shown (at, in seconds from
   the start), and how fast it plays (speed). Before its first frame a clip holds that frame; after its last it holds that, or, where
   loop is given, plays that stretch back and forth so a flag keeps moving. The -ash takes play in step with their colour take. */
const FPS = 24;
const CLIPS = {
  '02-box-a': { key: 12, at: 2.65, speed: 1.25 },               // the box falls as the colour drains, and lands on "Done! One treehouse."
  '03-pine-minimax-a': { key: 14, at: 8.2, speed: 1.2 },        // the tree becomes a pine on "Added! One ladder."
  '04-slide-on-ladder-a': { key: 18, at: 13.6, speed: 1.2 },    // the slide comes down on "Added! One slide."
  '05-second-box-a': { key: 42, at: 28.85, speed: 1 },          // the second box pops in on "The treehouse."
  '06-sketch-a': { key: 8, at: 38, speed: 2.4 },                // the sketch draws itself on "Here is a sketch."
  '07-build-b': { key: 9, at: 39.75, speed: 1.6 },              // built after "Approved."
  '08-flag-a': { key: 30, at: 43.7, speed: 1.3, loop: [70, 123] },   // the orange flag runs up once it is chosen
  '09-slide-a': { key: 5, at: 50.5, speed: 1.6, loop: [80, 100] },   // the slide unrolls on "Add a slide."
  '10-village-b': { key: 2, at: 54.6, speed: 1.6 },             // the pull back to the village
};
function frameOf(name, T) {
  const c = CLIPS[name.replace(/-ash$/, '')], n = FRAMES[name];
  let f = Math.round(c.key + (T - c.at) * FPS * c.speed);
  if (f > n - 1 && c.loop) { const [a, b] = c.loop, span = b - a, k = (f - a) % (2 * span); f = a + (k <= span ? k : 2 * span - k); }
  return clamp(f, 0, n - 1) + 1;
}
let NOW = 0, shown = [];
const pic = (name, opacity = 1) => { if (opacity > 0) shown.push([name, opacity]); };

const WINK = [[0, 1, 1, 0, 0], [.14, 1.2, .76, 0, 0], [.3, .84, 1.24, -8, -26], [.46, .88, 1.16, -5, -14], [.6, 1.16, .84, 0, 0], [.75, .94, 1.07, 0, 0], [.9, 1.04, .96, 0, 0], [1.05, .99, 1.01, 0, 0], [1.2, 1, 1, 0, 0]];
function wink(w) { if (w <= 0 || w >= 1.2) return [1, 1, 0, 0];
  let i = 0; while (WINK[i + 1][0] < w) i++;
  const [t0, ...a] = WINK[i], [t1, ...b] = WINK[i + 1], p = inout((w - t0) / (t1 - t0));
  return a.map((v, j) => v + (b[j] - v) * p); }

const BEATS = [
  // 1. The idea.
  { name: 'idea', dur: 2.5, draw: (t) => { pic('02-box-a');
      return heading(t, 'You have an idea.') + talk([['you', 'Build me a treehouse.', .3]], t, false); } },
  // 2. Literal: the colour drains, and a box falls into the tree with no way up.
  { name: 'literal', dur: 4.5, draw: (t) => { pic('02-box-a'); pic('02-box-a-ash', ease(prog(t, 0, .6)));
      return heading(t, 'Exactly what you said.', 'Not what you meant.', MUTED) + talk([['you', 'Build me a treehouse.', -1], ['agent', 'Done! One treehouse.', .9], ['you', 'How do I get up?', 2]], t, false); } },
  // 3. One change: the ladder lands, and the tree turns into a pine.
  { name: 'one-change', dur: 5.5, draw: (t) => { pic('02-box-a-ash'); pic('03-pine-minimax-a-ash', ease(prog(t, 0, .25)));
      return heading(t, 'You ask for one change.', 'Everything else changes too.', MUTED, 52) + talk([['you', 'Add a ladder.', .2], ['agent', 'Added! One ladder.', 1.3], ['you', 'Why is it a pine tree?', 2.7]], t, false); } },
  // 4. An addition: the slide, the one thing in colour, comes down over the ladder.
  { name: 'addition', dur: 5, draw: (t) => { pic('03-pine-minimax-a-ash'); pic('04-slide-on-ladder-a-ash', ease(prog(t, 0, .25)));
      return heading(t, 'You add what you forgot.', 'It gets bolted on.', MUTED) + talk([['you', 'And a slide.', .2], ['agent', 'Added! One slide.', 1.2], ['you', "It's blocking the ladder.", 2.3]], t, false); } },
  // 5. Micromanaging: one order, and the questions pile up.
  { name: 'micromanage', dur: 8, draw: (t) => { pic('04-slide-on-ladder-a-ash');
      return heading(t, 'So you micromanage.', 'Now it asks about everything.', MUTED) + talk([['you', 'Ask before you change anything.', .6], ['agent', 'May I pick up the hammer?', 2.4], ['agent', 'May I use the hammer?', 3.7], ['agent', 'May I put the hammer down?', 5]], t, false); } },
  // 6. Next session: the conversation is wiped, and a second box pops into the tree.
  { name: 'next-session', dur: 5.5, draw: (t) => { pic('04-slide-on-ladder-a-ash'); pic('05-second-box-a-ash', ease(prog(t, 0, .3)));
      const gone = 1 - ease(prog(t, 0, .45)), line = ease(prog(t, .45, .4));
      const old = fade(gone, `<g transform="translate(0 ${(-60 * (1 - gone)).toFixed(1)})">${heading(9, 'So you micromanage.', 'Now it asks about everything.', MUTED)}${talk([['you', 'Ask before you change anything.', -1], ['agent', 'May I pick up the hammer?', -1], ['agent', 'May I use the hammer?', -1], ['agent', 'May I put the hammer down?', -1]], 9, false)}</g>`);
      const divider = fade(line, `<line x1="110" y1="276" x2="${(110 + 470 * line).toFixed(1)}" y2="276" stroke="${MUTED}" stroke-width="3" stroke-dasharray="10 9"/>${txt('New session', 600, 288, 34, MUTED, 700)}`);
      return old + (t > .5 ? heading(t - .5, 'The next session,', 'it remembers nothing.', MUTED) : '') + divider
        + talk([['you', "Let's keep going.", .9], ['agent', 'Sure! What are we working on?', 1.7], ['you', 'The treehouse.', 2.6], ['agent', 'Done! One treehouse.', 3.9]], t, false, 318, 84); } },
  // 7. The turn.
  { name: 'turn', dur: 4, draw: (t) => { pic('05-second-box-a-ash'); const w = 1920 * inout(prog(t, 0, .5));
      return `<rect width="${w.toFixed(1)}" height="1080" fill="${O}"/><rect width="${Math.min(96, w).toFixed(1)}" height="1080" fill="${SP}"/>`
        + pop(prog(t, .35, .5), 1560, 520, `<circle cx="1560" cy="520" r="430" fill="#EB6A43" opacity=".55"/><g transform="translate(1166 196) scale(6.1)" filter="url(#soft)">${R}</g>`)
        + rise(prog(t, .45), txt('What you wanted', 190, 430, 110, CREAM), 40) + rise(prog(t, .9), txt('was a collaborator.', 190, 560, 110, TI), 40)
        + rise(prog(t, 2), txt('Rules for Robots gives you', 194, 700, 60, CREAM, 500) + txt('a whole team of them.', 194, 774, 60, CREAM, 500), 24); } },
  // 8. It asks first: the hill, the sketch drawing itself, then the treehouse built to it.
  { name: 'asks', dur: 6.5, draw: (t) => { pic('06-sketch-a'); pic('07-build-b', ease(prog(t, 4.6, .15)));
      return `<rect width="1920" height="1080" fill="${O}" opacity="${(1 - ease(prog(t, 0, .45))).toFixed(3)}"/>` + heading(t, 'It asks before it builds.')
        + talk([['agent', 'Before I build: who is it for?', .5], ['you', 'My kids. They love to climb.', 1.6], ['agent', 'Here is a sketch. Is this it?', 3.1], ['you', 'Approved.', 4.3]], t, true); } },
  // 9. Your decision: two flags offered, and the orange one runs up the pole.
  { name: 'decision', dur: 3.5, draw: (t) => { pic('07-build-b'); pic('08-flag-a', ease(prog(t, 0, .25)));
      const flag = (x, fill, at) => pop(prog(t, at, .35), x + 50, 560, `<line x1="${x}" y1="500" x2="${x}" y2="640" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M${x + 4} 504 C${x + 34} 492 ${x + 60} 520 ${x + 112} 502 L${x + 86} 530 L${x + 116} 556 C${x + 66} 552 ${x + 40} 574 ${x + 4} 558 Z" fill="${fill}"/>`);
      return heading(t, 'It asks you what only', 'you can decide.', INK) + talk([['agent', 'The flag: orange or violet?', .3], ['you', 'Orange.', 1.5]], t, true, 310)
        + fade(1 - ease(prog(t, 2.7, .4)), flag(480, O, .6) + flag(660, P, .75) + `<rect x="452" y="474" width="172" height="186" rx="18" fill="none" stroke="${O}" stroke-width="7" opacity="${ease(prog(t, 1.8, .3)).toFixed(3)}"/>`); } },
  // 10. The record.
  { name: 'record', dur: 5, draw: (t) => { pic('08-flag-a');
      const row = (i, a, b) => rise(prog(t, 1.1 + i * .7, .35), `<circle cx="164" cy="${588 + i * 118}" r="10" fill="${O}"/>${txt(a, 194, 600 + i * 118, 38, INK)}${txt(b, 194, 644 + i * 118, 32, MUTED, 500)}`, 16);
      return heading(t, 'It writes down why.') + talk([['agent', 'Noted, so the next session\nknows too.', .3]], t, true)
        + pop(prog(t, .7, .4), 430, 610, `<g filter="url(#soft)"><rect x="114" y="452" width="640" height="340" rx="20" fill="#FFFFFF"/></g>${txt('Decisions', 150, 516, 38, INK)}`)
        + row(0, 'Flag: orange', 'Your choice.') + row(1, 'Ladder on the left', 'So the kids can climb up.'); } },
  // 11. A change: the slide unrolls, and nothing else moves.
  { name: 'change', dur: 4.5, draw: (t) => { pic('08-flag-a'); pic('09-slide-a', ease(prog(t, 0, .3)));
      return talk([['you', 'Add a slide.', .1], ['agent', 'Added. Nothing else moved.', 1.4]], t, true) + (t > 2 ? heading(t - 2, 'A change is a change.', 'Not a restart.', SP) : ''); } },
  // 12. The promise: the view pulls back from the one treehouse to the village, and the motto arrives.
  { name: 'promise', dur: 4.5, draw: (t) => { pic('09-slide-a'); pic('10-village-b', ease(prog(t, 0, .2)));
      return rise(prog(t, 1.4), txt('A skilled team building your biggest ideas,', 960, 96, 54, INK, 700, 'middle')) + rise(prog(t, 1.9), txt('the way you envision them.', 960, 164, 54, SP, 700, 'middle')); } },
  // 13. End: the motto stays at the top, and the name comes out below it with the guide line under it.
  { name: 'end', dur: 5.5, draw: (t) => { const p = inout(prog(t, 0, .7)); pic('10-village-b', 1 - p);
      placeMark('rules-for-robots', 413, 360, 150, ease(prog(t, .5, .4)));
      ['engineering', 'creation', 'research'].forEach((m, i) => placeMark(m, 552 + i * 78, 688, 64, ease(prog(t, 1.6 + i * .1, .35))));
      // The R winks with its whole body, as in the animatic.
      const k = 150 / 128, ex = 413 + (9 + 65 * .64) * k, ey = 360 + (8.5 + 58 * .64) * k, er = 6.5 * .64 * k, w = t - 3.9;
      const [sx, sy, rot, dy] = wink(w), shut = w < .25 ? 0 : w < .31 ? (w - .25) / .06 : w < .6 ? 1 : w < .68 ? 1 - (w - .6) / .08 : 0;
      const body = w <= 0 || w >= 1.2 ? '' : `translate(488 510) translate(0 ${dy.toFixed(2)}) rotate(${rot.toFixed(2)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(-488 -510)`;
      if (body) marks['rules-for-robots'].setAttribute('transform', body);
      over.setAttribute('transform', body);
      over.innerHTML = shut <= 0 ? '' : `<circle cx="${ex}" cy="${ey}" r="${(er + 1.6).toFixed(2)}" fill="${O}"/>` + (shut > .7
        ? `<path d="M${ex - er * 1.6} ${ey - er * .5} Q${ex} ${ey + er * 1.4} ${ex + er * 1.6} ${ey - er * .5}" fill="none" stroke="${INK}" stroke-width="${(er * .75).toFixed(2)}" stroke-linecap="round"/>`
        : `<ellipse cx="${ex}" cy="${ey}" rx="${er}" ry="${(er * (1 - shut)).toFixed(2)}" fill="${INK}"/>`);
      return txt('A skilled team building your biggest ideas,', 960, 96, 54, INK, 700, 'middle') + txt('the way you envision them.', 960, 164, 54, SP, 700, 'middle')
        + rise(prog(t, .5), txt('Rules for Robots', 593, 470, 104, INK))
        + rise(prog(t, 1), txt('A practical guide for people and agents who work together', 597, 530, 32, SP, 500))
        + rise(prog(t, 1.6), txt('github.com/RulesForRobots', 802, 734, 40, INK, 700))
        + rise(prog(t, 1.7), txt('Rules and plugins for Claude Code.', 960, 820, 36, '#4A3F38', 500, 'middle'))
        + rise(prog(t, 2.6), txt('(Yes, you may put the hammer down.)', 960, 950, 38, MUTED, 500, 'middle')); } },
];
let acc = 0; for (const b of BEATS) { b.start = acc; acc += b.dur; }
window.__total = acc; window.__beats = BEATS.map((b) => [b.name, b.start, b.dur]);
window.__ready = Promise.all([document.fonts.ready, ...Object.values(marks).map((el) => { const i = new Image(); i.src = el.getAttribute('href'); return i.decode().catch(() => {}); })]);
// Draw the moment t: the words at once, and the pictures once their frames are decoded.
window.__seek = async (t) => { t = clamp(t, 0, acc - .001); NOW = t; shown = [];
  for (const el of Object.values(marks)) { el.setAttribute('opacity', 0); el.removeAttribute('transform'); }
  over.innerHTML = ''; over.removeAttribute('transform');
  const b = BEATS.filter((x) => t >= x.start).pop();
  const html = b.draw(t - b.start, b.dur);
  const srcs = shown.map(([name]) => `assembly-layers/clips/${name}/${String(frameOf(name, NOW)).padStart(4, '0')}.jpg`);
  await Promise.all(layers.map(async (img, i) => { if (!srcs[i]) { img.style.opacity = 0; return; }
    if (img.getAttribute('src') !== srcs[i]) { img.src = srcs[i]; await img.decode().catch(() => {}); }
    img.style.opacity = shown[i][1].toFixed(3); }));
  words.innerHTML = html; };

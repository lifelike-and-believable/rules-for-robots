// The film, as a function of time. Runs in the page that film.cjs builds: window.__seek(t) draws the moment t seconds in.
// The pictures are images that stay in the page; the words and bubbles are redrawn for every frame.
/* global IMAGES */
const CREAM = '#FFF4E6', ASH = '#F2EADF', INK = '#2A1A14', O = '#E4572E', SP = '#B8401D', TI = '#F9C9B2', P = '#7A45C9', MUTED = '#6B665E';
const FONT = "'Space Grotesk','Segoe UI',system-ui,sans-serif";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (p) => 1 - Math.pow(1 - clamp(p), 3);
const back = (p) => { p = clamp(p); const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
const prog = (t, at, dur = .4) => clamp((t - at) / dur);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const txt = (s, x, y, size, fill, weight = 700, anchor = 'start') => `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;
// Arrive by growing a little past full size, about a point.
const pop = (p, cx, cy, inner) => p <= 0 ? '' : `<g opacity="${ease(p * 1.6).toFixed(3)}" transform="translate(${cx} ${cy}) scale(${(.82 + .18 * back(p)).toFixed(4)}) translate(${-cx} ${-cy})">${inner}</g>`;
// Arrive by rising into place.
const rise = (p, inner, d = 26) => p <= 0 ? '' : `<g opacity="${ease(p).toFixed(3)}" transform="translate(0 ${((1 - ease(p)) * d).toFixed(2)})">${inner}</g>`;

const R = `<line x1="43.5" y1="34" x2="43.5" y2="23" stroke="${CREAM}" stroke-width="5"/><circle cx="43.5" cy="19" r="5.5" fill="${CREAM}"/><rect x="36" y="32" width="15" height="66" fill="${CREAM}"/><path d="M43.5 39.5 H68 a18.5 18.5 0 0 1 0 37 H43.5" fill="none" stroke="${CREAM}" stroke-width="15"/><polygon points="56,76 77,76 99,98 78,98" fill="${CREAM}"/><circle cx="65" cy="58" r="6.5" fill="${INK}"/>`;
const face = (x, y, brand) => { const bar = (bx, by, w) => `<rect x="${bx}" y="${by}" width="${w}" height="8" rx="4"/>`;
  return brand ? `<svg x="${x}" y="${y}" width="76" height="76" viewBox="0 0 128 128"><rect width="128" height="128" rx="26" fill="${O}"/><path d="M0 26 A26 26 0 0 1 20 1 V127 A26 26 0 0 1 0 102 Z" fill="${SP}"/><g transform="translate(9 8.5) scale(.64)">${R}</g><g fill="${TI}">${bar(79, 29, 29)}${bar(79, 46, 29)}${bar(79, 63, 29)}${bar(32, 82, 76)}${bar(32, 97, 50)}</g></svg>`
    : `<rect x="${x}" y="${y}" width="76" height="76" rx="16" fill="#A8A297"/><circle cx="${x + 26}" cy="${y + 34}" r="6" fill="#ECE7DF"/><circle cx="${x + 50}" cy="${y + 34}" r="6" fill="#ECE7DF"/>`; };
// A bubble at row y. p brings it in; typed (0 to 1) is how much of your words have been typed.
function bubble(who, s, y, p, brand, typed = 1, opacity = 1) {
  if (p <= 0) return '';
  const size = 36, pad = 30, h = 76, x = who === 'you' ? 114 : 206, w = Math.round(s.length * size * .56) + pad * 2;
  const shown = s.slice(0, Math.ceil(s.length * clamp(typed)));
  return pop(p, x + 40, y + 38, `<g opacity="${opacity}" filter="url(#soft)">${who === 'you' ? '' : face(x - 92, y, brand)}<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="38" fill="${who === 'you' ? INK : '#FFFFFF'}"/>${txt(shown, x + pad, y + 50, size, who === 'you' ? CREAM : INK, 500)}</g>`);
}
// rows: [who, words, at]. A row with at < 0 is already there. Your words are typed as they arrive.
const talk = (rows, t, brand, y0 = 300) => rows.map(([who, s, at], i) => bubble(who, s, y0 + i * 92, at < 0 ? 1 : prog(t, at, .35), brand, who === 'you' && at >= 0 ? prog(t, at + .1, Math.min(.9, s.length * .035)) : 1)).join('');
const heading = (t, a, b, colour, size = 72, atB = .5, sizeB = size) => rise(prog(t, .1), txt(a, 110, 150, size, INK)) + (b ? rise(prog(t, atB), txt(b, 110, 150 + size * .2 + sizeB * .94, sizeB, colour)) : '');
const sticky = (s, x, y, rot, p) => { const w = Math.round(s.length * 21.5) + 64; return pop(p, x + w / 2, y + 46, `<g transform="rotate(${rot} ${x + w / 2} ${y + 46})" filter="url(#note)"><rect x="${x}" y="${y}" width="${w}" height="92" fill="#F6D7C3"/><rect x="${x}" y="${y}" width="${w}" height="16" fill="#EDC3A9"/>${txt(s, x + 32, y + 64, 38, INK)}</g>`); };

/* The page: pictures below, words above. */
const film = document.getElementById('film');
film.innerHTML = `<defs>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="${INK}" flood-opacity=".16"/></filter>
  <filter id="note" x="-10%" y="-20%" width="120%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="${INK}" flood-opacity=".22"/></filter>
  <clipPath id="clipA"><rect id="clipARect" x="0" y="0" width="1920" height="1080"/></clipPath>
  <clipPath id="clipB"><rect id="clipBRect" x="0" y="0" width="1920" height="1080"/></clipPath>
</defs><rect id="ground" width="1920" height="1080" fill="${CREAM}"/><g id="pics"></g><g id="words"></g><g id="marks"></g>`;
const pics = {}, words = document.getElementById('words'), ground = document.getElementById('ground');
for (const file of IMAGES) { const name = file.replace(/\.\w+$/, ''), el = document.createElementNS('http://www.w3.org/2000/svg', 'image');
  el.setAttribute('href', 'layers/' + file); el.setAttribute('opacity', 0);
  if (name.startsWith('mark-')) { document.getElementById('marks').appendChild(el); } else { el.setAttribute('width', 1920); el.setAttribute('height', 1080); document.getElementById('pics').appendChild(el); }
  pics[name] = el; }
window.__ready = Promise.all([document.fonts.ready, ...IMAGES.map((f) => { const i = new Image(); i.src = 'layers/' + f; return i.decode().catch(() => {}); })]);
// Show a picture: how visible, how far pushed in (about the tree), and an optional clip.
const CX = 1300, CY = 600;
function show(name, opacity = 1, scale = 1, clip = '') { const el = pics[name]; el.setAttribute('opacity', clamp(opacity).toFixed(3));
  el.setAttribute('transform', `translate(${CX} ${CY}) scale(${scale.toFixed(5)}) translate(${-CX} ${-CY})`);
  if (clip) el.setAttribute('clip-path', `url(#${clip})`); else el.removeAttribute('clip-path'); }
const clipRect = (id, x, y, w, h) => { const r = document.getElementById(id + 'Rect'); r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', Math.max(0, w)); r.setAttribute('height', Math.max(0, h)); };
const placeMark = (name, x, y, s, opacity) => { const el = pics['mark-' + name]; el.setAttribute('x', x); el.setAttribute('y', y); el.setAttribute('width', s); el.setAttribute('height', s); el.setAttribute('opacity', clamp(opacity).toFixed(3)); };
// The flag, on its pole: p raises it, and it moves in the wind for as long as it is up.
let NOW = 0;
function fly(p = 1, scale = PUSHED) { const el = pics.flag, a = 3.2 * Math.sin(NOW * 5.2) + 1.4 * Math.sin(NOW * 8.7), w = (.15 + .85 * back(p)) * (1 + .03 * Math.sin(NOW * 5.2 + 1));
  el.setAttribute('opacity', p > 0 ? 1 : 0);
  el.setAttribute('transform', `translate(${CX} ${CY}) scale(${scale.toFixed(5)}) translate(${-CX} ${-CY}) translate(1219 157) skewY(${a.toFixed(3)}) scale(${w.toFixed(4)} 1) translate(-1219 -157)`); }
const push = (t, dur) => 1 + .028 * (t / dur);   // a slow push-in over a beat
const PUSHED = 1.028;

/* One beat of the trouble half: what came back last time, then what comes back now, over the idea in blue. */
function trouble(t, dur, o) {
  ground.setAttribute('fill', ASH);
  if (o.prev) show(o.prev, 1, PUSHED);
  let covered = o.prev ? 1 : 0;
  if (o.pic) { const p = ease(prog(t, o.popAt, .55)); covered = Math.max(covered, p);   // what comes back wipes in from the left
    clipRect('clipA', 0, 0, 1920 * p, 1080); show(o.pic, p > 0 ? 1 : 0, push(Math.max(0, t - o.popAt), dur - o.popAt), 'clipA'); }
  // The idea is bright while it is alone, and steps back once something has been built over it.
  show('idea-blue', (o.ideaIn !== undefined ? ease(prog(t, o.ideaIn, .6)) : 1) * (.85 - .4 * covered));
  return heading(t, o.a, o.b, MUTED, o.size || 64, .5, o.sizeB) + (o.rows ? talk(o.rows, t, false) : '');
}

const BEATS = [
  { name: 'idea', dur: 2.4, draw: (t, d) => trouble(t + .6, d, { a: 'You have an idea.', ideaIn: 1.3, rows: [['you', 'Build me a treehouse.', .8]] }) },
  { name: 'literal', dur: 4, draw: (t, d) => trouble(t, d, { pic: 'literal', popAt: .5, a: 'Exactly what you said.', b: 'Not what you meant.', rows: [['you', 'Build me a treehouse.', -1], ['agent', 'Done! One treehouse.', .9], ['you', 'How do I get up?', 2.2]] }) },
  { name: 'drift', dur: 4.4, draw: (t, d) => trouble(t, d, { prev: 'literal', pic: 'pine', popAt: 1.2, a: 'You ask for one change.', b: 'Everything else changes too.', size: 56, rows: [['you', 'Add a ladder.', .2], ['agent', 'Added! Plus a few improvements.', 1.4], ['you', 'Why is it a pine tree?', 2.7]] }) },
  { name: 'bolted', dur: 3.6, draw: (t, d) => trouble(t, d, { prev: 'pine', pic: 'bolted', popAt: 1.1, a: 'You add what you forgot.', b: 'It gets bolted on.', rows: [['you', 'And a slide.', .2], ['agent', 'Added!', 1.3], ['you', 'That was the ladder.', 2.2]] }) },
  { name: 'rules', dur: 6.4, draw: (t, d) => trouble(t, d, { prev: 'bolted', a: 'So you write rules.', b: 'Now it asks about everything.', sizeB: 48 }) + sticky('KEEP THE TREE.', 150, 330, -4, prog(t, .5, .3)) + sticky('Ask before you change anything.', 130, 470, 2, prog(t, 1.1, .3))
      + bubble('agent', 'May I pick up the hammer?', 690, prog(t, 2.2, .3)) + bubble('agent', 'May I use the hammer?', 782, prog(t, 3.1, .3)) + bubble('agent', 'May I put the hammer down?', 874, prog(t, 4, .3))
      + `<rect width="1920" height="1080" fill="${INK}" opacity="${(.5 * ease(prog(t, d - .5, .5))).toFixed(3)}"/>` },
  // Night, then morning: the same mess, and an agent that remembers none of it.
  { name: 'morning', dur: 3.5, draw: (t, d) => trouble(t, d, { prev: 'bolted', a: 'The next morning,', b: 'a new session has to guess.', rows: [['agent', 'Hi! Nice slide tower.', .9], ['agent', 'Shall I remove the tree?', 1.8]] })
      + `<rect width="1920" height="1080" fill="${INK}" opacity="${(.5 * (1 - ease(prog(t, 0, .9)))).toFixed(3)}"/>` },
  { name: 'turn', dur: 2.6, draw: (t) => { ground.setAttribute('fill', ASH); show('bolted', 1, PUSHED); show('idea-blue', .8);
      const w = 1920 * ease(prog(t, 0, .45));
      return `<rect width="${w.toFixed(1)}" height="1080" fill="${O}"/><rect width="${Math.min(96, w).toFixed(1)}" height="1080" fill="${SP}"/>`
        + pop(prog(t, .25, .5), 1560, 520, `<circle cx="1560" cy="520" r="430" fill="#EB6A43" opacity=".55"/><g transform="translate(1166 196) scale(6.1)" filter="url(#soft)">${R}</g>`)
        + rise(prog(t, .35), txt('What you wanted', 190, 470, 118, CREAM), 40) + rise(prog(t, .95), txt('was a collaborator.', 190, 610, 118, TI), 40); } },
  { name: 'asks', dur: 6.2, draw: (t, d) => { ground.setAttribute('fill', CREAM);
      const built = prog(t, 3.9, .9), s = push(t, d);
      clipRect('clipA', 0, 1080 * (1 - ease(built)), 1920, 1080); show('before', built > 0 ? 1 : 0, s, 'clipA');
      show('idea-ink', .55 * ease(prog(t, 2.5, .5)) * (1 - ease(built)), s); show('idea-cream', .5 * ease(built) * (1 - ease(prog(t, 5, .8))), s);
      return `<rect width="1920" height="1080" fill="${O}" opacity="${(1 - ease(prog(t, 0, .4))).toFixed(3)}"/>` + heading(t, 'It asks before it builds.')
        + talk([['agent', 'Before I build: who is it for?', .4], ['you', 'My kids. They love to climb.', 1.3], ['agent', 'Here is a sketch. Is this it?', 2.4]], t, true)
        + pop(prog(t, 3.3, .35), 300, 620, `<g filter="url(#soft)"><rect x="206" y="582" width="230" height="76" rx="38" fill="${O}"/>${txt('Approved', 321, 632, 36, CREAM, 700, 'middle')}</g>`); } },
  { name: 'decision', dur: 3.4, draw: (t, d) => { ground.setAttribute('fill', CREAM); show('before', 1, PUSHED); fly(prog(t, 2.1, .5));
      const flag = (x, fill, at) => pop(prog(t, at, .35), x + 50, 560, `<line x1="${x}" y1="500" x2="${x}" y2="640" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M${x + 4} 504 C${x + 34} 492 ${x + 60} 520 ${x + 112} 502 L${x + 86} 530 L${x + 116} 556 C${x + 66} 552 ${x + 40} 574 ${x + 4} 558 Z" fill="${fill}"/>`);
      return heading(t, 'It asks you what only', 'you can decide.', INK, 64, .1) + talk([['agent', 'The flag: orange or violet?', .3], ['you', 'Orange.', 1.5]], t, true, 330)
        + flag(480, O, .7) + flag(660, P, .85) + `<rect x="452" y="474" width="172" height="186" rx="18" fill="none" stroke="${O}" stroke-width="7" opacity="${ease(prog(t, 1.8, .3)).toFixed(3)}"/>`; } },
  { name: 'record', dur: 4, draw: (t, d) => { ground.setAttribute('fill', CREAM); show('before', 1, PUSHED); fly();
      const row = (i, a, b) => rise(prog(t, 1 + i * .6, .35), `<circle cx="164" cy="${546 + i * 118}" r="10" fill="${O}"/>${txt(a, 194, 558 + i * 118, 38, INK)}${txt(b, 194, 602 + i * 118, 32, MUTED, 500)}`, 16);
      return heading(t, 'It writes down why.') + talk([['agent', 'Noted, so the next session knows too.', .3]], t, true)
        + pop(prog(t, .6, .4), 430, 570, `<g filter="url(#soft)"><rect x="114" y="410" width="640" height="340" rx="20" fill="#FFFFFF"/></g>${txt('Decisions', 150, 474, 38, INK)}`)
        + row(0, 'Flag: orange', 'Your choice.') + row(1, 'Ladder on the left', 'So the kids can climb up.'); } },
  { name: 'change', dur: 4.2, draw: (t, d) => { ground.setAttribute('fill', CREAM);
      const p = ease(prog(t, 1.2, .9)); show('before', 1, PUSHED); fly(); show('idea-cream-slide', .6 * ease(prog(t, .8, .3)) * (1 - ease(prog(t, 2.3, .6))), PUSHED);
      clipRect('clipB', 1200, 430, 720, 660 * p); show('after', p > 0 ? 1 : 0, PUSHED, 'clipB');
      return heading(t, 'A change is a change.', 'Not a restart.', SP, 72, 2.5) + talk([['you', 'Add a slide.', .3], ['agent', 'Added. Nothing else moved.', 2]], t, true); } },
  { name: 'village', dur: 3.3, draw: (t, d) => { ground.setAttribute('fill', CREAM); const p = ease(prog(t, 0, .7));
      show('after', 1, PUSHED); fly(); clipRect('clipA', 0, 1080 * (1 - p), 1920, 1080); show('village', p > 0 ? 1 : 0, 1, 'clipA');
      return rise(prog(t, .5), txt('Bigger projects. Longer projects.', 960, 84, 56, INK, 700, 'middle')) + rise(prog(t, 1.3), txt('Built the way you meant.', 960, 154, 56, SP, 700, 'middle')); } },
  { name: 'end', dur: 5.8, draw: (t, d) => { ground.setAttribute('fill', CREAM); const p = ease(prog(t, 0, .5)); show('village', 1 - p, 1);
      placeMark('rules-for-robots', 452, 150, 200, ease(prog(t, .3, .4))); ['engineering', 'creation', 'research'].forEach((m, i) => placeMark(m, 520 + i * 104, 640, 88, ease(prog(t, 2.2 + i * .12, .35))));
      return rise(prog(t, .3), txt('Rules for Robots', 690, 262, 110, INK) + txt('A practical guide for people and agents who work together', 694, 328, 34, SP, 500))
        + rise(prog(t, 1), txt('Rules and plugins for Claude Code.', 960, 456, 52, INK, 700, 'middle')) + rise(prog(t, 1.5), txt('They teach it what to ask you, and what to just do.', 960, 520, 40, INK, 500, 'middle'))
        + rise(prog(t, 2.4), txt('github.com/RulesForRobots', 860, 700, 44, INK, 700)) + rise(prog(t, 3.1), txt('(Yes, you may put the hammer down.)', 960, 880, 42, MUTED, 500, 'middle')); } },
];
let acc = 0; for (const b of BEATS) { b.start = acc; acc += b.dur; }
window.__total = acc; window.__beats = BEATS.map((b) => [b.name, b.start, b.dur]);
window.__seek = (t) => { t = clamp(t, 0, acc - .001); NOW = t;
  for (const el of Object.values(pics)) el.setAttribute('opacity', 0);
  const b = BEATS.filter((x) => t >= x.start).pop();
  words.innerHTML = b.draw(t - b.start, b.dur); };
window.__seek(0);

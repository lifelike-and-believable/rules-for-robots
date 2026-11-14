// Style frames for the Rules for Robots ad, as SVG strings. Run: node art.cjs  (writes style/*.svg)
// The pictures are the generated takes in takes/, read by kit.cjs. This file places them and adds the words.
const fs = require('fs');
const kit = require('./kit.cjs');

const CREAM = '#FFF4E6', INK = '#2A1A14', O = '#E4572E', SP = '#B8401D', TI = '#F9C9B2', B = '#2563C4', MUTED = '#6B665E';
const FONT = "'Space Grotesk','Segoe UI',system-ui,sans-serif";
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const txt = (s, x, y, size, fill, weight = 700, anchor = 'start', extra = '') =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" ${extra}>${esc(s)}</text>`;

// Colour is the promise; ash is the trouble.
const defs = (id) => `<defs>
  <filter id="ash${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values=".1"/><feColorMatrix values=".93 0 0 0 .05  0 .9 0 0 .05  0 0 .86 0 .05  0 0 0 1 0"/></filter>
  <filter id="grain${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .16  0 0 0 0 .1  0 0 0 0 .08  0 0 0 .55 -.12"/></filter>
  <filter id="soft${id}" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="${INK}" flood-opacity=".16"/></filter>
  <filter id="note${id}" x="-10%" y="-20%" width="120%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="${INK}" flood-opacity=".22"/></filter>
</defs>`;
const grain = (id) => `<rect width="1920" height="1080" filter="url(#grain${id})" opacity=".3" style="mix-blend-mode:multiply"/>`;

// A take is 2688 by 1536. Place it at a scale, anchored to the bottom right, on a cream ground.
const place = (inner, s = 1) => { const w = 1920 * s, h = 1097.2 * s; return `<svg x="${(1920 - w).toFixed(1)}" y="${(1080 - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="0 0 2688 1536">${inner}</svg>`; };
const picture = (takeDefs, inner, s, id, ash) => `${takeDefs}<g${ash ? ` filter="url(#ash${id})"` : ''}><rect width="1920" height="1080" fill="${CREAM}"/>${place(inner, s)}</g>`;
// The idea: vector B's outline, where the treehouse you meant would stand. It never changes.
const blueprint = (colour, withSlide, opacity = .9) => `<defs>${kit.masks}</defs>${place(`<g fill="none" stroke="${colour}" stroke-width="7" stroke-dasharray="22 16" stroke-linecap="round" opacity="${opacity}">${kit.outline(withSlide)}</g>`)}`;

// The brand mark and the robot R.
const R = (fill = CREAM, eye = INK) => `<line x1="43.5" y1="34" x2="43.5" y2="23" stroke="${fill}" stroke-width="5"/><circle cx="43.5" cy="19" r="5.5" fill="${fill}"/><rect x="36" y="32" width="15" height="66" fill="${fill}"/><path d="M43.5 39.5 H68 a18.5 18.5 0 0 1 0 37 H43.5" fill="none" stroke="${fill}" stroke-width="15"/><polygon points="56,76 77,76 99,98 78,98" fill="${fill}"/><circle cx="65" cy="58" r="6.5" fill="${eye}"/>`;
let uid = 0;
const mark = (x, y, s) => { const id = 'mk' + (uid++); const bar = (bx, by, w) => `<rect x="${bx}" y="${by}" width="${w}" height="8" rx="4"/>`;
  return `<svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 128 128"><clipPath id="${id}"><rect width="128" height="128" rx="26"/></clipPath><g clip-path="url(#${id})"><rect width="128" height="128" fill="${O}"/><rect width="20" height="128" fill="${SP}"/><g transform="translate(9 8.5) scale(.64)">${R()}</g><g fill="${TI}">${bar(79, 29, 29)}${bar(79, 46, 29)}${bar(79, 63, 29)}${bar(32, 82, 76)}${bar(32, 97, 50)}</g></g></svg>`; };

// Conversation bubbles. The agent has a grey face in the trouble half and the mark after the turn.
function bubble(who, s, x, y, id, opts = {}) {
  const size = 36, pad = 30, h = 76, w = Math.round(s.length * size * .56) + pad * 2;
  const face = who === 'you' ? '' : opts.brand ? mark(x - 92, y, 76) : `<rect x="${x - 92}" y="${y}" width="76" height="76" rx="16" fill="#A8A297"/><circle cx="${x - 66}" cy="${y + 34}" r="6" fill="#ECE7DF"/><circle cx="${x - 42}" cy="${y + 34}" r="6" fill="#ECE7DF"/>`;
  return `<g opacity="${opts.opacity || 1}" filter="url(#soft${id})">${face}<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="38" fill="${who === 'you' ? INK : '#FFFFFF'}"/>${txt(s, x + pad, y + 50, size, who === 'you' ? CREAM : INK, 500)}</g>`;
}
// A conversation down the left: [who, words] rows from y.
const talk = (rows, y, id, brand) => rows.map(([who, s], i) => bubble(who, s, who === 'you' ? 114 : 206, y + i * 92, id, { brand })).join('');
const sticky = (s, x, y, rot, id) => { const w = Math.round(s.length * 21.5) + 64; return `<g transform="rotate(${rot} ${x + w / 2} ${y + 46})" filter="url(#note${id})"><rect x="${x}" y="${y}" width="${w}" height="92" fill="#F6D7C3"/><rect x="${x}" y="${y}" width="${w}" height="16" fill="#EDC3A9"/>${txt(s, x + 32, y + 64, 38, INK)}</g>`; };
const frame = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">${body}</svg>\n`;
const heading = (a, b, colour, size = 72) => `${txt(a, 110, 150, size, INK)}${b ? txt(b, 110, 150 + size * 1.14, size, colour) : ''}`;

// One frame of the trouble half: a take in ash, the idea in blue, the words.
const trouble = (id, take, s, a, b, rows, size) => { const t = kit.scene(take);
  return frame(`${defs(id)}${picture(t.defs, t.body, s, id, true)}${blueprint(B, false, .8)}${heading(a, b, MUTED, size)}${talk(rows, 300, id)}${grain(id)}`); };

const frames = {
  // 1a. Literal: a box in a tree, and no way up.
  '1a-literal': () => trouble('a', 'scene-literal-b', 1, 'Exactly what you said.', 'Not what you meant.', [['you', 'Build me a treehouse.'], ['agent', 'Done! One treehouse.'], ['you', 'How do I get up?']]),
  // 1b. One change: a ladder, but now it is a pine tree and the house has moved.
  '1b-drift': () => trouble('b', 'scene-pine-a', 1, 'You ask for one change.', 'Everything else changes too.', [['you', 'Add a ladder.'], ['agent', 'Added! Plus a few improvements.'], ['you', 'Why is it a pine tree?']], 56),
  // 1c. An addition: the slide goes through the ladder.
  '1c-bolted': () => trouble('c', 'scene-bolted-a', 1, 'You add what you forgot.', 'It gets bolted on.', [['you', 'And a slide.'], ['agent', 'Added!'], ['you', 'That was the ladder.']]),
  // 1d. The worst of the trouble: rules, and questions about a hammer.
  '1d-rules': () => { const id = 'd', t = kit.scene('scene-bolted-a');
    return frame(`${defs(id)}${picture(t.defs, t.body, 1, id, true)}${blueprint(B, false, .8)}
    ${heading('So you write rules.', 'Now it asks about everything.', MUTED)}
    ${sticky('KEEP THE TREE.', 150, 320, -5, id)}${sticky('The house stays put.', 380, 440, 3, id)}${sticky('Ask before you change anything.', 130, 560, -2, id)}
    ${bubble('agent', 'May I pick up the hammer?', 206, 782, id, { opacity: .45 })}${bubble('agent', 'May I use the hammer?', 206, 868, id, { opacity: .7 })}${bubble('agent', 'May I put the hammer down?', 206, 954, id)}
    ${grain(id)}`); },
  // 2. The turn.
  '2-turn': () => { const id = 'e'; const bars = [[0, 700], [1, 520], [2, 640]].map(([i, w]) => `<rect x="190" y="${800 + i * 62}" width="${w}" height="26" rx="13" fill="${TI}" opacity=".32"/>`).join('');
    return frame(`${defs(id)}<rect width="1920" height="1080" fill="${O}"/><rect width="96" height="1080" fill="${SP}"/>
    <circle cx="1560" cy="520" r="430" fill="#EB6A43" opacity=".55"/>
    <g transform="translate(1166 196) scale(6.1)" filter="url(#soft${id})">${R()}</g>
    ${txt('What you wanted', 190, 470, 118, CREAM)}${txt('was a collaborator.', 190, 610, 118, TI)}${bars}
    ${grain(id)}`); },
  // 3a. It asks first, and what is built fits the idea.
  '3a-asks': () => { const id = 'f';
    return frame(`${defs(id)}${picture(kit.treehouse.defs, kit.treehouse.noSlide, 1, id)}${blueprint(CREAM, false, .75)}
    ${heading('It asks before it builds.')}${talk([['agent', 'Before I build: who is it for?'], ['you', 'My kids. They love to climb.'], ['agent', 'Here is a sketch. Is this it?']], 300, id, true)}`); },
  // 3b. The fit: a change that is only a change.
  '3b-change': () => { const id = 'g';
    return frame(`${defs(id)}${picture(kit.treehouse.defs, kit.treehouse.withSlide, 1, id)}${blueprint(CREAM, true, .75)}
    ${heading('A change is a change.', 'Not a restart.', SP)}${talk([['you', 'Add a slide.'], ['agent', 'Added. Nothing else moved.']], 300, id, true)}`); },
  // 4. The promise: one treehouse has become a village.
  '4-village': () => { const id = 'h', t = kit.village();
    return frame(`${defs(id)}${picture(t.defs, t.body, 1, id)}
    ${txt('Bigger projects. Longer projects.', 960, 92, 60, INK, 700, 'middle')}${txt('Built the way you meant.', 960, 168, 60, SP, 700, 'middle')}`); },
};

if (require.main === module) {
  fs.rmSync('style', { recursive: true, force: true }); fs.mkdirSync('style');
  for (const [name, make] of Object.entries(frames)) fs.writeFileSync(`style/${name}.svg`, make());
  console.log(Object.keys(frames).join(' '));
}
module.exports = { frames, defs, picture, blueprint, frame };

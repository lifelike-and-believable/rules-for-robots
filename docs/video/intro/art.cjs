// Style frames for the Rules for Robots ad, as SVG strings. Run: node art.cjs  (writes style/*.svg)
const fs = require('fs');

const CREAM = '#FFF4E6', INK = '#2A1A14', O = '#E4572E', SP = '#B8401D', TI = '#F9C9B2', B = '#2563C4', BD = '#1E4F9D', P = '#7A45C9', PD = '#6237A1', G = '#0E8A72', GD = '#0B6E5B', GL = '#2FA98C';
const FONT = "'Space Grotesk','Segoe UI',system-ui,sans-serif";
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const txt = (s, x, y, size, fill, weight = 700, anchor = 'start', extra = '') =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" ${extra}>${esc(s)}</text>`;

// Palettes for the world. Colour is the promise; ash is the trouble.
// The look, approved on 2026-11-14: the flat brand palette of take vector A, with the shapes of take vector B (see takes/).
const MINT = '#7CC7AE';
const COLOUR = { sky: CREAM, sun: O, hillFar: '#BFE3D3', hillNear: MINT, ground: GD, groundHi: G, tuft: '#17A084', bush: G, bushDark: INK, mark: MINT,
  leafBack: GD, leaf: G, leafHi: MINT, dark: INK, trunk: SP, trunkShade: INK, wood: SP, rail: TI, house: B, houseShade: BD, roof: P, roofShade: PD, glow: CREAM, glowShade: TI, flag: O, slide: O, slideHi: '#F28E68', slideSide: SP, ink: INK, petal: [CREAM, TI, CREAM], eye: O, dot: B };
const ASH = { sky: '#EFEBE5', sun: '#D2CCC2', hillFar: '#D5CFC6', hillNear: '#BDB7AD', ground: '#7C776E', groundHi: '#8D887F', tuft: '#9A958B', bush: '#8D887F', bushDark: '#56524B', mark: '#B0AAA0',
  leafBack: '#827D74', leaf: '#9A958B', leafHi: '#B0AAA0', dark: '#56524B', trunk: '#6B665E', trunkShade: '#56524B', wood: '#8F897F', rail: '#D5CFC6', house: '#CFC9BF', houseShade: '#B4AEA4', roof: '#827D74', roofShade: '#6B665E', glow: '#ECE7DF', glowShade: '#D5CFC6', flag: '#9A958B', slide: '#77726A', slideHi: '#8F897F', slideSide: '#5C5850', ink: '#56524B', petal: ['#ECE7DF', '#D5CFC6', '#ECE7DF'], eye: '#9A958B', dot: '#B0AAA0' };

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const n1 = (v) => Math.round(v * 10) / 10;

// A closed outline of round bumps around an ellipse: the shape of the foliage and the bushes.
function scallop(cx, cy, rx, ry, n, sd, jitter = .14) {
  seed = sd; const pts = [];
  for (let i = 0; i < n; i++) { const a = (i + (rnd() - .5) * jitter * 2) / n * Math.PI * 2 - Math.PI / 2, k = 1 + (rnd() - .5) * jitter; pts.push([cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)]); }
  let d = `M${n1(pts[0][0])} ${n1(pts[0][1])}`;
  for (let i = 1; i <= n; i++) { const p = pts[i % n], q = pts[i - 1], r = Math.hypot(p[0] - q[0], p[1] - q[1]) * .56; d += ` A${n1(r)} ${n1(r)} 0 0 1 ${n1(p[0])} ${n1(p[1])}`; }
  return d + ' Z';
}
// Clusters of short strokes, the printed texture.
function marks(cx, cy, w, h, n, colour, sd, len = 12) {
  seed = sd; let d = '';
  for (let i = 0; i < n; i++) { const x = cx + (rnd() - .5) * w, y = cy + (rnd() - .5) * h; d += `M${n1(x)} ${n1(y)} l${n1(len * .42)} ${n1(-len)} `; }
  return `<path d="${d}" fill="none" stroke="${colour}" stroke-width="4" stroke-linecap="round"/>`;
}
const daisy = (x, y, r, petal, eye) => { let p = ''; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 - Math.PI / 2; p += `<circle cx="${n1(x + Math.cos(a) * r * .78)}" cy="${n1(y + Math.sin(a) * r * .78)}" r="${n1(r * .56)}"/>`; }
  return `<g fill="${petal}">${p}</g><circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r * .42)}" fill="${eye}"/>`; };

const defs = (c, id) => `<defs>
  <filter id="grain${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .16  0 0 0 0 .1  0 0 0 0 .08  0 0 0 .55 -.12"/></filter>
  <filter id="soft${id}" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="${INK}" flood-opacity=".16"/></filter>
  <filter id="note${id}" x="-10%" y="-20%" width="120%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="${INK}" flood-opacity=".22"/></filter>
</defs>`;
const grain = (id) => `<rect width="1920" height="1080" filter="url(#grain${id})" opacity=".3" style="mix-blend-mode:multiply"/>`;

// The world: a flat sky, a big sun, two ranges of hills, bushes at the edges, and ground with sprigs and daisies.
function world(c, id, groundY = 960, sunX = 1640, sunY = 190) {
  const bushes = `<path d="${scallop(1850, groundY - 6, 150, 96, 11, 31)}" fill="${c.bush}"/>${marks(1830, groundY - 56, 150, 50, 12, c.mark, 32)}
  <path d="${scallop(1916, groundY + 4, 84, 64, 8, 33)}" fill="${c.bushDark}"/>${marks(1890, groundY - 22, 50, 30, 5, c.bush, 34)}
  <path d="${scallop(30, groundY + 2, 120, 74, 9, 35)}" fill="${c.hillNear}"/>${marks(40, groundY - 36, 90, 34, 7, c.sky, 36)}
  <path d="${scallop(-10, groundY + 14, 70, 50, 7, 37)}" fill="${c.bush}"/>`;
  seed = 11;
  let tufts = '', flowers = '';
  for (let i = 0; i < 22; i++) { const x = 20 + rnd() * 1880, y = groundY + 34 + rnd() * 70, h = 14 + rnd() * 10; tufts += `M${n1(x)} ${n1(y)} l${n1(-h * .5)} ${n1(-h)} M${n1(x)} ${n1(y)} l0 ${n1(-h * 1.2)} M${n1(x)} ${n1(y)} l${n1(h * .5)} ${n1(-h)} `; }
  for (let i = 0; i < 13; i++) { const x = 40 + rnd() * 1840, y = groundY + 30 + rnd() * 74, r = 9 + rnd() * 9; flowers += `<line x1="${n1(x)}" y1="${n1(y)}" x2="${n1(x)}" y2="${n1(y + r * 1.8)}" stroke="${c.groundHi}" stroke-width="4" stroke-linecap="round"/>` + daisy(x, y, r, c.petal[i % 3], c.eye); }
  for (let i = 0; i < 9; i++) { const x = 30 + rnd() * 1860, y = groundY + 26 + rnd() * 84; flowers += `<circle cx="${n1(x)}" cy="${n1(y)}" r="6" fill="${c.dot}"/><circle cx="${n1(x)}" cy="${n1(y)}" r="2.4" fill="${c.petal[0]}"/>`; }
  return `<rect width="1920" height="1080" fill="${c.sky}"/>
  <circle cx="${sunX}" cy="${sunY}" r="118" fill="${c.sun}"/>
  <path d="M0 ${groundY - 150} C260 ${groundY - 300} 520 ${groundY - 250} 760 ${groundY - 170} S1240 ${groundY - 330} 1520 ${groundY - 230} S1800 ${groundY - 200} 1920 ${groundY - 250} V1080 H0 Z" fill="${c.hillFar}"/>
  <path d="M0 ${groundY - 50} C300 ${groundY - 170} 620 ${groundY - 120} 900 ${groundY - 60} S1500 ${groundY - 190} 1920 ${groundY - 90} V1080 H0 Z" fill="${c.hillNear}"/>
  ${bushes}
  <path d="M0 ${groundY} C400 ${groundY - 26} 900 ${groundY + 14} 1300 ${groundY - 8} S1760 ${groundY - 20} 1920 ${groundY - 4} V1080 H0 Z" fill="${c.ground}"/>
  <path d="M0 ${groundY} C400 ${groundY - 26} 900 ${groundY + 14} 1300 ${groundY - 8} S1760 ${groundY - 20} 1920 ${groundY - 4} V${groundY + 14} C1700 ${groundY - 4} 1300 ${groundY + 10} 900 ${groundY + 30} S300 ${groundY - 8} 0 ${groundY + 18} Z" fill="${c.groundHi}"/>
  <path d="${tufts}" fill="none" stroke="${c.tuft}" stroke-width="4" stroke-linecap="round"/>${flowers}`;
}

// The treehouse as you meant it, on a 600 by 700 grid with the ground at y = 660.
const CANOPY = scallop(300, 200, 228, 186, 15, 5);
const SLIDE = 'M438 370 C548 362 520 500 566 574 C590 612 612 646 660 660';
const trunk = (c) => `<ellipse cx="330" cy="666" rx="240" ry="13" fill="${c.dark}" opacity=".3"/>
  <path d="M270 470 L196 396 M330 470 L404 396" stroke="${c.trunk}" stroke-width="18" stroke-linecap="round"/>
  <path d="M258 392 C262 470 262 540 250 600 Q240 640 204 664 H396 Q360 640 350 600 C338 540 338 470 342 392 Z" fill="${c.trunk}"/>
  <path d="M318 392 C316 480 320 560 330 610 Q346 648 396 664 Q360 640 350 600 C338 540 338 470 342 392 Z" fill="${c.trunkShade}"/>
  <path d="M268 520 q14 -11 28 0 M264 550 q17 -13 34 0 M268 580 q13 -9 26 0" fill="none" stroke="${c.trunkShade}" stroke-width="5" stroke-linecap="round"/>`;
const canopy = (c) => `<path d="${CANOPY}" fill="${c.leafBack}"/><path d="${scallop(252, 168, 168, 128, 11, 6)}" fill="${c.leaf}"/>
  ${marks(190, 96, 150, 70, 10, c.leafHi, 8)}${marks(118, 236, 60, 90, 6, c.leafHi, 9)}${marks(470, 150, 70, 110, 8, c.leaf, 10)}${marks(430, 60, 80, 40, 5, c.leaf, 12)}
  <path d="${scallop(300, 336, 178, 96, 12, 13)}" fill="${c.dark}"/>`;
const deck = (c) => { let l = ''; for (let x = 156; x < 424; x += 22) l += `<rect x="${x}" y="322" width="6" height="52" rx="3"/>`;
  return `<rect x="150" y="372" width="300" height="18" rx="4" fill="${c.wood}"/><g fill="${c.rail}">${l}<rect x="146" y="316" width="282" height="10" rx="5"/></g>`; };
const cabin = (c) => `<rect x="338" y="268" width="76" height="104" fill="${c.houseShade}"/><polygon points="222,372 222,268 280,196 338,268 338,372" fill="${c.house}"/>
  <polygon points="280,180 376,180 446,268 350,268" fill="${c.roofShade}"/><path d="M210 268 L280 180 L350 268" fill="none" stroke="${c.roof}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="280" cy="286" r="24" fill="${c.glow}"/><path d="M280 262 A24 24 0 0 1 280 310 A34 34 0 0 0 280 262 Z" fill="${c.glowShade}"/>
  <rect x="356" y="310" width="34" height="62" fill="${c.dark}"/>
  <line x1="304" y1="182" x2="304" y2="88" stroke="${c.ink}" stroke-width="6" stroke-linecap="round"/><path d="M307 92 C330 80 348 104 388 90 L366 112 L392 132 C352 128 334 148 307 134 Z" fill="${c.flag}"/>`;
const ladder = (c, x1 = 180, y1 = 328, x2 = 132, y2 = 662, w = 40, rungs = 9) => { let r = ''; for (let i = 1; i <= rungs; i++) { const t = i / (rungs + 1), x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t; r += `M${n1(x)} ${n1(y)} h${w} `; }
  return `<path d="M${x1} ${y1} L${x2} ${y2} M${x1 + w} ${y1} L${x2 + w} ${y2} ${r}" fill="none" stroke="${c.rail}" stroke-width="8" stroke-linecap="round"/>`; };
const ribbon = (c, d) => `<path d="${d}" fill="none" stroke="${c.slideSide}" stroke-width="60" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${c.slide}" stroke-width="38" stroke-linecap="round"/>`;
const slide = (c) => ribbon(c, SLIDE);
const treehouse = (c, withSlide) => `${canopy(c)}${trunk(c)}${cabin(c)}${deck(c)}${ladder(c)}${withSlide ? slide(c) : ''}`;

// The idea, as a blueprint outline on the same grid. It never changes.
const blueprint = (colour, withSlide, opacity = .9) => `<g fill="none" stroke="${colour}" stroke-width="4.5" stroke-dasharray="15 11" stroke-linecap="round" opacity="${opacity}">
  <path d="${CANOPY}"/>
  <path d="M258 392 C262 470 262 540 250 600 M342 392 C338 470 338 540 350 600"/><rect x="150" y="372" width="300" height="18"/><path d="M146 321 H428"/>
  <polygon points="222,372 222,268 280,196 338,268 338,372"/><path d="M338 268 H414 V372 M280 180 H376 L446 268 H350"/>
  <circle cx="280" cy="286" r="24"/><rect x="356" y="310" width="34" height="62"/><path d="M304 182 V88 M307 92 C330 80 348 104 388 90 L366 112 L392 132 C352 128 334 148 307 134"/>
  <path d="M180 328 L132 662 M220 328 L172 662 M168 412 h40 M156 496 h40 M144 580 h40"/>${withSlide ? `<path d="${SLIDE}"/>` : ''}</g>`;

// What came back in the trouble half: a pine, the house moved, and a slide through the ladder.
const wreck = (c) => `<ellipse cx="330" cy="666" rx="250" ry="13" fill="${c.dark}" opacity=".3"/>
  <rect x="276" y="520" width="48" height="144" fill="${c.trunk}"/><rect x="304" y="520" width="20" height="144" fill="${c.trunkShade}"/>
  <polygon points="300,20 190,210 410,210" fill="${c.leaf}"/><polygon points="300,20 410,210 300,210" fill="${c.leafBack}"/>
  <polygon points="300,130 150,370 450,370" fill="${c.leaf}"/><polygon points="300,130 450,370 300,370" fill="${c.leafBack}"/>
  <polygon points="300,270 110,560 490,560" fill="${c.leaf}"/><polygon points="300,270 490,560 300,560" fill="${c.leafBack}"/>
  ${marks(250, 150, 50, 60, 4, c.leafHi, 41)}${marks(220, 300, 80, 60, 6, c.leafHi, 42)}${marks(200, 480, 110, 70, 8, c.leafHi, 43)}
  <path d="M330 470 L402 432" stroke="${c.trunk}" stroke-width="14" stroke-linecap="round"/>
  <rect x="360" y="424" width="210" height="18" rx="4" fill="${c.wood}"/>
  <rect x="384" y="318" width="160" height="106" fill="${c.house}"/><rect x="518" y="318" width="26" height="106" fill="${c.houseShade}"/><rect x="368" y="298" width="192" height="22" rx="4" fill="${c.roof}"/>
  <rect x="424" y="346" width="44" height="44" fill="${c.glow}"/>
  ${ladder(c, 530, 444, 530, 506, 36, 1)}
  ${ribbon(c, 'M500 300 C640 300 668 500 650 650')}
  <g stroke="${c.rail}" stroke-width="8" stroke-linecap="round"><line x1="520" y1="560" x2="552" y2="640"/><line x1="470" y1="610" x2="530" y2="656"/><line x1="560" y1="520" x2="596" y2="548"/><line x1="486" y1="548" x2="512" y2="530"/><line x1="592" y1="600" x2="622" y2="660"/></g>`;

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
const sticky = (s, x, y, rot, id) => { const w = Math.round(s.length * 21.5) + 64; return `<g transform="rotate(${rot} ${x + w / 2} ${y + 46})" filter="url(#note${id})"><rect x="${x}" y="${y}" width="${w}" height="92" fill="#F6D7C3"/><rect x="${x}" y="${y}" width="${w}" height="16" fill="#EDC3A9"/>${txt(s, x + 32, y + 64, 38, INK)}</g>`; };
const frame = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">${body}</svg>\n`;
const TREE = 'translate(1010 150) scale(1.24)';

const frames = {
  // 1. The worst of the trouble.
  '1-trouble': () => { const c = ASH, id = 'a';
    return frame(`${defs(c, id)}${world(c, id)}
    <g transform="${TREE}">${wreck(c)}${blueprint(B, false, .85)}</g>
    <g transform="translate(1610 470) rotate(-28)" filter="url(#soft${id})"><rect x="-12" y="0" width="24" height="170" rx="8" fill="#8F897F"/><rect x="-62" y="-52" width="124" height="60" rx="10" fill="#56524B"/><rect x="-62" y="-52" width="34" height="60" rx="10" fill="#6B665E"/></g>
    <g stroke="#8F897F" stroke-width="6" stroke-linecap="round" fill="none"><path d="M1716 392 q26 16 30 46"/><path d="M1744 372 q36 22 42 62"/></g>
    ${txt('So you write rules.', 110, 190, 92, INK)}${txt('Now it asks about everything.', 110, 286, 64, '#6B665E', 700)}
    ${sticky('KEEP THE TREE.', 150, 380, -5, id)}${sticky('The house stays put.', 420, 500, 3, id)}${sticky('Ask before you change anything.', 130, 620, -2, id)}
    ${bubble('agent', 'May I pick up the hammer?', 206, 782, id, { opacity: .45 })}${bubble('agent', 'May I use the hammer?', 206, 868, id, { opacity: .7 })}${bubble('agent', 'May I put the hammer down?', 206, 954, id)}
    ${grain(id)}`); },
  // 2. The turn.
  '2-turn': () => { const id = 'b'; const bars = [[0, 700], [1, 520], [2, 640]].map(([i, w]) => `<rect x="190" y="${800 + i * 62}" width="${w}" height="26" rx="13" fill="${TI}" opacity=".32"/>`).join('');
    return frame(`${defs(COLOUR, id)}<rect width="1920" height="1080" fill="${O}"/><rect width="96" height="1080" fill="${SP}"/>
    <circle cx="1560" cy="520" r="430" fill="#EB6A43" opacity=".55"/>
    <g transform="translate(1166 196) scale(6.1)" filter="url(#soft${id})">${R()}</g>
    ${txt('What you wanted', 190, 470, 118, CREAM)}${txt('was a collaborator.', 190, 610, 118, TI)}${bars}
    ${grain(id)}`); },
  // 3. The fit: a change that is only a change.
  '3-fit': () => { const c = COLOUR, id = 'c';
    return frame(`${defs(c, id)}${world(c, id)}
    <g transform="${TREE}">${treehouse(c, true)}${blueprint(CREAM, true, .7)}</g>
    <g stroke="${CREAM}" stroke-width="7" stroke-linecap="round"><path d="M1770 560 l34 -22 M1786 620 l42 -4 M1740 510 l18 -36"/></g>
    ${txt('A change is a change.', 110, 190, 92, INK)}${txt('Not a restart.', 110, 286, 92, SP)}
    ${bubble('you', 'Add a slide.', 114, 420, id)}${bubble('agent', 'Added. Nothing else moved.', 206, 520, id, { brand: true })}
    ${grain(id)}`); },
  // 4. The promise: one treehouse has become a village.
  '4-village': () => { const c = COLOUR, id = 'd';
    const spots = [[50, 470, .7, B, BD, P, PD, O], [400, 392, .82, O, SP, B, BD, P], [810, 452, .74, P, PD, O, SP, O], [1150, 380, .84, B, BD, O, SP, P], [1440, 474, .66, O, SP, P, PD, B]];
    const pal = ([, , , house, houseShade, roof, roofShade, flag]) => ({ ...c, house, houseShade, roof, roofShade, flag });
    const edge = ([x, y, s], right) => [x + (right ? 450 : 150) * s, y + 381 * s];
    let bridges = '';
    for (let i = 0; i < spots.length - 1; i++) { const [x1, y1] = edge(spots[i], true), [x2, y2] = edge(spots[i + 1], false), mx = (x1 + x2) / 2, my = Math.max(y1, y2) + 46;
      bridges += `<path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" fill="none" stroke="${c.wood}" stroke-width="13" stroke-linecap="round"/><path d="M${x1} ${y1 - 38} Q${mx} ${my - 32} ${x2} ${y2 - 38}" fill="none" stroke="${c.rail}" stroke-width="6" stroke-linecap="round"/><path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" fill="none" stroke="${c.rail}" stroke-width="13" stroke-dasharray="5 16"/>`; }
    const trees = spots.map((sp, i) => `<g transform="translate(${sp[0]} ${sp[1]}) scale(${sp[2]})">${treehouse(pal(sp), i === 4)}</g>`).join('');
    const birds = [[360, 330], [430, 296], [1480, 300], [1410, 338]].map(([x, y]) => `<path d="M${x - 16} ${y} q8 -12 16 0 q8 -12 16 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`).join('');
    return frame(`${defs(c, id)}${world(c, id, 940, 1700, 170)}${birds}${trees.slice(0)}${bridges}
    ${txt('Bigger projects. Longer projects.', 960, 130, 72, INK, 700, 'middle')}${txt('Built the way you meant.', 960, 222, 72, SP, 700, 'middle')}
    ${grain(id)}`); },
};

if (require.main === module) {
  fs.mkdirSync('style', { recursive: true });
  for (const [name, make] of Object.entries(frames)) fs.writeFileSync(`style/${name}.svg`, make());
  console.log(Object.keys(frames).join(' '));
}
module.exports = { frames };

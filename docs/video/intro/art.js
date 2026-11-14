// Style frames for the Rules for Robots ad, as SVG strings. Run: node art.js  (writes style/*.svg)
const fs = require('fs');

const CREAM = '#FFF4E6', INK = '#2A1A14', O = '#E4572E', SP = '#B8401D', TI = '#F9C9B2', B = '#2563C4', BD = '#1E4F9D', P = '#7A45C9', PD = '#6237A1', G = '#0E8A72', GD = '#0B6E5B', GL = '#2FA98C';
const FONT = "'Space Grotesk','Segoe UI',system-ui,sans-serif";
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const txt = (s, x, y, size, fill, weight = 700, anchor = 'start', extra = '') =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" ${extra}>${esc(s)}</text>`;

// Palettes for the world. Colour is the promise; ash is the trouble.
const COLOUR = { skyTop: '#FFF4E6', skyBot: '#FCE2CC', sun: O, sunGlow: '#FFD3B5', hillFar: '#BFE3D3', hillNear: '#7CC7AE', ground: GD, groundHi: G, tuft: '#17A084',
  leafBack: GD, leaf: G, leafHi: GL, trunk: '#7A4A35', trunkShade: '#5E3626', wood: '#C8693A', woodShade: '#9E4A26', house: B, houseShade: BD, roof: P, roofShade: PD, glow: '#FFE2A8', flag: O, slide: O, slideHi: '#F28E68', ink: INK, flower: [O, P, CREAM] };
const ASH = { skyTop: '#EFEBE5', skyBot: '#E2DCD3', sun: '#D2CCC2', sunGlow: '#E6E0D7', hillFar: '#D5CFC6', hillNear: '#BDB7AD', ground: '#7C776E', groundHi: '#8D887F', tuft: '#9A958B',
  leafBack: '#827D74', leaf: '#9A958B', leafHi: '#B0AAA0', trunk: '#6B665E', trunkShade: '#56524B', wood: '#8F897F', woodShade: '#716C64', house: '#CFC9BF', houseShade: '#B4AEA4', roof: '#6B665E', roofShade: '#56524B', glow: '#ECE7DF', flag: '#9A958B', slide: '#5C5850', slideHi: '#77726A', ink: '#56524B', flower: ['#B0AAA0', '#9A958B', '#ECE7DF'] };

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

const defs = (c, id) => `<defs>
  <linearGradient id="sky${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.skyTop}"/><stop offset="1" stop-color="${c.skyBot}"/></linearGradient>
  <radialGradient id="glow${id}"><stop offset="0" stop-color="${c.sunGlow}" stop-opacity=".9"/><stop offset="1" stop-color="${c.sunGlow}" stop-opacity="0"/></radialGradient>
  <filter id="grain${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .16  0 0 0 0 .1  0 0 0 0 .08  0 0 0 .55 -.12"/></filter>
  <filter id="soft${id}" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="${INK}" flood-opacity=".16"/></filter>
  <filter id="note${id}" x="-10%" y="-20%" width="120%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="${INK}" flood-opacity=".22"/></filter>
</defs>`;
const grain = (id) => `<rect width="1920" height="1080" filter="url(#grain${id})" opacity=".5" style="mix-blend-mode:multiply"/>`;

// The world: sky, sun, two ranges of hills, ground with tufts and flowers.
function world(c, id, groundY = 960, sunX = 1640, sunY = 190) {
  seed = 11;
  let tufts = '', flowers = '';
  for (let i = 0; i < 46; i++) { const x = 20 + rnd() * 1880, y = groundY + 6 + rnd() * 26, h = 12 + rnd() * 14; tufts += `<path d="M${x - 7} ${y} L${x - 3} ${y - h} L${x} ${y} L${x + 4} ${y - h * 1.2} L${x + 8} ${y} Z" fill="${c.tuft}"/>`; }
  for (let i = 0; i < 16; i++) { const x = 40 + rnd() * 1840, y = groundY + 22 + rnd() * 70; flowers += `<circle cx="${x}" cy="${y}" r="${5 + rnd() * 3}" fill="${c.flower[i % 3]}"/>`; }
  return `<rect width="1920" height="1080" fill="url(#sky${id})"/>
  <circle cx="${sunX}" cy="${sunY}" r="210" fill="url(#glow${id})"/><circle cx="${sunX}" cy="${sunY}" r="74" fill="${c.sun}"/>
  <path d="M0 ${groundY - 150} C260 ${groundY - 300} 520 ${groundY - 250} 760 ${groundY - 170} S1240 ${groundY - 330} 1520 ${groundY - 230} S1800 ${groundY - 200} 1920 ${groundY - 250} V1080 H0 Z" fill="${c.hillFar}"/>
  <path d="M0 ${groundY - 50} C300 ${groundY - 170} 620 ${groundY - 120} 900 ${groundY - 60} S1500 ${groundY - 190} 1920 ${groundY - 90} V1080 H0 Z" fill="${c.hillNear}"/>
  <path d="M0 ${groundY} C400 ${groundY - 26} 900 ${groundY + 14} 1300 ${groundY - 8} S1760 ${groundY - 20} 1920 ${groundY - 4} V1080 H0 Z" fill="${c.ground}"/>
  <path d="M0 ${groundY} C400 ${groundY - 26} 900 ${groundY + 14} 1300 ${groundY - 8} S1760 ${groundY - 20} 1920 ${groundY - 4} V${groundY + 14} C1700 ${groundY - 4} 1300 ${groundY + 10} 900 ${groundY + 30} S300 ${groundY - 8} 0 ${groundY + 18} Z" fill="${c.groundHi}"/>
  ${tufts}${flowers}`;
}

// The treehouse as you meant it, on a 600 by 700 grid with the ground at y = 660.
const trunk = (c) => `<ellipse cx="300" cy="664" rx="190" ry="16" fill="${INK}" opacity=".14"/>
  <path d="M262 380 C268 470 272 560 266 648 Q250 652 232 664 H368 Q350 652 334 648 C328 560 332 470 338 380 Z" fill="${c.trunk}"/>
  <path d="M316 380 C312 470 312 560 314 664 H368 Q350 652 334 648 C328 560 332 470 338 380 Z" fill="${c.trunkShade}"/>
  <path d="M278 452 L204 384 M322 452 L396 384" stroke="${c.trunk}" stroke-width="16" stroke-linecap="round"/>`;
const canopy = (c) => `<circle cx="300" cy="150" r="152" fill="${c.leafBack}"/><circle cx="168" cy="232" r="108" fill="${c.leafBack}"/><circle cx="432" cy="232" r="108" fill="${c.leafBack}"/><circle cx="222" cy="92" r="88" fill="${c.leafBack}"/><circle cx="384" cy="96" r="90" fill="${c.leafBack}"/>
  <circle cx="296" cy="172" r="134" fill="${c.leaf}"/><circle cx="182" cy="246" r="88" fill="${c.leaf}"/><circle cx="416" cy="248" r="88" fill="${c.leaf}"/><circle cx="232" cy="108" r="70" fill="${c.leaf}"/>
  <circle cx="246" cy="112" r="50" fill="${c.leafHi}"/><circle cx="158" cy="218" r="34" fill="${c.leafHi}"/><circle cx="372" cy="128" r="30" fill="${c.leafHi}"/><circle cx="318" cy="70" r="20" fill="${c.leafHi}"/>`;
const deck = (c) => { let l = ''; for (let x = 196; x < 430; x += 26) l += `<line x1="${x}" y1="372" x2="${x}" y2="386" stroke="${c.woodShade}" stroke-width="2" opacity=".6"/>`;
  return `<rect x="170" y="372" width="260" height="20" rx="3" fill="${c.wood}"/><rect x="170" y="386" width="260" height="6" rx="3" fill="${c.woodShade}"/>${l}
  <g fill="${c.wood}"><rect x="176" y="336" width="7" height="38"/><rect x="198" y="336" width="7" height="38"/><rect x="395" y="336" width="7" height="38"/><rect x="417" y="336" width="7" height="38"/><rect x="172" y="334" width="50" height="7" rx="3"/><rect x="378" y="334" width="50" height="7" rx="3"/></g>`; };
const cabin = (c) => { let l = ''; for (let x = 244; x < 378; x += 22) l += `<line x1="${x}" y1="258" x2="${x}" y2="372" stroke="${c.houseShade}" stroke-width="2.5" opacity=".7"/>`;
  return `<rect x="222" y="250" width="156" height="122" fill="${c.house}"/><rect x="352" y="250" width="26" height="122" fill="${c.houseShade}"/>${l}
  <polygon points="196,258 300,166 404,258" fill="${c.roof}"/><polygon points="300,166 404,258 372,258 300,196" fill="${c.roofShade}"/><polygon points="196,258 404,258 396,268 204,268" fill="${c.roofShade}"/>
  <circle cx="268" cy="306" r="26" fill="${c.glow}" stroke="${CREAM}" stroke-width="7"/><path d="M268 280 V332 M242 306 H294" stroke="${c.houseShade}" stroke-width="4"/>
  <rect x="318" y="312" width="36" height="60" rx="4" fill="${c.houseShade}"/><circle cx="346" cy="344" r="3.5" fill="${CREAM}"/>
  <line x1="300" y1="168" x2="300" y2="104" stroke="${c.ink}" stroke-width="5" stroke-linecap="round"/><path d="M300 106 Q326 96 348 112 Q326 124 300 136 Z" fill="${c.flag}"/>`; };
const ladder = (c, x = 184, y1 = 392, y2 = 658) => { let r = ''; for (let y = y1 + 22; y < y2 - 6; y += 30) r += `<line x1="${x}" y1="${y}" x2="${x + 34}" y2="${y}"/>`;
  return `<g stroke="${c.wood}" stroke-width="7" stroke-linecap="round"><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/><line x1="${x + 34}" y1="${y1}" x2="${x + 34}" y2="${y2}"/><g stroke-width="6">${r}</g></g>`; };
const slide = (c) => `<path d="M426 378 C500 384 546 520 572 646" fill="none" stroke="${c.slide}" stroke-width="34" stroke-linecap="round"/><path d="M430 372 C504 378 552 512 580 640" fill="none" stroke="${c.slideHi}" stroke-width="7" stroke-linecap="round"/><ellipse cx="584" cy="660" rx="44" ry="7" fill="${INK}" opacity=".12"/>`;
const treehouse = (c, withSlide) => `${canopy(c)}${trunk(c)}${deck(c)}${cabin(c)}${ladder(c)}${withSlide ? slide(c) : ''}`;

// The idea, as a blueprint outline on the same grid. It never changes.
const blueprint = (colour, withSlide, opacity = .9) => `<g fill="none" stroke="${colour}" stroke-width="4.5" stroke-dasharray="15 11" stroke-linecap="round" opacity="${opacity}">
  <path d="M112 300 A108 108 0 0 1 148 124 A152 152 0 0 1 452 124 A108 108 0 0 1 488 300"/>
  <path d="M266 392 V648 M334 392 V648"/><rect x="170" y="372" width="260" height="20"/><rect x="222" y="258" width="156" height="114"/><polygon points="196,258 300,166 404,258"/>
  <circle cx="268" cy="306" r="26"/><rect x="318" y="312" width="36" height="60"/><path d="M300 166 V104 M300 106 Q326 96 348 112 Q326 124 300 136"/>
  <path d="M184 392 V658 M218 392 V658 M184 444 H218 M184 504 H218 M184 564 H218 M184 624 H218"/>${withSlide ? '<path d="M426 378 C500 384 546 520 572 646"/>' : ''}</g>`;

// What came back in the trouble half: a pine, the house moved, and a slide through the ladder.
const wreck = (c) => `<ellipse cx="300" cy="664" rx="200" ry="16" fill="${INK}" opacity=".12"/>
  <rect x="276" y="520" width="48" height="144" fill="${c.trunk}"/><rect x="304" y="520" width="20" height="144" fill="${c.trunkShade}"/>
  <polygon points="300,20 190,210 410,210" fill="${c.leaf}"/><polygon points="300,20 410,210 300,210" fill="${c.leafBack}"/>
  <polygon points="300,130 150,370 450,370" fill="${c.leaf}"/><polygon points="300,130 450,370 300,370" fill="${c.leafBack}"/>
  <polygon points="300,270 110,560 490,560" fill="${c.leaf}"/><polygon points="300,270 490,560 300,560" fill="${c.leafBack}"/>
  <path d="M330 470 L402 432" stroke="${c.trunk}" stroke-width="14" stroke-linecap="round"/>
  <rect x="360" y="424" width="210" height="18" rx="3" fill="${c.wood}"/><rect x="360" y="436" width="210" height="6" rx="3" fill="${c.woodShade}"/>
  <rect x="384" y="318" width="160" height="106" fill="${c.house}"/><rect x="518" y="318" width="26" height="106" fill="${c.houseShade}"/><rect x="368" y="298" width="192" height="22" rx="3" fill="${c.roof}"/>
  <rect x="424" y="346" width="44" height="44" fill="${c.glow}" stroke="${CREAM}" stroke-width="6"/>
  ${ladder(c, 536, 442, 500)}
  <path d="M500 300 C640 300 668 500 650 650" fill="none" stroke="${c.slide}" stroke-width="36" stroke-linecap="round"/><path d="M506 292 C650 294 680 496 660 644" fill="none" stroke="${c.slideHi}" stroke-width="7" stroke-linecap="round"/>
  <g stroke="${c.wood}" stroke-width="7" stroke-linecap="round"><line x1="520" y1="560" x2="552" y2="640"/><line x1="470" y1="610" x2="530" y2="656"/><line x1="560" y1="520" x2="596" y2="548"/><line x1="486" y1="548" x2="512" y2="530"/><line x1="592" y1="600" x2="622" y2="660"/></g>
  <g fill="${c.leafHi}"><circle cx="604" cy="508" r="13"/><circle cx="628" cy="486" r="8"/><circle cx="574" cy="486" r="7"/></g>`;

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
    const spots = [[90, 470, .7, B, BD, P, PD, O], [470, 392, .82, O, SP, B, BD, P], [900, 452, .74, P, PD, O, SP, O], [1260, 380, .84, B, BD, O, SP, P], [1620, 474, .68, O, SP, P, PD, B]];
    const pal = ([, , , house, houseShade, roof, roofShade, flag]) => ({ ...c, house, houseShade, roof, roofShade, flag });
    const edge = ([x, y, s], right) => [x + (right ? 430 : 170) * s, y + 382 * s];
    let bridges = '';
    for (let i = 0; i < spots.length - 1; i++) { const [x1, y1] = edge(spots[i], true), [x2, y2] = edge(spots[i + 1], false), mx = (x1 + x2) / 2, my = Math.max(y1, y2) + 46;
      bridges += `<path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" fill="none" stroke="${c.woodShade}" stroke-width="12" stroke-linecap="round"/><path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" fill="none" stroke="${c.wood}" stroke-width="12" stroke-dasharray="6 9"/><path d="M${x1} ${y1 - 36} Q${mx} ${my - 30} ${x2} ${y2 - 36}" fill="none" stroke="${c.trunkShade}" stroke-width="3.5"/>`; }
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

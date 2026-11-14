// The film's pictures, from the generated takes in takes/. Used by art.cjs.
// A take is a flat stack of tiles over base shapes, with no groups. A part is removed by repainting what lies
// behind its footprint and drawing every other tile again on top.
const fs = require('fs');
const path = require('path');

const INK = 'rgb(42,26,20)', PEACH = 'rgb(249,201,178)', O = 'rgb(228,87,46)', G = 'rgb(14,138,114)', G2 = 'rgb(84,174,137)', SP = 'rgb(184,64,29)', CREAM = 'rgb(255,244,230)';

// Read a take: its paths in order, and its defs with ids made unique to the take.
function load(name) {
  const src = fs.readFileSync(path.join(__dirname, 'takes', name + '.svg'), 'utf8').replace(/<metadata>[\s\S]*?<\/metadata>/, '');
  const tag = name.replace(/[^a-z0-9]/gi, '');
  const unique = (s) => s.replace(/id="Gradient(\d+)"/g, `id="${tag}G$1"`).replace(/url\(#Gradient(\d+)\)/g, `url(#${tag}G$1)`);
  const paths = [...src.matchAll(/<path[^>]*\/>/g)].map((m) => unique(m[0]));
  const defs = unique((src.match(/<defs>[\s\S]*?<\/defs>/) || [''])[0]);
  return { paths, defs, d: (i) => paths[i].match(/ d="([^"]+)"/)[1] };
}
// Where a path starts, as a cheap stand-in for where it is.
const start = (p) => { const m = p.match(/ d="M\s*([\d.-]+)[ ,]([\d.-]+)/); return m ? [+m[1], +m[2]] : [0, 0]; };

// Take vector B: the treehouse as you meant it. Tiles 137 to 145 are its slide and 189 is the slide's shadow.
const b = load('vector-b');
const SLIDE = [137, 138, 139, 140, 141, 142, 144, 145], SHADOW = [189];
const zone = (fg) => `<g fill="${fg}" stroke="${fg}" stroke-width="110" stroke-linejoin="round">${SLIDE.map((i) => `<path d="${b.d(i)}"/>`).join('')}</g>`;
const masks = `<mask id="inZone" maskUnits="userSpaceOnUse" x="0" y="0" width="2688" height="1536">${zone('#fff')}</mask><mask id="outZone" maskUnits="userSpaceOnUse" x="0" y="0" width="2688" height="1536"><rect width="2688" height="1536" fill="#fff"/>${zone('#000')}</mask>`;
// What lies behind the slide: sky, the hill, the dark of the foliage, the railing, the grass, and the foot of the trunk.
const behind = `<g mask="url(#inZone)"><rect width="2688" height="1536" fill="${CREAM}"/>
  <path d="M1860 1300 C1900 1180 2000 1130 2090 1195 C2200 1215 2330 1180 2470 1100 L2470 1536 L1860 1536 Z" fill="${G2}"/>
  <g fill="${INK}"><circle cx="2010" cy="940" r="130"/><circle cx="2160" cy="905" r="135"/><circle cx="2290" cy="850" r="115"/><circle cx="2235" cy="900" r="125"/><rect x="1990" y="730" width="330" height="160"/></g>
  <g fill="${PEACH}"><rect x="2043" y="737" width="16" height="125"/><rect x="2113" y="737" width="15" height="125"/><rect x="2183" y="737" width="17" height="125"/></g>
  <rect x="1890" y="856" width="345" height="28" rx="12" fill="${O}"/>
  <path d="M1690 1296 L1900 1340 L2120 1340 L2440 1240 L2440 1536 L1690 1536 Z" fill="${G}"/>
  <path d="M1730 1150 L1899 1150 C1900 1260 1912 1340 1968 1412 C1900 1400 1820 1404 1730 1420 Z" fill="${SP}"/></g>`;
const front = `<rect x="2059" y="748" width="54" height="110" fill="${INK}"/><rect x="2043" y="737" width="16" height="125" fill="${PEACH}"/><rect x="1890" y="856" width="345" height="28" rx="12" fill="${O}"/>`;
const tiles = b.paths.map((p, i) => (i < 2 || SLIDE.includes(i) ? '' : SHADOW.includes(i) ? p.replace(/fill="[^"]+"/, `fill="${G}"`) : p)).join('\n');

const treehouse = {
  defs: `${b.defs}<defs>${masks}</defs>`,
  withSlide: b.paths.join('\n'),
  noSlide: `${b.paths[0]}<g mask="url(#outZone)">${b.paths[1]}</g>${behind}${tiles}${front}`,
};

// The idea, as an outline of vector B. Its foliage, cabin, roof, flag and slide are traced from the take's own tiles.
// Its railing, ladder and trunk are drawn here over the take, because the tiles for those are merged with their surroundings.
const first = (i) => b.d(i).split(/(?=M)/)[0];
const rungs = [1, 2, 3, 4, 5, 6, 7].map((i) => { const t = i / 8; return `M${(1428 - 161 * t).toFixed(0)} ${(767 + 672 * t).toFixed(0)} l147 7`; }).join(' ');
const drawn = `<path d="M1244 711 H2235 V884 H1244 Z M1400 737 V860 M1560 737 V860 M1720 737 V860 M1880 737 V860 M2040 737 V860"/>
  <path d="M1428 767 L1267 1439 M1575 774 L1414 1446 ${rungs}"/>
  <path d="M1700 884 L1612 1010 L1700 1110 C1700 1250 1680 1330 1600 1402 M1890 1030 C1895 1200 1900 1330 1945 1405"/>`;
const outline = (withSlide) => [323, 357, 370, 391, 390].map((i) => `<path d="${first(i)}"/>`).join('') + drawn
  + (withSlide ? [137, 141].map((i) => `<path d="${first(i)}"/>`).join('') : '');

// Any other take, whole, with the tiles that start inside the given circles left out (to clear room for words).
function scene(name, without = []) {
  const t = load(name);
  const keep = (p, i) => i === 0 || !without.some(([cx, cy, r]) => { const [x, y] = start(p); return Math.hypot(x - cx, y - cy) < r; });
  return { defs: t.defs, body: t.paths.filter(keep).join('\n') };
}

module.exports = { treehouse, outline, scene, masks };

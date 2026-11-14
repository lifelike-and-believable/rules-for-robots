// Take vector B as the film's artwork. The take is a flat stack of tiles over one base shape, so a part is removed by
// repainting what lies behind its footprint and drawing every other tile again on top. Used by art.cjs.
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, 'takes', 'vector-b.svg'), 'utf8').replace(/<metadata>[\s\S]*?<\/metadata>/, '');
const paths = [...src.matchAll(/<path[^>]*\/>/g)].map(m => m[0]);
const defs = src.match(/<defs>[\s\S]*?<\/defs>/)[0];
const d = i => paths[i].match(/ d="([^"]+)"/)[1];
const SLIDE = [137, 138, 139, 140, 141, 142, 144, 145], SHADOW = [189];
const zone = (fg) => `<g fill="${fg}" stroke="${fg}" stroke-width="110" stroke-linejoin="round">${SLIDE.map(i => `<path d="${d(i)}"/>`).join('')}</g>`;
const masks = `<mask id="inZone" maskUnits="userSpaceOnUse" x="0" y="0" width="2688" height="1536">${zone('#fff')}</mask><mask id="outZone" maskUnits="userSpaceOnUse" x="0" y="0" width="2688" height="1536"><rect width="2688" height="1536" fill="#fff"/>${zone('#000')}</mask>`;
const INK = 'rgb(42,26,20)', PEACH = 'rgb(249,201,178)', O = 'rgb(228,87,46)', G = 'rgb(14,138,114)', G2 = 'rgb(84,174,137)', SP = 'rgb(184,64,29)', CREAM = 'rgb(255,244,230)';
const behind = `<g mask="url(#inZone)"><rect width="2688" height="1536" fill="${CREAM}"/>
  <path d="M1860 1300 C1900 1180 2000 1130 2090 1195 C2200 1215 2330 1180 2470 1100 L2470 1536 L1860 1536 Z" fill="${G2}"/>
  <g fill="${INK}"><circle cx="2010" cy="940" r="130"/><circle cx="2160" cy="905" r="135"/><circle cx="2290" cy="850" r="115"/><circle cx="2235" cy="900" r="125"/><rect x="1990" y="730" width="330" height="160"/></g>
  <g fill="${PEACH}"><rect x="2043" y="737" width="16" height="125"/><rect x="2113" y="737" width="15" height="125"/><rect x="2183" y="737" width="17" height="125"/></g>
  <rect x="1890" y="856" width="345" height="28" rx="12" fill="${O}"/>
  <path d="M1690 1296 L1900 1340 L2120 1340 L2440 1240 L2440 1536 L1690 1536 Z" fill="${G}"/>
  <path d="M1730 1150 L1899 1150 C1900 1260 1912 1340 1968 1412 C1900 1400 1820 1404 1730 1420 Z" fill="${SP}"/></g>`;
const front = `<rect x="2059" y="748" width="54" height="110" fill="${INK}"/><rect x="2043" y="737" width="16" height="125" fill="${PEACH}"/><rect x="1890" y="856" width="345" height="28" rx="12" fill="${O}"/>`;
const tiles = (skip) => paths.map((p, i) => i < 2 || skip.includes(i) ? '' : SHADOW.includes(i) && skip.length ? p.replace(/fill="[^"]+"/, `fill="${G}"`) : p).join('\n');
const noSlide = `${paths[0]}<g mask="url(#outZone)">${paths[1]}</g>${behind}${tiles(SLIDE)}${front}`;
const withSlide = paths.join('\n');
module.exports = { defs: `${defs}<defs>${masks}</defs>`, noSlide, withSlide, d, paths };

// Writes every SVG of the brand from tokens.json and wordmarks.json.
// Run: node docs/brand/build.mjs   (then node docs/brand/render.mjs for the PNG files)
// It needs nothing installed. The names are stored as outlines in wordmarks.json,
// so no file here depends on a font.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(join(here, name), 'utf8'));
const tokens = read('tokens.json');
const words = read('wordmarks.json').strings;
const { cream, ink } = tokens.shared;

// The mark is drawn on a 128 by 128 grid.
const bar = (x, y, w) => `<rect x="${x}" y="${y}" width="${w}" height="8" rx="4"/>`;
const stroke = (c, w) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const foot = bar(32, 82, 76) + bar(32, 97, 50);

const robotR = `<g transform="translate(9 8.5) scale(.64)">
    <line x1="43.5" y1="34" x2="43.5" y2="23" stroke="${cream}" stroke-width="5"/>
    <circle cx="43.5" cy="19" r="5.5" fill="${cream}"/>
    <rect x="36" y="32" width="15" height="66" fill="${cream}"/>
    <path d="M43.5 39.5 H68 a18.5 18.5 0 0 1 0 37 H43.5" fill="none" stroke="${cream}" stroke-width="15"/>
    <polygon points="56,76 77,76 99,98 78,98" fill="${cream}"/>
    <circle cx="65" cy="58" r="6.5" fill="${ink}"/>
  </g>`;

// What sits beside and below the R. Each takes the volume's tint.
const motifs = {
  text: (t) => `<g fill="${t}">${bar(79, 29, 29)}${bar(79, 46, 29)}${bar(79, 63, 29)}${foot}</g>`,
  prompt: (t) => `<path d="M82 36 L95 50 L82 64" ${stroke(t, 8)}/>
  <g fill="${t}">${bar(96, 60, 12)}${bar(32, 82, 58)}${bar(44, 97, 64)}</g>`,
  picture: (t) => `<circle cx="93.5" cy="50" r="13" fill="${t}"/>
  <path d="M35 102 L52 85 L66 97 L84 80 L106 102" ${stroke(t, 8)}/>`,
  magnifier: (t) => `<circle cx="90" cy="46" r="10" ${stroke(t, 6.5)}/>
  <path d="M98 54.5 L106 64" ${stroke(t, 7.5)}/>
  <g fill="${t}">${foot}</g>`,
};

const inner = (v) => `${robotR}
  ${motifs[v.motif](v.tint)}`;

const mark = (v) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="512" height="512" role="img" aria-labelledby="t">
  <title id="t">${v.title}</title>
  <rect width="128" height="128" fill="${v.cover}"/>
  <rect width="20" height="128" fill="${v.spine}"/>
  ${inner(v)}
</svg>
`;

// A string from wordmarks.json, set at a size with its baseline at (x, y).
const set = (key, x, y, size, fill) =>
  `<path transform="translate(${x} ${y}) scale(${size / 100})" fill="${fill}" d="${words[key].d}"/>`;
const width = (key, size) => (words[key].w * size) / 100;

// The mark with the name beside it. Light is for light pages, dark for dark pages.
const lockup = (v, dark) => {
  const nameFill = dark ? cream : ink;
  const wordFill = dark ? v.tint : v.spine;
  const textX = 116;
  const textW = Math.max(width('name', 40), v.word ? width(v.word, 30) : 0);
  const w = Math.ceil(textX + textW + 4);
  const text = v.word
    ? `${set('name', textX, 43, 40, nameFill)}
  ${set(v.word, textX, 81, 30, wordFill)}`
    : set('name', textX, 62, 40, nameFill);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 96" width="${w}" height="96" role="img" aria-labelledby="t">
  <title id="t">${v.title}</title>
  <clipPath id="c"><rect width="128" height="128" rx="23"/></clipPath>
  <g clip-path="url(#c)" transform="scale(.75)">
    <rect width="128" height="128" fill="${v.cover}"/>
    <rect width="20" height="128" fill="${v.spine}"/>
    ${inner(v)}
  </g>
  ${text}
</svg>
`;
};

// The 1280 by 640 image GitHub shows when a repository's link is shared.
const social = (id, v) => {
  const text = v.word
    ? `${set('name', 452, 286, 84, cream)}
  ${set(v.word, 452, 376, 84, v.tint)}
  ${set(`line-${id}`, 454, 436, 33, cream)}`
    : `${set('name', 452, 322, 84, cream)}
  ${set(`line-${id}`, 454, 382, 33, cream)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 640" width="1280" height="640" role="img" aria-labelledby="t">
  <title id="t">${v.title}: ${words[`line-${id}`].text}</title>
  <rect width="1280" height="640" fill="${v.cover}"/>
  <rect width="56" height="640" fill="${v.spine}"/>
  <g transform="translate(11.2 112.6) scale(3.4)">
  ${inner(v)}
  </g>
  ${text}
</svg>
`;
};

const write = (path, text) => {
  mkdirSync(dirname(join(here, path)), { recursive: true });
  writeFileSync(join(here, path), text);
};

for (const [id, v] of Object.entries(tokens.volumes)) {
  // Core uses the umbrella mark, so it has a lockup and a social preview but no mark of its own.
  if (id !== 'core') write(`marks/${id}.svg`, mark(v));
  write(`lockups/${id}-light.svg`, lockup(v, false));
  write(`lockups/${id}-dark.svg`, lockup(v, true));
  write(`social/${id}.svg`, social(id, v));
}

// Organised user documentation: the text half (docs/specs/lasting-tutorials.md, AC-19, AC-20, AC-21; Phase 27e).
// These tests read the templates, the guide, the setup and bootstrap skills, and the persona walkthrough.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = file => fs.readFileSync(path.resolve(file), 'utf8');
const flat = text => text.replace(/\s+/g, ' ');
const TEMPLATES = 'plugins/process/templates/artifacts';
const VALIDATION = 'plugins/process/guide/validation.md';
const DESIGN = 'plugins/process/guide/design.md';
const SKILLS = ['setup', 'bootstrap'].map(s => `plugins/process/skills/${s}/SKILL.md`);

test('lasting-tutorials#AC-19: the start page template has an id, a design to derive from, the areas, and a place to start for each persona', () => {
  const text = read(`${TEMPLATES}/user-docs-start.md`);
  assert.match(text, /^---\nid: docs-start\nstatus: draft\nderived-from:\n {2}- \S+:/);
  assert.match(text, /\]\(<?[^)]*\/README\.md\)/);
  assert.match(flat(text), /## Where to start/);
  assert.match(flat(text), /If you are a <persona>, start with/);
});

test('lasting-tutorials#AC-19: the area overview template has an id, who the area is for, the ideas, and the pages in order', () => {
  const text = read(`${TEMPLATES}/user-docs-area.md`);
  assert.match(text, /^---\nid: docs-<area>\nstatus: draft\nderived-from:\n {2}- \S+:/);
  assert.match(flat(text), /who uses it/i);
  assert.match(flat(text), /## The ideas you need/);
  assert.match(flat(text), /## Pages/);
  assert.match(flat(text), /in the order a user needs them/i);
});

test('lasting-tutorials#AC-19: the page template has an optional covers list and says the page goes in its area folder', () => {
  const text = read(`${TEMPLATES}/user-doc.md`);
  assert.match(text, /^# covers:/m);
  assert.match(text, /\/projects\/\{id\}\/board/);
  assert.match(flat(text), /where in the product the page applies/i);
  assert.match(flat(text), /docs\/user\/<area>\/<page>\.md/);
});

test('lasting-tutorials#AC-19: the guide says how user documentation is organised', () => {
  const guide = flat(read(DESIGN));
  assert.match(guide, /organised by area of the product, following its navigation/i);
  assert.match(guide, /each area has an overview/i);
  assert.match(guide, /`docs\/user\/README\.md`[^.]*start page[^.]*place to start for each persona/i);
  assert.match(guide, /every page can be reached from the start page through its area, and from the page to its tutorial/i);
  assert.match(guide, /`covers:`/);
  assert.match(guide, /ships with the product/i);
  assert.match(guide, /never for a slice, layer, or story/i);
  assert.match(guide, /ids do not depend on file paths[^.]*breaks no `derived-from` link/i);
});

test('lasting-tutorials#AC-19: the feature packet adds a page to its overview and a new area to the start page', () => {
  const guide = flat(read(DESIGN));
  assert.match(guide, /packet that adds a page adds it to its area's overview/i);
  assert.match(guide, /packet that adds an area adds it to the start page/i);
});

test('lasting-tutorials#AC-19: setup and bootstrap write the start page with the product brief', () => {
  for (const file of SKILLS) {
    const text = flat(read(file));
    assert.match(text, /start page, `docs\/user\/README\.md`, is written with the product brief from `templates\/artifacts\/user-docs-start\.md`/i, file);
    assert.match(text, /once the areas are known from the design/i, file);
  }
});

test('lasting-tutorials#AC-20: the guide says how each kind of product publishes its help', () => {
  const guide = flat(read(VALIDATION));
  assert.match(guide, /### Publishing the help/);
  assert.match(guide, /web app serves it under one address and has a Help link/i);
  assert.match(guide, /plugin ships it in its documentation folder and names the address in its descriptor/i);
  assert.match(guide, /command-line tool exposes it as help topics/i);
});

test('lasting-tutorials#AC-20: the guide has a recipe for the web-app help', () => {
  const guide = flat(read(VALIDATION));
  assert.match(guide, /build the help from the Markdown at each deployment/i);
  assert.match(guide, /serve it under one address/i);
  assert.match(guide, /Help link open the page whose `covers` matches the current address, or else the area's overview, or else the start page/i);
  assert.match(guide, /include the help in the `try` command's product/i);
  assert.match(guide, /`node \.rfr\/checks\/docs-map\.mjs --json`/);
  assert.match(guide, /rfr ships no help site and hosts nothing/i);
});

test('lasting-tutorials#AC-21: the persona walkthrough starts each persona at the start page for documentation packets', () => {
  const text = flat(read('plugins/process/agents/persona-walkthrough.md'));
  assert.match(text, /adds or changes user documentation, start each persona at the start page/i);
  assert.match(text, /task whose page the persona would not find within three selections, or would look for in another area/i);
  assert.match(text, /as a finding/i);
});

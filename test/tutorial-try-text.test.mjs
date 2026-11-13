// A place to try a tutorial (docs/specs/lasting-tutorials.md, AC-6, AC-10, AC-11, AC-13; Phase 27c).
// These tests read the guide, the setup and bootstrap skills, the persona walkthrough, and the process template.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = file => fs.readFileSync(path.resolve(file), 'utf8');
const flat = text => text.replace(/\s+/g, ' ');
const VALIDATION = 'plugins/process/guide/validation.md';
const DESIGN = 'plugins/process/guide/design.md';
const SKILLS = ['setup', 'bootstrap'].map(s => `plugins/process/skills/${s}/SKILL.md`);

test('lasting-tutorials#AC-6: the guide gives the four conditions for tutorial sign-in', () => {
  const guide = flat(read(VALIDATION));
  assert.match(guide, /only in a build started with a setting for trying/i);
  assert.match(guide, /refused when the product's production setting is on, whatever else is set/i);
  assert.match(guide, /lists only the people the tutorials name, with fixture data/i);
  assert.match(guide, /test proves the path answers 404 without the setting/i);
});

test('lasting-tutorials#AC-6: a project that cannot meet them leaves sign-in out, and a change gets a security review', () => {
  const guide = flat(read(VALIDATION));
  assert.match(guide, /cannot meet them leaves `sign-in` out[^.]*done by hand/i);
  assert.match(guide, /adding or altering such a path gets a security review against those four points/i);
});

test('lasting-tutorials#AC-10: setup and bootstrap ask how the product will be tried and write the try: block', () => {
  for (const file of SKILLS) {
    const text = flat(read(file));
    assert.match(text, /how the product will be tried/i, file);
    assert.match(text, /local command/i, file);
    assert.match(text, /pull requests get previews/i, file);
    assert.match(text, /deployed address/i, file);
    assert.match(text, /`try:` block/, file);
    assert.match(text, /unreal-plugin[^.]*sample project/i, file);
  }
});

test('lasting-tutorials#AC-10: the guide says which slice builds the try command and tutorial sign-in', () => {
  const guide = flat(read(VALIDATION));
  assert.match(guide, /first slice of a product with a user interface builds the `try` command/i);
  assert.match(guide, /first slice with accounts builds tutorial sign-in/i);
});

test('lasting-tutorials#AC-10: the process template shows the try: block, commented out', () => {
  const text = read('plugins/process/templates/process.yml');
  for (const key of ['try:', 'local:', 'preview:', 'url:', 'staging:', 'sign-in:', 'provides:']) {
    assert.match(text, new RegExp(`^# +${key}`, 'm'), key);
  }
  assert.doesNotMatch(text, /^try:/m);
});

test('lasting-tutorials#AC-11: the guide has a recipe for the web-app try command, with one worked example', () => {
  const guide = flat(read(VALIDATION));
  assert.match(guide, /start the data store the product needs/i);
  assert.match(guide, /apply migrations/i);
  assert.match(guide, /load fixture data/i);
  assert.match(guide, /print the address/i);
  assert.match(guide, /clean up on exit/i);
  assert.match(guide, /recipe the project implements in its own stack, not a script rfr runs/i);
  assert.match(read(VALIDATION), /```[^\n]*\n[^`]*PostgreSQL|PostgreSQL[^`]*```/i);
});

test('lasting-tutorials#AC-13: the guide has the table of kinds of product and what trying each takes', () => {
  const guide = flat(read(VALIDATION));
  for (const kind of ['Static site', 'Web app with its own data store', 'System with cloud services', 'Unreal plugin', 'Android or TV app', 'Command-line tool or library']) {
    assert.ok(guide.includes(`| ${kind}`), kind);
  }
});

test('lasting-tutorials#AC-13: the guide gives the three rules for external services', () => {
  const guide = flat(read(VALIDATION));
  assert.match(guide, /every service has a declared stand-in/i);
  assert.match(guide, /`needs:`[^.]*stand-in cannot give/i);
  assert.match(guide, /only the real thing shows is run in one shared staging place before release/i);
});

test('lasting-tutorials#AC-13: the design part asks for a "Trying the product" section', () => {
  const guide = flat(read(DESIGN));
  assert.match(guide, /"Trying the product"/);
  assert.match(guide, /each external service and its stand-in locally and in a preview, with what the stand-in hides/i);
});

test('lasting-tutorials#AC-13: the persona walkthrough reports a service the section leaves out', () => {
  const text = flat(read('plugins/process/agents/persona-walkthrough.md'));
  assert.match(text, /architecture[^.]*service the design names that the "Trying the product" section leaves out/i);
  assert.match(text, /as a finding/i);
});

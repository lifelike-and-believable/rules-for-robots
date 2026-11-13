// A tutorial is lasting user documentation that runs (docs/specs/lasting-tutorials.md, AC-1 and AC-7;
// Phase 27a). These tests read the templates, the guide, and the deliver skill.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = file => fs.readFileSync(path.resolve(file), 'utf8');
const flat = text => text.replace(/\s+/g, ' ');
const BASE = 'plugins/process/templates/artifacts/tutorial.md';
const PROFILES = ['general', 'static-site', 'unreal-plugin', 'web-app'];
const TEMPLATES = [BASE, ...PROFILES.map(p => `plugins/process/templates/profiles/${p}/tutorial.md`)];

test('lasting-tutorials#AC-1: every tutorial template is titled and named for the task, for a persona', () => {
  for (const file of TEMPLATES) {
    const text = flat(read(file));
    assert.match(text, /^---.*?# <task\b/, `${file}: title states the task`);
    assert.match(text, /docs\/tutorials\/<task\b/, `${file}: file named for the task`);
    assert.match(text, /persona/i, `${file}: names the persona`);
    assert.doesNotMatch(text, /<feature>|<slice|<spec/i, `${file}: no feature, slice, or spec name`);
  }
});

test('lasting-tutorials#AC-1: "Before you start" is in the product\'s terms, and the server-command line is gone', () => {
  const base = flat(read(BASE));
  assert.match(base, /## Before you start/);
  assert.match(base, /an account, a role, or a finished earlier tutorial/i);
  assert.doesNotMatch(base, /command that starts/i);
  assert.doesNotMatch(base, /localhost/i);
  for (const p of ['general', 'web-app']) {
    assert.match(read(`plugins/process/templates/profiles/${p}/tutorial.md`), /^## Before you start$/m);
  }
});

test('lasting-tutorials#AC-1: templates have no run record and no section for the lead', () => {
  for (const file of TEMPLATES) {
    const text = read(file);
    assert.doesNotMatch(text, /Run record/i, file);
    assert.doesNotMatch(text, /^#+\s.*\b(for the lead|lead)\b/im, file);
  }
  assert.match(flat(read(BASE)), /steps name pages by path/i);
});

test('lasting-tutorials#AC-1: web profile templates name pages by path in their steps', () => {
  for (const p of ['static-site', 'web-app']) {
    assert.match(read(`plugins/process/templates/profiles/${p}/tutorial.md`), /Open `\/<path>`/);
  }
});

test('lasting-tutorials#AC-1: the Unreal template may still name the engine and the sample project', () => {
  const text = flat(read('plugins/process/templates/profiles/unreal-plugin/tutorial.md'));
  assert.match(text, /Unreal Engine 5\.6/);
  assert.match(text, /sample project/i);
});

test('lasting-tutorials#AC-1: the guide says a tutorial is user documentation that runs, for a task and a persona', () => {
  const guide = flat(read('plugins/process/guide/validation.md'));
  assert.match(guide, /tutorial is user documentation that runs/i);
  assert.match(guide, /named for the task/i);
  assert.match(guide, /written for the persona/i);
});

test('lasting-tutorials#AC-1: the guide says the same file runs everywhere and names no machine or build', () => {
  const guide = flat(read('plugins/process/guide/validation.md'));
  assert.match(guide, /same file[^.]*local build[^.]*preview[^.]*deployed product/i);
  assert.match(guide, /names no machine and no build/i);
  assert.match(guide, /described once for the project, outside the tutorials/i);
});

test('lasting-tutorials#AC-1: the guide keeps a run record out of the tutorial and sends person-only checks to the lead', () => {
  const guide = flat(read('plugins/process/guide/validation.md'));
  assert.match(guide, /record of a run goes with the run[^.]*recording[^.]*pull request's description[^.]*never in the tutorial/i);
  assert.match(guide, /only a person can do[^.]*"Notes for delivery"[^.]*lead's validation/i);
});

test('lasting-tutorials#AC-1: the guide says later slices extend a tutorial for a task', () => {
  const guide = flat(read('plugins/process/guide/validation.md'));
  assert.match(guide, /later slices extend the tutorial for a task instead of adding one for each slice/i);
});

test('lasting-tutorials#AC-7: the deliver skill writes or extends the task\'s tutorial as runner: web, with no second script', () => {
  const skill = flat(read('plugins/process/skills/deliver/SKILL.md'));
  assert.match(skill, /for a web product[^.]*`runner: web`/i);
  assert.match(skill, /no second script/i);
});

test('lasting-tutorials#AC-7: the deliver skill extends an existing tutorial and says in the decisions file which it did', () => {
  const skill = flat(read('plugins/process/skills/deliver/SKILL.md'));
  assert.match(skill, /extend[^.]*tutorial[^.]*already has one for the same task/i);
  assert.match(skill, /say in the decisions file which you did/i);
});

test('lasting-tutorials#AC-7: the deliver skill runs every tutorial the delivery touches against the built product and records it', () => {
  const skill = flat(read('plugins/process/skills/deliver/SKILL.md'));
  assert.match(skill, /every tutorial the delivery touches[^.]*against the built product/i);
  assert.match(skill, /records? the run/i);
  assert.doesNotMatch(skill, /\btry\b command/i);
});

test('lasting-tutorials#AC-7: the deliver skill keeps checks only a person can do out of the tutorial', () => {
  const skill = flat(read('plugins/process/skills/deliver/SKILL.md'));
  assert.match(skill, /checks only a person can do (?:out of|stay out of)[^.]*tutorial|keep checks only a person can do out of the tutorial/i);
  assert.match(skill, /lead's validation/i);
});

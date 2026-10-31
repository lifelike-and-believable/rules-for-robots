// Tests for the CODEOWNERS script (docs/specs/project-process.md, "CODEOWNERS"): a managed block
// generated from process.yml, and a drift check. Each test title cites the criterion it covers
// (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseProcessConfig } from '../checks/lib/process.mjs';
import { renderBlock, runCodeowners } from '../checks/process-codeowners.mjs';

const TEAM = 'mode: team\ndefault: [lead]\nstages:\n  personas: [ux-lead, "@acme/ux"]\n';

const BLOCK = [
  '# rfr-process:begin (generated from docs/product/process.yml; do not edit by hand)',
  '/docs/product/concept.md @lead',
  '/docs/product/requirements/ @lead',
  '/docs/product/personas/ @ux-lead @acme/ux',
  '/docs/product/epics/ @lead',
  '/docs/product/stories/ @lead',
  '/docs/design/ @lead',
  '/docs/user/ @lead',
  '/docs/tutorials/ @lead',
  '# rfr-process:end',
  '',
].join('\n');

function project(config = TEAM, codeowners = null) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-codeowners-'));
  fs.mkdirSync(path.join(root, 'docs/product'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/product/process.yml'), config);
  if (codeowners !== null) {
    fs.mkdirSync(path.join(root, '.github'), { recursive: true });
    fs.writeFileSync(path.join(root, '.github/CODEOWNERS'), codeowners);
  }
  return root;
}

const read = root => fs.readFileSync(path.join(root, '.github/CODEOWNERS'), 'utf8');

test('project-process#AC-9: the block maps each gated stage folder to its approvers', () => {
  assert.equal(renderBlock(parseProcessConfig(TEAM).config), BLOCK);
});

test('project-process#AC-9: spec approvers add a docs/specs entry between user docs and tutorials', () => {
  const block = renderBlock(parseProcessConfig(`${TEAM}  specs: [spec-lead]\n`).config);
  assert.match(block, /\/docs\/user\/ @lead\n\/docs\/specs\/ @spec-lead\n\/docs\/tutorials\/ @lead\n/);
});

test('project-process#AC-9: writing keeps the rest of CODEOWNERS and replaces the block instead of adding another', () => {
  const root = project(TEAM, '* @someone\n');
  assert.equal(runCodeowners(root, { check: false }).ok, true);
  assert.equal(read(root), `* @someone\n\n${BLOCK}`);
  fs.writeFileSync(path.join(root, 'docs/product/process.yml'), TEAM.replace('[lead]', '[new-lead]'));
  runCodeowners(root, { check: false });
  const text = read(root);
  assert.equal(text.match(/rfr-process:begin/g).length, 1);
  assert.match(text, /^\* @someone\n/);
  assert.match(text, /\/docs\/product\/concept\.md @new-lead/);
});

test('project-process#AC-9: writing creates .github/CODEOWNERS when there is none', () => {
  const root = project();
  runCodeowners(root, { check: false });
  assert.equal(read(root), BLOCK);
});

test('project-process#AC-9: the drift check passes on a current block and fails on a changed or missing one', () => {
  const root = project();
  runCodeowners(root, { check: false });
  assert.equal(runCodeowners(root, { check: true }).ok, true);

  fs.writeFileSync(path.join(root, '.github/CODEOWNERS'), BLOCK.replace('@ux-lead @acme/ux', '@ux-lead'));
  const changed = runCodeowners(root, { check: true });
  assert.equal(changed.ok, false);
  assert.match(changed.message, /differs/);
  assert.equal(read(root), BLOCK.replace('@ux-lead @acme/ux', '@ux-lead'), 'the check does not write');

  fs.writeFileSync(path.join(root, '.github/CODEOWNERS'), '* @someone\n');
  assert.equal(runCodeowners(root, { check: true }).ok, false);
});

test('project-process#AC-9: solo mode needs no block, so writing and checking both skip', () => {
  const root = project('mode: solo\ndefault: [lead]\n');
  assert.equal(renderBlock(parseProcessConfig('mode: solo\ndefault: [lead]\n').config), null);
  const checked = runCodeowners(root, { check: true });
  assert.equal(checked.ok, true);
  assert.match(checked.message, /solo/);
  runCodeowners(root, { check: false });
  assert.equal(fs.existsSync(path.join(root, '.github/CODEOWNERS')), false);
});

test('project-process#AC-9: without process.yml there is nothing to check', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-codeowners-none-'));
  assert.equal(runCodeowners(root, { check: true }).ok, true);
});

// Tests that user documentation is organised by area and that every page can be reached
// (docs/specs/lasting-tutorials.md, AC-16 and AC-17): a start page, a folder with an overview for
// each area, and links from the start page to each overview and from each overview to its pages.
// Each test title cites the criterion it covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runProcessTrace } from '../checks/process-trace.mjs';

// The pages derive from nothing, so the stage order reports them; the tests look only at the
// problems that name a file under docs/user/, which the stage-order messages do not.
function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-user-docs-'));
  const all = { 'docs/product/process.yml': 'default: [lead]\n', ...files };
  for (const [file, text] of Object.entries(all)) {
    if (text === null) continue;
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

const page = (id, title, body = '', status = 'approved') => `---\nid: ${id}\nstatus: ${status}\n---\n\n# ${title}\n\n${body}\n`;

// Two areas, each with an overview that links its pages, and a start page that links both.
const organised = {
  'docs/user/README.md': page('docs-start', 'Product help', '- [Board](board/README.md)\n- [People](people/README.md)'),
  'docs/user/board/README.md': page('docs-board', 'Board', '- [Move a card](move-card.md#steps): move work between columns.'),
  'docs/user/board/move-card.md': page('docs-move-card', 'Move a card'),
  'docs/user/people/README.md': page('docs-people', 'People', '- [Invite someone](./invite.md)'),
  'docs/user/people/invite.md': page('docs-invite', 'Invite someone'),
};

const matching = (list, re) => list.filter(m => re.test(m));
const userDocs = list => matching(list, /docs\/user/);

test('lasting-tutorials#AC-16: an organised project has no problems', () => {
  const r = runProcessTrace(project(organised));
  assert.deepEqual(userDocs(r.errors), []);
  assert.deepEqual(userDocs(r.warnings), []);
});

test('lasting-tutorials#AC-16: a page directly in docs/user/ is reported once, with where to move it', () => {
  const r = runProcessTrace(project({ ...organised, 'docs/user/export.md': page('docs-export', 'Export') }));
  const found = matching(r.errors, /docs\/user\/export\.md/);
  assert.equal(found.length, 1, r.errors.join('\n'));
  assert.match(found[0], /directly in docs\/user\//);
  assert.match(found[0], /move it into the folder of the area it belongs to/);
});

test('lasting-tutorials#AC-16: a flat folder reports each page and the missing start page', () => {
  const r = runProcessTrace(project({
    'docs/user/export.md': page('docs-export', 'Export'),
    'docs/user/import.md': page('docs-import', 'Import'),
  }));
  assert.equal(matching(r.errors, /docs\/user\/export\.md is directly in docs\/user\//).length, 1, r.errors.join('\n'));
  assert.equal(matching(r.errors, /docs\/user\/import\.md is directly in docs\/user\//).length, 1, r.errors.join('\n'));
  assert.equal(matching(r.errors, /docs\/user\/README\.md is missing/).length, 1, r.errors.join('\n'));
});

test('lasting-tutorials#AC-16: a missing start page is reported once, however many pages there are', () => {
  const r = runProcessTrace(project({ ...organised, 'docs/user/README.md': null }));
  const found = matching(r.errors, /docs\/user\/README\.md is missing/);
  assert.equal(found.length, 1, r.errors.join('\n'));
  assert.match(found[0], /start page/);
});

test('lasting-tutorials#AC-16: an area folder with no overview is reported once, however many pages it has', () => {
  const r = runProcessTrace(project({
    ...organised,
    'docs/user/board/README.md': null,
    'docs/user/board/archive-card.md': page('docs-archive-card', 'Archive a card'),
  }));
  const found = matching(r.errors, /docs\/user\/board\//);
  assert.equal(found.length, 1, r.errors.join('\n'));
  assert.match(found[0], /docs\/user\/board\/ has no README\.md/);
});

test('lasting-tutorials#AC-16: a folder whose pages are all in a subfolder is still an area that needs an overview', () => {
  const r = runProcessTrace(project({
    ...organised,
    'docs/user/settings/advanced/keys.md': page('docs-keys', 'Keys'),
  }));
  assert.equal(matching(r.errors, /docs\/user\/settings\/ has no README\.md/).length, 1, r.errors.join('\n'));
  // A subfolder of an area is not an area of its own.
  assert.deepEqual(matching(r.errors, /docs\/user\/settings\/advanced\/ has no README\.md/), []);
});

test('lasting-tutorials#AC-16: a project with no user documentation is not asked for a start page', () => {
  const r = runProcessTrace(project({ 'docs/product/concept.md': page('concept', 'Concept') }));
  assert.deepEqual(matching(r.errors, /docs\/user/), []);
});

test('lasting-tutorials#AC-16: with lasting warn the structure problems are warnings', () => {
  const root = project({
    'docs/user/export.md': page('docs-export', 'Export'),
    'docs/user/board/move-card.md': page('docs-move-card', 'Move a card'),
  });
  const r = runProcessTrace(root, { lasting: 'warn' });
  assert.deepEqual(matching(r.errors, /docs\/user/), []);
  assert.equal(matching(r.warnings, /docs\/user\/README\.md is missing/).length, 1, r.warnings.join('\n'));
  assert.equal(matching(r.warnings, /docs\/user\/export\.md is directly in docs\/user\//).length, 1, r.warnings.join('\n'));
  assert.equal(matching(r.warnings, /docs\/user\/board\/ has no README\.md/).length, 1, r.warnings.join('\n'));
  // The default still fails them.
  assert.equal(matching(runProcessTrace(root).errors, /docs\/user\/README\.md is missing/).length, 1);
});

test('lasting-tutorials#AC-17: an approved page its area overview does not link to is reported, naming both files', () => {
  const r = runProcessTrace(project({ ...organised, 'docs/user/board/README.md': page('docs-board', 'Board', 'Nothing listed yet.') }));
  const found = matching(r.errors, /docs\/user\/board\/move-card\.md/);
  assert.equal(found.length, 1, r.errors.join('\n'));
  assert.match(found[0], /docs\/user\/board\/README\.md/);
  assert.match(found[0], /does not link to/);
});

test('lasting-tutorials#AC-17: an area whose overview the start page does not link to is reported', () => {
  const r = runProcessTrace(project({ ...organised, 'docs/user/README.md': page('docs-start', 'Product help', '- [Board](board/README.md)') }));
  const found = matching(r.errors, /docs\/user\/people\/README\.md/);
  assert.equal(found.length, 1, r.errors.join('\n'));
  assert.match(found[0], /start page, docs\/user\/README\.md, does not link to/);
});

test('lasting-tutorials#AC-17: a page in a subfolder of an area is reached through the area overview', () => {
  const linked = runProcessTrace(project({
    ...organised,
    'docs/user/board/README.md': page('docs-board', 'Board', '- [Move a card](move-card.md)\n- [Card keys](keys/card-keys.md)'),
    'docs/user/board/keys/card-keys.md': page('docs-card-keys', 'Card keys'),
  }));
  assert.deepEqual(userDocs(linked.errors), []);
  const unlinked = runProcessTrace(project({ ...organised, 'docs/user/board/keys/card-keys.md': page('docs-card-keys', 'Card keys') }));
  assert.equal(matching(unlinked.errors, /docs\/user\/board\/keys\/card-keys\.md/).length, 1, unlinked.errors.join('\n'));
});

test('lasting-tutorials#AC-17: a draft page and a draft overview are not checked for links', () => {
  const r = runProcessTrace(project({
    ...organised,
    'docs/user/board/draft-page.md': page('docs-draft-page', 'Draft page', '', 'draft'),
    'docs/user/reports/README.md': page('docs-reports', 'Reports', '', 'draft'),
  }));
  assert.deepEqual(userDocs(r.errors), []);
});

test('lasting-tutorials#AC-17: with lasting warn the reachability problems are warnings', () => {
  const r = runProcessTrace(project({
    ...organised,
    'docs/user/README.md': page('docs-start', 'Product help', '- [Board](board/README.md)'),
    'docs/user/board/README.md': page('docs-board', 'Board', 'Nothing listed yet.'),
  }), { lasting: 'warn' });
  assert.deepEqual(userDocs(r.errors), []);
  assert.equal(matching(r.warnings, /docs\/user\/board\/move-card\.md/).length, 1, r.warnings.join('\n'));
  assert.equal(matching(r.warnings, /docs\/user\/people\/README\.md/).length, 1, r.warnings.join('\n'));
});

// Tests for what a user documentation page covers and for the map of the documentation
// (docs/specs/lasting-tutorials.md, AC-18): covers: in a page's front matter, the process check's
// rule that an entry belongs to one page, and checks/docs-map.mjs as a tree and as data.
// Each test title cites the criterion it covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runProcessTrace } from '../checks/process-trace.mjs';
import { docsMap, renderMap } from '../checks/docs-map.mjs';
import { coversOf } from '../checks/lib/user-docs.mjs';

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-docs-map-'));
  const all = { 'docs/product/process.yml': 'default: [lead]\n', ...files };
  for (const [file, text] of Object.entries(all)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

const page = (id, title, body = '', { status = 'approved', extra = '' } = {}) => `---\nid: ${id}\nstatus: ${status}\n${extra}---\n\n# ${title}\n\n${body}\n`;

const listFiles = root => {
  const out = [];
  const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else out.push([p, fs.statSync(p).mtimeMs]); } };
  walk(root);
  return out.sort();
};

// Two areas linked from the start page in the order People, Board, and a third area it does not
// link. Board's overview links its pages in the order "move", then "archive"; "labels" is not linked.
const twoAreas = {
  'docs/user/README.md': page('docs-start', 'Studio help', 'Start with [People](people/README.md), then the [Board](board/README.md).'),
  'docs/user/board/README.md': page('docs-board', 'Board', '1. [Move a card](move-card.md)\n2. [Archive a card](archive-card.md)'),
  'docs/user/board/move-card.md': page('docs-move-card', 'Move a card', 'Try it: [Move your first card](../../tutorials/move-card.md)', { extra: 'covers: [/projects/{id}/board, /projects/{id}/board/{workId}]\n' }),
  'docs/user/board/archive-card.md': page('docs-archive-card', 'Archive a card', '', { status: 'draft' }),
  'docs/user/board/labels.md': page('docs-labels', 'Labels', '', { status: 'draft' }),
  'docs/user/people/README.md': page('docs-people', 'People', '- [Invite someone](invite.md)'),
  'docs/user/people/invite.md': page('docs-invite', 'Invite someone', '', { extra: 'covers:\n  - /people/invite\n  - "Invite panel"\n' }),
  'docs/user/archive/README.md': page('docs-archive', 'Archive', '', { status: 'draft' }),
  'docs/tutorials/move-card.md': '---\nid: tutorial-move-card\nstatus: draft\nrunner: manual\n---\n\n# Move your first card\n\n## Steps\n\n1. Move it. (manual)\n',
};

test('lasting-tutorials#AC-18: covers: is read as an inline list or a block list, with comments and quotes', () => {
  const front = body => `---\nid: x\n${body}\n---\n\n# X\n`;
  assert.deepEqual(coversOf(front('covers: [/projects/{id}/board, /projects/{id}/board/{workId}]')), { covers: ['/projects/{id}/board', '/projects/{id}/board/{workId}'], error: null });
  assert.deepEqual(coversOf(front('covers:\n  - /people/invite\n  - Invite panel')), { covers: ['/people/invite', 'Invite panel'], error: null });
  assert.deepEqual(coversOf(front('covers:\n- /people/invite\n- rfr map --json')), { covers: ['/people/invite', 'rfr map --json'], error: null });
  assert.deepEqual(coversOf(front('covers: [/board] # the main view')), { covers: ['/board'], error: null });
  assert.deepEqual(coversOf(front('covers:\n  - /board # the main view\n  - "/help #shortcuts"\n  - \'/a, b\'')), { covers: ['/board', '/help #shortcuts', '/a, b'], error: null });
  assert.deepEqual(coversOf(front('covers: ["/help #keys", /settings#profile]')), { covers: ['/help #keys', '/settings#profile'], error: null });
  assert.deepEqual(coversOf(front('id2: y')), { covers: null, error: null });
  assert.deepEqual(coversOf(front('covers: []')), { covers: [], error: null });
  assert.match(coversOf(front('covers: /board')).error, /is not a list/);
  assert.match(coversOf(front('covers:\nstatus: approved')).error, /names nothing/);
});

test('lasting-tutorials#AC-18: the same covers entry in two pages fails, naming both files, whatever the lasting setting', () => {
  const root = project({
    ...twoAreas,
    'docs/user/people/invite.md': page('docs-invite', 'Invite someone', '', { extra: 'covers: [ /projects/{id}/board ]\n' }),
  });
  for (const lasting of ['fail', 'warn']) {
    const found = runProcessTrace(root, { lasting }).errors.filter(e => e.includes('/projects/{id}/board"'));
    assert.equal(found.length, 1, `${lasting}: ${runProcessTrace(root, { lasting }).errors.join('\n')}`);
    assert.match(found[0], /docs\/user\/board\/move-card\.md/);
    assert.match(found[0], /docs\/user\/people\/invite\.md/);
  }
});

test('lasting-tutorials#AC-18: different covers entries in different pages pass', () => {
  const r = runProcessTrace(project(twoAreas));
  assert.deepEqual(r.errors.filter(e => /covers/.test(e)), []);
});

test('lasting-tutorials#AC-18: a covers line that cannot be read is an error', () => {
  const r = runProcessTrace(project({ ...twoAreas, 'docs/user/people/invite.md': page('docs-invite', 'Invite someone', '', { extra: 'covers: /people/invite\n' }) }));
  assert.equal(r.errors.filter(e => /docs-invite: covers: "\/people\/invite" is not a list/.test(e)).length, 1, r.errors.join('\n'));
});

test('lasting-tutorials#AC-18: the map gives the start page, the areas in link order, their pages in link order, and each page\'s tutorials', () => {
  const map = docsMap(project(twoAreas));
  assert.deepEqual(map, {
    start: { title: 'Studio help', file: 'docs/user/README.md' },
    areas: [
      {
        name: 'people', title: 'People', file: 'docs/user/people/README.md', linked: true,
        pages: [{ id: 'docs-invite', title: 'Invite someone', file: 'docs/user/people/invite.md', status: 'approved', covers: ['/people/invite', 'Invite panel'], linked: true, tutorials: [] }],
      },
      {
        name: 'board', title: 'Board', file: 'docs/user/board/README.md', linked: true,
        pages: [
          { id: 'docs-move-card', title: 'Move a card', file: 'docs/user/board/move-card.md', status: 'approved', covers: ['/projects/{id}/board', '/projects/{id}/board/{workId}'], linked: true, tutorials: [{ title: 'Move your first card', file: 'docs/tutorials/move-card.md' }] },
          { id: 'docs-archive-card', title: 'Archive a card', file: 'docs/user/board/archive-card.md', status: 'draft', covers: [], linked: true, tutorials: [] },
          { id: 'docs-labels', title: 'Labels', file: 'docs/user/board/labels.md', status: 'draft', covers: [], linked: false, tutorials: [] },
        ],
      },
      { name: 'archive', title: 'Archive', file: 'docs/user/archive/README.md', linked: false, pages: [] },
    ],
  });
});

test('lasting-tutorials#AC-18: the tree shows the same, marking what is not linked', () => {
  const tree = renderMap(docsMap(project(twoAreas)));
  assert.equal(tree, [
    'Studio help (docs/user/README.md)',
    '  People (docs/user/people/README.md)',
    '    Invite someone (docs/user/people/invite.md)',
    '      covers: /people/invite; Invite panel',
    '  Board (docs/user/board/README.md)',
    '    Move a card (docs/user/board/move-card.md)',
    '      covers: /projects/{id}/board; /projects/{id}/board/{workId}',
    '      tutorial: Move your first card (docs/tutorials/move-card.md)',
    '    Archive a card (docs/user/board/archive-card.md) [draft]',
    '    Labels (docs/user/board/labels.md) [draft] [not linked from the overview]',
    '  Archive (docs/user/archive/README.md) [not linked from the start page]',
  ].join('\n'));
});

test('lasting-tutorials#AC-18: the command prints the tree, or the data with --json, and changes nothing', () => {
  const root = project(twoAreas);
  const before = listFiles(root);
  const script = path.resolve('checks/docs-map.mjs');
  const text = spawnSync(process.execPath, [script, root], { encoding: 'utf8' });
  assert.equal(text.status, 0, text.stderr);
  assert.equal(text.stdout.trim(), renderMap(docsMap(root)));
  const json = spawnSync(process.execPath, [script, root, '--json'], { encoding: 'utf8' });
  assert.equal(json.status, 0, json.stderr);
  assert.deepEqual(JSON.parse(json.stdout), docsMap(root));
  assert.deepEqual(listFiles(root), before);
  // It reads files and nothing else: no network module is imported.
  assert.doesNotMatch(fs.readFileSync(script, 'utf8'), /node:(?:https?|net|dns|tls)|fetch\(/);
});

test('lasting-tutorials#AC-18: the command says so and exits 0 when there is no user documentation', () => {
  const root = project({});
  const r = spawnSync(process.execPath, [path.resolve('checks/docs-map.mjs'), root], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim().split('\n').length, 1);
  assert.match(r.stdout, /no user documentation/i);
});

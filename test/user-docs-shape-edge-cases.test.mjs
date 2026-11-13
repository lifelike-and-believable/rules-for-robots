// Cases the review of slice 27e found (docs/specs/lasting-tutorials.md, AC-16 to AC-18): a start page
// or overview named readme.md counts, a link written with %20 reaches a page whose path has a space,
// the messages say what kind of link counts, and the map refuses a root that is not a folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runProcessTrace } from '../checks/process-trace.mjs';

const front = (id, status, links) => `---\nid: ${id}\nstatus: ${status}\nderived-from:\n${links.map(l => `  - ${l}\n`).join('')}---\n`;

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-docs-edge-'));
  const all = {
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/stories/board.md': `${front('story-board', 'approved', [])}\nAs a user, I want a board so that I can see work.\n`,
    'docs/design/board.md': `${front('design-board', 'approved', ['story-board'])}\n# Board\n`,
    ...files,
  };
  for (const [file, text] of Object.entries(all)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); }
  return root;
}
const page = (id, body) => `${front(id, 'approved', ['design-board'])}\n${body}\n`;
const shape = root => runProcessTrace(root).errors.filter(e => /docs\/user/.test(e));

test('lasting-tutorials#AC-16: a start page and an overview named readme.md count', () => {
  const root = project({
    'docs/user/readme.md': page('docs-start', '# Help\n\n- [Board](board/Readme.md)'),
    'docs/user/board/Readme.md': page('docs-board', '# Board\n\n- [Move a card](move-card.md)'),
    'docs/user/board/move-card.md': page('docs-move-card', '# Move a card'),
  });
  assert.deepEqual(shape(root), []);
});

test('lasting-tutorials#AC-17: a link written with %20 reaches a page whose path has a space', () => {
  const root = project({
    'docs/user/README.md': page('docs-start', '# Help\n\n- [Board](board/README.md)'),
    'docs/user/board/README.md': page('docs-board', '# Board\n\n- [Move a card](how%20to/move-card.md)'),
    'docs/user/board/how to/move-card.md': page('docs-move-card', '# Move a card'),
  });
  assert.deepEqual(shape(root), []);
});

test('lasting-tutorials#AC-17: the message says the link is written inline, to the file', () => {
  const root = project({
    'docs/user/README.md': page('docs-start', '# Help\n\n- [Board](board/)'),
    'docs/user/board/README.md': page('docs-board', '# Board\n\nSee the pages.'),
    'docs/user/board/move-card.md': page('docs-move-card', '# Move a card'),
  });
  const errors = shape(root).join('\n');
  assert.match(errors, /does not link to docs\/user\/board\/README\.md.*written inline, like \[Board\]\(board\/README\.md\)/);
  assert.match(errors, /does not link to docs\/user\/board\/move-card\.md.*written inline/);
});

test('lasting-tutorials#AC-18: the map refuses a root that is not a folder', () => {
  const run = spawnSync(process.execPath, [path.resolve('checks/docs-map.mjs'), path.join(os.tmpdir(), 'rfr-no-such-folder-here')], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /not a folder/);
});

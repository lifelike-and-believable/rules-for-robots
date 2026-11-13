// Cases the review of slice 27a found (docs/specs/lasting-tutorials.md, AC-2 and AC-9): text a step
// types is not a shell command, a path that contains "localhost" names no machine, other loopback
// addresses do, and a tutorial that derives from no user documentation needs no link from any.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bodyProblems } from '../checks/lib/tutorial.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';

const body = steps => `# Search the log\n\n## Before you start\n\n- An account.\n\n## Steps\n\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n## What you made\n\nDone.\n`;

test('lasting-tutorials#AC-2: text a step types, chooses, or opens is not a shell command', () => {
  const typed = body(['Open `/search`.', 'Type `git status` into **Search**.', 'Choose `node 22` from **Runtime**.', 'Type `make it so` into **Note**.']);
  assert.deepEqual(bodyProblems(typed, 'web'), []);
  // A command outside a step sentence is still reported.
  assert.match(bodyProblems(body(['Run `npm run dev` first.']), 'web').join('\n'), /shell command/);
});

test('lasting-tutorials#AC-2: a path that contains the word localhost names no machine; loopback addresses do', () => {
  assert.deepEqual(bodyProblems(body(['Open `/docs/localhost-setup`.']), 'web'), []);
  for (const address of ['http://localhost:3000', 'LOCALHOST', '127.0.0.1:3000', '127.0.0.2', '0.0.0.0:8080', '[::1]']) {
    assert.match(bodyProblems(body([`You see **Ready** at ${address}.`]), 'manual').join('\n'), /names a machine/, address);
  }
});

const front = (id, status, links, extra = '') => `---\nid: ${id}\nstatus: ${status}\n${extra}derived-from:\n${links.map(l => `  - ${l}\n`).join('')}---\n`;

test('lasting-tutorials#AC-9: a tutorial that derives from no user documentation needs no link from any', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-lasting-edge-'));
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  write('docs/product/process.yml', 'default: [lead]\nwaived:\n  user-docs: a command-line tool whose help text is its documentation\n');
  write('docs/product/stories/export.md', `${front('story-export', 'approved', [])}\nAs a user, I want to export so that I can share.\n`);
  write('docs/design/export.md', `${front('design-export', 'approved', ['story-export'])}\n# Export\n`);
  write('docs/tutorials/export.md', `${front('tutorial-export', 'approved', ['design-export'], 'runner: manual\n')}\n# Export a file\n\n## Steps\n\n1. Export.\n`);
  assert.doesNotMatch(runProcessTrace(root).errors.join('\n'), /no approved user documentation links to/);
});

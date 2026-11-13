// Tests for matching a story's role to a persona (docs/specs/project-process.md, AC-29). Moved
// unchanged from the pilot-round files (rewrite plan 25e). Each test title cites the criterion it
// covers (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { relink } from '../checks/process-relink.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-roles-'));
  for (const [f, t] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), t); }
  return root;
}
const art = (id, links, body, status = 'approved') =>
  `---\nid: ${id}\nstatus: ${status}\n${links.length ? `derived-from:\n${links.map(l => `  - ${l}:\n`).join('')}` : ''}---\n\n${body}`;

function storyProject(role) {
  const root = project({
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/concept.md': art('concept', [], '# Concept\n\n## Audience\n\nReaders.\n'),
    'docs/product/personas/fan.md': art('persona-fan', ['concept#audience'], '# Fan and reader\n\n## Goals\n\nRead comics.\n'),
    'docs/product/personas/star.md': art('persona-star', ['concept#audience'], '# Star, the artist and site editor\n\n## Goals\n\nPublish.\n'),
    'docs/product/personas/animator.md': art('persona-animator', ['concept#audience'], '# Animator\n\n## Goals\n\nShip.\n'),
    'docs/product/epics/read.md': art('epic-read', ['persona-fan#goals'], '# Reading\n\n## Outcome\n\nFans read.\n'),
    'docs/product/stories/read/first.md': art('story-first', ['epic-read#outcome', 'persona-fan#goals', 'persona-star#goals', 'persona-animator#goals'],
      `# First page\n\nAs ${role}, I want to open a comic so that I can start reading.\n\n## Acceptance criteria\n\n- The first page shows.\n`),
  });
  relink(root, ['persona-fan', 'persona-star', 'persona-animator', 'epic-read', 'story-first']);
  return runProcessTrace(root).errors.join('\n');
}

test('project-process#AC-29: a role matches by id, short name, title, the start of the title, or a whole name inside the role', () => {
  for (const role of ['a fan', 'the Fan and reader', 'persona-fan', 'Star', 'a busy animator', 'an animator']) {
    assert.doesNotMatch(storyProject(role), /story-first/, role);
  }
});

test('project-process#AC-29: a word from the middle of a title, or part of a word, does not match', () => {
  for (const role of ['a reader', 'an editor', 'a fa', 'an anim']) {
    assert.match(storyProject(role), /story-first.*role/, role);
  }
});

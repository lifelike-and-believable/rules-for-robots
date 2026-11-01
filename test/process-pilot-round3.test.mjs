// Tests for the third round of fixes from the Kettlebird pilot (docs/specs/project-process.md,
// "Pilot findings: round 3"). Each test title cites the criterion it covers (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { relink } from '../checks/process-relink.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';

const art = (id, links, body, status = 'approved') =>
  `---\nid: ${id}\nstatus: ${status}\n${links.length ? `derived-from:\n${links.map(l => `  - ${l}:\n`).join('')}` : ''}---\n\n${body}`;

test('project-process#AC-30: the warning says how to resolve it, including removing bold that is only emphasis', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-round3-'));
  const files = {
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/concept.md': art('concept', [], '# Concept\n\n## Audience\n\nReaders.\n'),
    'docs/product/personas/fan.md': art('persona-fan', ['concept#audience'], '# Fan\n\n## Goals\n\nRead.\n'),
    'docs/product/epics/read.md': art('epic-read', ['persona-fan#goals'], '# Reading\n\n## Outcome\n\nFans read.\n'),
    'docs/product/stories/read/first.md': art('story-first', ['epic-read#outcome', 'persona-fan#goals'], '# First\n\nAs a fan, I want to read so that I enjoy it.\n\n## Acceptance criteria\n\n- Pages show.\n'),
    'docs/design/reader.md': art('design-reader', ['story-first'], '# Reader\n\nThe toolbar has **Next page**.\n'),
    'docs/user/reading.md': art('docs-reading', ['design-reader'], '# Reading\n\n**Tap or click** the page, then select **Next page**.\n', 'draft'),
  };
  for (const [f, t] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), t); }
  relink(root, ['persona-fan', 'epic-read', 'story-first', 'design-reader', 'docs-reading']);
  const warning = runProcessTrace(root).warnings.find(w => /Tap or click/.test(w));
  assert.ok(warning, 'a warning for the bold phrase');
  assert.match(warning, /design's name/);
  assert.match(warning, /add it to the design/);
  assert.match(warning, /not a (control )?name.*(remove|drop|unbold)|(remove|drop|unbold).*not a (control )?name|emphasis/i);
});

// Work with no user-facing behaviour (docs/specs/process-state.md, AC-10 and AC-11): a spec may
// derive from an approved design that says, with a reason, that the work it covers needs no user
// documentation. The approver approves that statement with the design, so the short path is theirs
// to open. Each test title cites the criterion it covers (process-state#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArtifact } from '../checks/lib/process.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';
import { decideStage } from '../plugins/process/scripts/guard-stages.mjs';

const REASON = 'repository layout, build, and continuous integration; nothing a user sees';
const front = (id, status, links, extra = '') => `---\nid: ${id}\nstatus: ${status}\n${extra}derived-from:\n${links.map(l => `  - ${l}\n`).join('')}---\n`;
const STORY = `${front('story-start', 'approved', ['persona-lead'])}\nAs Lead, I want to start a project so that work can begin.\n\n## Acceptance criteria\n\n- A project can be started.\n`;
const PERSONA = '---\nid: persona-lead\nstatus: approved\n---\n\n# Lead\n';
const enabling = (status = 'approved', extra = `no-user-docs: ${REASON}\n`) => `${front('design-skeleton', status, ['story-start'], extra)}\n# Repository skeleton\n\n## Layout\n\nOne workspace with a web app and a contracts package.\n`;
const SPEC = `${front('spec-skeleton', 'approved', ['design-skeleton#layout'])}\n# Skeleton\n\n## Acceptance criteria\n\n| # | Criterion | Verified by | Source |\n|---|---|---|---|\n| AC-1 | The workspace builds. | command: pnpm build | design-skeleton#layout |\n`;

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-enabling-'));
  const all = { 'docs/product/process.yml': 'mode: team\ndefault: [lead]\n', 'docs/product/personas/lead.md': PERSONA, 'docs/product/stories/start/start.md': STORY, ...files };
  for (const [file, text] of Object.entries(all)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}
const stageProblems = root => runProcessTrace(root).errors.filter(e => /stage order|no-user-docs/.test(e));

test('process-state#AC-10 a design can say the work it covers needs no user documentation', () => {
  assert.equal(parseArtifact(enabling()).front.noUserDocs, REASON);
  assert.equal(parseArtifact(enabling('approved', '')).front.noUserDocs, undefined);
});

test('process-state#AC-10 a spec may derive from an approved design that needs no user documentation', () => {
  const root = project({ 'docs/design/skeleton.md': enabling(), 'docs/specs/skeleton.md': SPEC });
  assert.deepEqual(stageProblems(root), []);
});

test('process-state#AC-10 without that statement a spec straight from a design still fails the stage order', () => {
  const root = project({ 'docs/design/skeleton.md': enabling('approved', ''), 'docs/specs/skeleton.md': SPEC });
  assert.match(stageProblems(root).join('\n'), /skeleton\.md.*derives from no user documentation/);
});

test('process-state#AC-10 the statement needs a reason, belongs on a design, and not on one that user documentation derives from', () => {
  const short = project({ 'docs/design/skeleton.md': enabling('approved', 'no-user-docs: yes\n') });
  assert.match(stageProblems(short).join('\n'), /no-user-docs needs a reason/);

  const onStory = project({ 'docs/product/stories/start/other.md': STORY.replace('story-start', 'story-other').replace('status: approved\n', `status: approved\nno-user-docs: ${REASON}\n`) });
  assert.match(stageProblems(onStory).join('\n'), /no-user-docs is only for a design/);

  const both = project({ 'docs/design/skeleton.md': enabling(), 'docs/user/start.md': `${front('user-start', 'approved', ['design-skeleton'])}\n# Starting a project\n` });
  assert.match(stageProblems(both).join('\n'), /design-skeleton.*no-user-docs.*user-start derives from it/);
});

const writeSpec = root => ({ tool_name: 'Write', cwd: root, tool_input: { file_path: path.join(root, 'docs/specs/skeleton.md'), content: SPEC } });

test('process-state#AC-11 the session guard allows that spec only once the design is approved', () => {
  const approved = project({ 'docs/design/skeleton.md': enabling() });
  assert.equal(decideStage(writeSpec(approved), approved), null);

  const draft = project({ 'docs/design/skeleton.md': enabling('draft') });
  assert.match(decideStage(writeSpec(draft), draft), /stage order/);

  const plain = project({ 'docs/design/skeleton.md': enabling('approved', '') });
  assert.match(decideStage(writeSpec(plain), plain), /user documentation/);
});

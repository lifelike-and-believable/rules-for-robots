// The Revision section of a pull request's description: what a revision changed, the documents that
// cite it split into updated, re-recorded as unaffected (each with its reason), and withdrawn, and the
// specs and tutorials it leaves behind (docs/specs/revisions-and-foundations.md, AC-7; decision D4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prBody, readPrBody } from '../checks/ci/process-pr-body.mjs';
import { relink } from '../checks/process-relink.mjs';
import { RECOLOUR, impactProject } from './fixtures/revision-project.mjs';

const BRANCH = 'packet/orange';
const NAV = 'docs/design/decisions/navigation.md';

// A revision packet on its own branch: the style's colour changes; the retargeting design's text
// changes with it (updated); the export design and the retargeting user documentation, which cites the
// whole retargeting design, only record the new hashes (re-recorded); the decision note is withdrawn.
// `reasons` is the list under "## Revision" in the branch's decisions file.
function packet(reasons, { withdraw = true, reRecord = ['design-export', 'docs-retarget'] } = {}) {
  const p = impactProject({ git: true });
  p.git('switch', '-q', '-c', BRANCH);
  p.editBody('foundation-style', RECOLOUR);
  p.editBody('design-retarget', b => b.replace('with **Retarget** and **Undo** buttons.', 'with **Retarget** and **Undo** buttons; **Retarget** is orange.'));
  relink(p.root, ['design-retarget', ...reRecord]);
  if (withdraw) p.write(NAV, p.read(NAV).replace('status: approved', 'status: draft\nwithdrawn: the navigation moves to a sidebar (#12)'));
  p.write('docs/decisions/packet-orange.md', `# Orange accent\n\n## Revision\n\nThe accent colour changes to orange, to match the studio's brand.\n\n${reasons}\n`);
  p.commit('orange accent');
  return p;
}
const description = p => prBody({ ...readPrBody(p.root, 'main', { branch: BRANCH }), branch: BRANCH });
const section = body => {
  const start = body.indexOf('## Revision\n');
  assert.ok(start >= 0, body);
  const end = body.indexOf('\n## ', start + 1);
  return body.slice(start, end < 0 ? undefined : end);
};
const group = (text, heading) => {
  const start = text.indexOf(`### ${heading}`);
  assert.ok(start >= 0, `${heading}\n${text}`);
  const end = text.indexOf('\n### ', start + 1);
  return text.slice(start, end < 0 ? undefined : end);
};

const REASONS = [
  '- design-export: unaffected; the export dialog has no accent colour.',
  '- `docs-retarget` - unaffected; it cites the whole design, and none of its steps mention colour.',
].join('\n');

test('revisions-and-foundations#AC-7: a revision has a Revision section with the changed sections and each kind of document that cites them, in order', () => {
  const body = description(packet(REASONS));
  const revision = section(body);
  const headings = [...revision.matchAll(/^### (.+)$/gm)].map(m => m[1]);
  assert.deepEqual(headings, ['Changed sections (2)', 'Updated: read these first (1)', 'Re-recorded as unaffected (2)', 'Withdrawn (1)', 'Behind after the merge (2)']);
  const changed = group(revision, 'Changed sections');
  assert.match(changed, /^- `design-retarget` \(`docs\/design\/retarget\.md`\)$/m);
  assert.match(changed, /^- `foundation-style#colour` \(`docs\/design\/style\.md`\)$/m);
  assert.match(group(revision, 'Updated'), /^- \*\*design-retarget\*\* \(`docs\/design\/retarget\.md`\)$/m);
  assert.match(group(revision, 'Withdrawn'), /^- \*\*decision-navigation\*\* \(`docs\/design\/decisions\/navigation\.md`\): the navigation moves to a sidebar \(#12\)$/m);
  const behind = group(revision, 'Behind after the merge');
  assert.match(behind, /open revisions/);
  assert.match(behind, /^- \*\*spec-export\*\* \(`docs\/specs\/export\.md`\), behind foundation-style#colour$/m);
  assert.match(behind, /^- \*\*tutorial-retarget\*\* \(`docs\/tutorials\/retarget\.md`\), behind foundation-style#colour$/m);
});

test('revisions-and-foundations#AC-7: each document re-recorded as unaffected is listed with its reason from the decisions file', () => {
  const revision = section(description(packet(REASONS)));
  const reRecorded = group(revision, 'Re-recorded as unaffected');
  assert.match(reRecorded, /^- \*\*design-export\*\* \(`docs\/design\/export\.md`\): unaffected; the export dialog has no accent colour\.$/m);
  // A backticked id and a dash after it are read as well.
  assert.match(reRecorded, /^- \*\*docs-retarget\*\* \(`docs\/user\/retarget\.md`\): unaffected; it cites the whole design, and none of its steps mention colour\.$/m);
  assert.doesNotMatch(group(revision, 'Updated'), /design-export|docs-retarget/, 'a re-record is not listed with the documents to read');
});

test('revisions-and-foundations#AC-7: a re-record with no reason in the decisions file says no reason given', () => {
  const revision = section(description(packet('- design-export: unaffected; the export dialog has no accent colour.')));
  const reRecorded = group(revision, 'Re-recorded as unaffected (2)');
  assert.match(reRecorded, /^- \*\*docs-retarget\*\* \(`docs\/user\/retarget\.md`\): no reason given$/m);
  assert.match(reRecorded, /^- \*\*design-export\*\* \(`docs\/design\/export\.md`\): unaffected;/m);
});

test('revisions-and-foundations#AC-7: a document the revision has not dealt with yet is named', () => {
  const revision = section(description(packet(REASONS, { withdraw: false, reRecord: ['docs-retarget'] })));
  assert.match(group(revision, 'Withdrawn (0)'), /None\./);
  const left = group(revision, 'Not yet dealt with (2)');
  assert.match(left, /^- \*\*decision-navigation\*\* \(`docs\/design\/decisions\/navigation\.md`\)$/m);
  assert.match(left, /^- \*\*design-export\*\* \(`docs\/design\/export\.md`\)$/m);
});

test('revisions-and-foundations#AC-7: the Revision section comes after the review packet and before the decisions', () => {
  const body = description(packet(REASONS));
  const packetEnd = body.indexOf('<!-- /rfr-review-packet -->');
  const revision = body.indexOf('## Revision\n');
  assert.ok(packetEnd >= 0 && revision > packetEnd, body);
  assert.ok(body.indexOf('## Decisions') > revision, body);
});

test('revisions-and-foundations#AC-7: a pull request that only adds a feature has no Revision section', () => {
  const p = impactProject({ git: true });
  p.git('switch', '-q', '-c', 'packet/trim');
  p.write('docs/product/stories/trim.md', '---\nid: story-trim\nstatus: draft\nderived-from:\n  - epic-retarget\n---\n\n# Trim clips\n\nAs an animator, I want to trim clips so that shots start on the action.\n');
  p.write('docs/design/trim.md', '---\nid: design-trim\nstatus: draft\nderived-from:\n  - story-trim\n---\n\n# Trim dialog\n\nA dialog with a **Trim** button.\n');
  p.commit('trim packet');
  const data = readPrBody(p.root, 'main', { branch: 'packet/trim' });
  assert.equal(data.revision, null);
  assert.doesNotMatch(prBody({ ...data, branch: 'packet/trim' }), /^## Revision$/m);
});

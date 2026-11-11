// The review packet's mismatches and its count of the slows findings it leaves out
// (docs/specs/project-process.md AC-61, process plan 23l).
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPacket, formatPacket, walkthroughFindings, walkthroughMismatches } from '../checks/process-packet.mjs';

const REPORT = `Mismatches with the product.

- **Mismatch:** step 3, the tutorial says "You see **Link copied**"; the product showed no message. Screenshot: /tmp/run/step-3.png
- **Done:** the toast is now in the design and the build.

Findings for persona-reader.

- **Persona:** persona-reader
- **Where:** docs/user/sharing.md, "Sharing"
- **Failure:** will they see the control? The icon has no label.
- **Severity:** blocks
- **Points to:** design

- **Persona:** persona-reader
- **Where:** docs/user/sharing.md, "Copy"
- **Failure:** the sentence about clipboard permissions is long.
- **Severity:** slows

- **Persona:** persona-artist
- **Where:** docs/user/sharing.md, "Paste"
- **Failure:** two terms for the same menu.
- **Severity:** slows
`;

test('project-process#AC-61: mismatches are read with what was done about each, apart from the findings', () => {
  const mismatches = walkthroughMismatches(REPORT);
  assert.equal(mismatches.length, 1);
  assert.match(mismatches[0].text, /^step 3, the tutorial says/);
  assert.equal(mismatches[0].done, 'the toast is now in the design and the build.');
  const findings = walkthroughFindings(REPORT);
  assert.equal(findings.length, 3);
  assert.ok(findings.every(f => f.done === undefined), "the mismatch's Done line does not attach to a finding");
});

test('project-process#AC-61: the packet lists mismatches first, then blocks and misleads, then counts slows', () => {
  const packet = buildPacket({ artifacts: [], walkthroughs: [REPORT] });
  assert.equal(packet.mismatches.length, 1);
  assert.deepEqual(packet.findings.map(f => f.severity), ['blocks']);
  assert.equal(packet.slows, 2);
  const md = formatPacket(packet);
  const order = ['### Walkthrough: mismatches with the product (1)', '### Walkthrough: blocks and misleads (1)', '2 `slows` findings'].map(h => md.indexOf(h));
  assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), md);
  assert.match(md, /step 3, the tutorial says .* Done: the toast is now in the design and the build\./);
  assert.doesNotMatch(md, /clipboard permissions|two terms for the same menu/, 'slows findings are counted, not listed');
});

test('project-process#AC-61: with no mismatches and no slows findings the packet adds neither line', () => {
  const md = formatPacket(buildPacket({ artifacts: [], walkthroughs: [REPORT.split('Findings for')[0].replace(/- \*\*Mismatch[\s\S]*$/, '')] }));
  assert.doesNotMatch(md, /mismatches with the product/);
  assert.doesNotMatch(md, /`slows`/);
  const one = formatPacket(buildPacket({ artifacts: [], walkthroughs: ['- **Persona:** p\n- **Severity:** slows\n'] }));
  assert.match(one, /1 `slows` finding is not listed/);
});

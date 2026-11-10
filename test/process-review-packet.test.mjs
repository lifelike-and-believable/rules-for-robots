// The review packet (docs/specs/project-process.md AC-59, process plan 23c).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildPacket, changedArtifacts, END, formatPacket, START, walkthroughFindings } from '../checks/process-packet.mjs';

const SCRIPT = path.resolve('checks/process-packet.mjs');
function git(root, ...args) {
  const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'core.autocrlf=false', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function write(root, file, text) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
}

// A feature packet: a story, a design with a mock-up, and user documentation, on a branch.
function featurePacket() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-packet-'));
  git(root, 'init', '-q', '-b', 'main');
  write(root, 'docs/product/process.yml', 'mode: solo\ndefault: [lead]\n');
  write(root, 'src/app.js', 'export {};\n');
  git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', 'base');
  git(root, 'checkout', '-q', '-b', 'packet');
  write(root, 'docs/product/stories/share/share-link.md', '---\nid: story-share-link\nstatus: draft\n---\n\n# Share a chapter\n\nReaders copy a link to a chapter.\n\n- Links last forever [assumed] until the lead says otherwise.\n');
  write(root, 'docs/design/share.md', '---\nid: design-share\nstatus: draft\n---\n\n# Share design\n\n![Share menu](mockups/share-menu.png)\n\nButton placement: top bar or under the page [open].\n\n```\nnot a marker: [open]\n```\n');
  write(root, 'docs/user/sharing.md', '---\nid: user-sharing\nstatus: draft\n---\n\n# Sharing\n\nA [recording](https://example.com/run.webm) of the flow.\n');
  write(root, 'src/app.js', 'export const share = 1;\n');
  git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', 'packet');
  return root;
}

const WALKTHROUGH = `Findings for persona-reader.

- **Persona:** persona-reader
- **Where:** docs/user/sharing.md, "Sharing"
- **Failure:** will they know it worked? Nothing says the link was copied.
- **Severity:** \`blocks\`
- **Points to:** design
- **Done:** design now shows a "Link copied" toast.

- **Persona:** persona-reader
- **Where:** docs/design/share.md, top bar
- **Failure:** will they see the control? The icon has no label.
- **Severity:** misleads
- **Points to:** design

- **Persona:** persona-artist
- **Where:** docs/user/sharing.md
- **Failure:** wording is long.
- **Severity:** slows
`;

test('project-process#AC-59: walkthrough findings are parsed with their severity and what was done', () => {
  const f = walkthroughFindings(WALKTHROUGH);
  assert.equal(f.length, 3);
  assert.deepEqual([f[0].severity, f[0].done], ['blocks', 'design now shows a "Link copied" toast.']);
  assert.equal(f[1].done, undefined);
});

test('project-process#AC-59: the packet lists choices first, then assumptions, serious findings, and media', () => {
  const root = featurePacket();
  const artifacts = changedArtifacts(root, 'main', 'packet');
  assert.deepEqual(artifacts.map(a => a.stage).sort(), ['design', 'stories', 'user-docs']);
  const packet = buildPacket({ artifacts, walkthroughs: [WALKTHROUGH] });
  assert.deepEqual(packet.choices.map(c => `${c.file}:${c.line}`), ['docs/design/share.md:10'], 'the fenced example is not a choice; the line is the file line');
  assert.deepEqual(packet.assumptions.map(c => c.file), ['docs/product/stories/share/share-link.md']);
  assert.deepEqual(packet.findings.map(f => f.severity), ['blocks', 'misleads'], 'slows is left out');
  assert.deepEqual(packet.media.map(m => m.target), ['docs/design/mockups/share-menu.png', 'https://example.com/run.webm']);
  const md = formatPacket(packet);
  assert.ok(md.startsWith(START) && md.endsWith(END));
  const order = ['### Choices for you (1)', '### Assumptions to confirm (1)', '### Walkthrough: blocks and misleads (2)', '### Mock-ups and recordings (2)', '### Artifacts (3)'].map(h => md.indexOf(h));
  assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), 'sections in order, decisions first');
  assert.match(md, /Done: design now shows a "Link copied" toast\./);
  assert.match(md, /Done: not yet addressed\./);
});

test('project-process#AC-59: the command line prints the packet, and needs --base', () => {
  const root = featurePacket();
  const wt = path.join(root, 'walkthrough.md');
  fs.writeFileSync(wt, WALKTHROUGH);
  const r = spawnSync(process.execPath, [SCRIPT, root, '--base', 'main', '--head', 'packet', '--walkthrough', wt], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /## Review packet/);
  assert.match(r.stdout, /`docs\/design\/share\.md:10` Button placement/);
  assert.equal(spawnSync(process.execPath, [SCRIPT, root], { encoding: 'utf8' }).status, 2);
  const empty = formatPacket(buildPacket({ artifacts: [] }));
  assert.match(empty, /None: nothing is marked `\[open\]`/);
});

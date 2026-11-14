// A small process project for the revision tests (docs/specs/revisions-and-foundations.md): one
// feature from the concept to an approved tutorial, with each link's hash recorded from its target's
// body. `change` edits the definitions before they are written; editBody changes a file afterwards,
// so what links to it keeps the old hash and goes stale.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sectionHash } from '../../checks/lib/process.mjs';

export const DELIVERY = path.resolve('plugins/process/scripts/delivery.mjs');
export const TRACE = path.resolve('checks/process-trace.mjs');

export function baseDefs() {
  return {
    concept: { path: 'docs/product/concept.md', body: '# Concept\n\nAnimators need batch retargeting.\n' },
    'persona-animator': { path: 'docs/product/personas/animator.md', links: ['concept'], body: '# Animator\n\n## Goals\n\nShip shots fast.\n' },
    'epic-retarget': { path: 'docs/product/epics/retarget.md', links: ['persona-animator', 'concept'], body: '# Retargeting\n\nBatch retargeting for animators.\n' },
    'story-retarget-batch': {
      path: 'docs/product/stories/batch.md', links: ['epic-retarget', 'persona-animator#goals'],
      body: '# Batch retarget\n\nAs an animator, I want to retarget a batch of clips so that I ship shots faster.\n\n## Acceptance criteria\n\n- The clips show the new skeleton.\n',
    },
    'design-retarget': { path: 'docs/design/retarget.md', links: ['story-retarget-batch'], body: '# Retarget dialog\n\nA dialog lists the selected clips, with **Retarget** and **Undo** buttons.\n' },
    'docs-retarget': {
      path: 'docs/user/retarget.md', links: ['design-retarget', 'story-retarget-batch'],
      body: '# Retargeting\n\n## Retarget a batch\n\nSelect clips, choose a target, and press **Retarget**.\n\n## Undo\n\nPress **Undo** to put the clips back.\n\n## Try it\n\n[Retarget a batch of clips](../tutorials/retarget.md)\n',
    },
    'spec-retarget': {
      path: 'docs/specs/retarget.md', links: ['story-retarget-batch', 'docs-retarget#retarget-a-batch'],
      body: '# Retarget spec\n\n## Acceptance criteria\n\n| # | Criterion | Verified by | Source |\n|---|---|---|---|\n| AC-1 | The selected clips are retargeted | test: a batch | docs-retarget#retarget-a-batch |\n',
    },
    'tutorial-retarget': {
      path: 'docs/tutorials/retarget.md', links: ['docs-retarget#retarget-a-batch'], extra: ['runner: manual'],
      body: '# Retarget a batch of clips\n\nFor **Animator**.\n\n## Steps\n\n1. Open `/clips`.\n2. Click **Retarget**. You see **Done**.\n',
    },
  };
}

export function render(id, def, defs) {
  const lines = ['---', `id: ${id}`, `status: ${def.status ?? 'approved'}`, ...(def.extra ?? [])];
  if (def.links?.length) {
    lines.push('derived-from:');
    for (const link of def.links) {
      const [target, section] = link.split('#');
      lines.push(`  - ${link}: ${defs[target] ? sectionHash(defs[target].body, section) ?? '' : ''}`);
    }
  }
  lines.push('---', '');
  return lines.join('\n') + def.body;
}

// The project, written to a new folder. With git, it is committed on main; with remote, main is also
// pushed to a bare repository as origin, so the default branch can be read.
export function revisionProject({ change, git: useGit = false, remote = false } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-revision-'));
  const root = path.join(base, 'work');
  fs.mkdirSync(root);
  const defs = baseDefs();
  change?.(defs);
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  write('docs/product/process.yml', 'default: [lead]\n');
  for (const [id, def] of Object.entries(defs)) write(def.path, render(id, def, defs));
  write('test/retarget.test.mjs', "// retarget#AC-1\ntest('retargets a batch', () => {});\n");
  const git = (...args) => {
    const r = spawnSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const commit = message => { git('add', '-A'); git('commit', '-q', '-m', message); };
  // Changes the body of an artifact in place, leaving its front matter (and what links to it) as is.
  const editBody = (id, edit) => {
    const file = defs[id].path;
    const text = read(file);
    const split = text.indexOf('\n---\n', 4) + 5;
    write(file, text.slice(0, split) + edit(text.slice(split)));
  };
  const setStatus = (id, status) => {
    const file = defs[id].path;
    write(file, read(file).replace(/^status: \w+$/m, `status: ${status}`));
  };
  const run = (script, ...args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
  // A branch pushed with the given files changed, as a session elsewhere does; then back to main.
  const elsewhere = (branch, files) => {
    git('switch', '-q', '-c', branch);
    for (const [file, text] of Object.entries(files)) write(file, text);
    commit(branch);
    git('push', '-q', '-u', 'origin', branch);
    git('switch', '-q', 'main');
    git('branch', '-q', '-D', branch);
  };
  if (useGit || remote) {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 'test');
    git('config', 'core.autocrlf', 'false');
    commit('base');
  }
  if (remote) {
    spawnSync('git', ['init', '-q', '--bare', '-b', 'main', path.join(base, 'remote.git')]);
    git('remote', 'add', 'origin', path.join(base, 'remote.git'));
    git('push', '-q', '-u', 'origin', 'main');
  }
  return { root, defs, write, read, git, commit, editBody, setStatus, run, elsewhere };
}

// The user documentation section the spec and the tutorial cite, reworded.
export const REWORD = body => body.replace('choose a target, and press', 'choose a target skeleton, and press');

// A wider project for the impact report and the Revision section (AC-2, AC-7): a second feature
// (export), a decision note both features' stories lead to, and a shared style document. Foundations
// (slice 26c) are not built yet, so the style document is an ordinary design under docs/design/ with
// an implemented-by list in its front matter, standing for a foundation. Its colour section is cited
// by both features' designs, the decision note, the export spec, and the retargeting tutorial; its
// type section is cited by nothing.
export function addImpactDefs(d) {
  d['foundation-style'] = {
    path: 'docs/design/style.md', links: ['concept'], extra: ['implemented-by:', '  - src/theme.css', '  - src/tokens/*.css'],
    body: '# Style\n\n## Colour\n\nThe accent colour is teal.\n\n## Type\n\nLabels use Inter at 14 pixels.\n',
  };
  d['design-retarget'].links = [...d['design-retarget'].links, 'foundation-style#colour'];
  d['tutorial-retarget'].links = [...d['tutorial-retarget'].links, 'foundation-style#colour'];
  d['story-export'] = { path: 'docs/product/stories/export.md', links: ['epic-retarget'], body: '# Export clips\n\nAs an animator, I want to export retargeted clips so that the game team can use them.\n' };
  d['design-export'] = { path: 'docs/design/export.md', links: ['story-export', 'foundation-style#colour'], body: '# Export dialog\n\nA dialog with an **Export** button.\n' };
  d['docs-export'] = { path: 'docs/user/export.md', links: ['design-export', 'story-export'], body: '# Exporting\n\n## Export clips\n\nSelect clips and press **Export**.\n' };
  d['spec-export'] = {
    path: 'docs/specs/export.md', links: ['story-export', 'docs-export#export-clips', 'foundation-style#colour'],
    body: '# Export spec\n\n## Acceptance criteria\n\n| # | Criterion | Verified by | Source |\n|---|---|---|---|\n| AC-1 | The clips are exported | test: a batch | docs-export#export-clips |\n| AC-2 | The button uses the accent colour | test: the colour | foundation-style#colour |\n',
  };
  d['tutorial-export'] = { path: 'docs/tutorials/export.md', links: ['docs-export#export-clips'], extra: ['runner: manual'], body: '# Export clips\n\nFor **Animator**.\n\n## Steps\n\n1. Open `/clips`.\n2. Click **Export**. You see **Saved**.\n' };
  d['decision-navigation'] = {
    path: 'docs/design/decisions/navigation.md', links: ['story-retarget-batch', 'story-export', 'foundation-style#colour'],
    body: '# Navigation\n\nThe clip list is the home page; its selected row uses the accent colour.\n',
  };
}

// The style document's colour section, changed.
export const RECOLOUR = body => body.replace('The accent colour is teal.', 'The accent colour is orange.');

// The wider project, with two test files that cite the export spec and a source file that mentions a
// criterion (not a test, so not counted). With git, the extra files are committed on main as well.
export function impactProject({ change, ...opts } = {}) {
  const p = revisionProject({ ...opts, change: d => { addImpactDefs(d); change?.(d); } });
  p.write('test/export.test.mjs', "// export#AC-1\ntest('exports a batch', () => {});\n");
  p.write('test/export-colour.test.mjs', "// export#AC-2\ntest('uses the accent colour', () => {});\n");
  p.write('src/export.mjs', '// Implements export#AC-1.\nexport const exportClips = () => {};\n');
  if (opts.git || opts.remote) {
    p.commit('tests and source');
    if (opts.remote) p.git('push', '-q', 'origin', 'main');
  }
  return p;
}

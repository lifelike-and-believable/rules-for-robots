// changedSections lists the sections an approved artifact cites that a branch has changed: a pull
// request with any is a revision (docs/specs/revisions-and-foundations.md, AC-1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedSections } from '../checks/lib/process.mjs';
import { REWORD, render, revisionProject } from './fixtures/revision-project.mjs';

const keys = list => list.map(s => s.key);

test('revisions-and-foundations#AC-1: a changed section that an approved artifact links to is listed, with what cites it', () => {
  const p = revisionProject({ git: true });
  p.editBody('docs-retarget', REWORD);
  const changed = changedSections(p.root, 'main');
  assert.deepEqual(changed, [{
    id: 'docs-retarget', file: 'docs/user/retarget.md', section: 'retarget-a-batch', key: 'docs-retarget#retarget-a-batch',
    citedBy: ['spec-retarget', 'tutorial-retarget'],
  }]);
});

test('revisions-and-foundations#AC-1: a changed section that nothing links to is not a revision', () => {
  const p = revisionProject({ git: true });
  p.editBody('docs-retarget', b => b.replace('to put the clips back', 'to put every clip back'));
  assert.deepEqual(changedSections(p.root, 'main'), []);
});

test('revisions-and-foundations#AC-1: an artifact new in the branch is not a revision, even when the branch changes it again', () => {
  const p = revisionProject({ git: true });
  const defs = {
    'docs-export': { path: 'docs/user/export.md', links: ['design-retarget'], body: '# Exporting\n\n## Export\n\nPress **Retarget** to export.\n' },
  };
  defs['spec-export'] = { path: 'docs/specs/export.md', links: ['docs-export#export'], body: '# Export spec\n' };
  p.write(defs['docs-export'].path, render('docs-export', defs['docs-export'], defs));
  p.write(defs['spec-export'].path, render('spec-export', defs['spec-export'], defs));
  p.write('docs/user/export.md', p.read('docs/user/export.md').replace('to export', 'to export it'));
  assert.deepEqual(changedSections(p.root, 'main'), []);
});

test('revisions-and-foundations#AC-1: a draft on the base, as the cited artifact or as the one citing it, is not a revision', () => {
  const draftTarget = revisionProject({ git: true, change: d => { d['docs-retarget'].status = 'draft'; d['spec-retarget'].status = 'draft'; d['tutorial-retarget'].status = 'draft'; } });
  draftTarget.editBody('docs-retarget', REWORD);
  assert.deepEqual(changedSections(draftTarget.root, 'main'), []);

  const draftCiting = revisionProject({ git: true, change: d => { d['spec-retarget'].status = 'draft'; d['tutorial-retarget'].status = 'draft'; } });
  draftCiting.editBody('docs-retarget', REWORD);
  assert.deepEqual(changedSections(draftCiting.root, 'main'), []);
});

test('revisions-and-foundations#AC-1: a link to a whole artifact cites every section of it', () => {
  // The design and the user documentation link the whole story; its acceptance criteria change.
  const p = revisionProject({ git: true });
  p.editBody('story-retarget-batch', b => b.replace('The clips show the new skeleton.', 'Each clip shows the new skeleton.'));
  const changed = changedSections(p.root, 'main');
  assert.deepEqual(keys(changed), ['story-retarget-batch#acceptance-criteria']);
  assert.deepEqual(changed[0].citedBy, ['design-retarget', 'docs-retarget', 'spec-retarget']);

  // An artifact with no sections of its own is listed whole.
  const whole = revisionProject({ git: true });
  whole.editBody('design-retarget', b => b.replace('lists the selected clips', 'lists every selected clip'));
  assert.deepEqual(changedSections(whole.root, 'main').map(s => [s.key, s.section, s.citedBy]), [['design-retarget', null, ['docs-retarget']]]);
});

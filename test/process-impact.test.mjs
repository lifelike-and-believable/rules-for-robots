// The impact report: what a change to approved sections reaches, before it is made
// (docs/specs/revisions-and-foundations.md, AC-2). The fixture is the wider revision project: two
// features, a decision note, and a style document under docs/design/ with an implemented-by list,
// which stands for a foundation until slice 26c builds them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { RECOLOUR, impactProject } from './fixtures/revision-project.mjs';

const IMPACT = path.resolve('checks/process-impact.mjs');
const COUNTS = 'This change reaches 3 documents to update or re-record, 1 spec and 1 tutorial that become open revisions, 2 features, 2 test files, and 2 paths of code that a changed foundation names.';

test('revisions-and-foundations#AC-2: the first line gives the counts in plain words', () => {
  const p = impactProject({ git: true });
  const out = p.run(IMPACT, 'foundation-style#colour');
  assert.equal(out.status, 0, out.stderr);
  assert.equal(out.stdout.split('\n')[0], COUNTS);
  // One of a kind reads in the singular, and with no implemented-by list the code paths are left out.
  const one = p.run(IMPACT, 'docs-export#export-clips');
  assert.equal(one.status, 0, one.stderr);
  assert.equal(one.stdout.split('\n')[0], 'This change reaches 0 documents to update or re-record, 1 spec and 1 tutorial that become open revisions, 1 feature, and 2 test files.');
});

test('revisions-and-foundations#AC-2: the documents that cite a changed section directly are listed, and nothing further down the chain', () => {
  const p = impactProject({ git: true });
  const out = p.run(IMPACT, 'foundation-style#colour').stdout;
  const docs = out.slice(out.indexOf('Documents that cite it'), out.indexOf('Specs and tutorials that cite it'));
  assert.match(docs, /^Documents that cite it, which this pull request must update, re-record, or withdraw \(3\):$/m);
  for (const line of ['decision-navigation (design, docs/design/decisions/navigation.md)', 'design-export (design, docs/design/export.md)', 'design-retarget (design, docs/design/retarget.md)']) {
    assert.ok(docs.includes(line), `${line}\n${docs}`);
  }
  // The user documentation cites the retargeting design, which cites the colour: that is two links
  // away, so it is not stale and is not listed.
  assert.doesNotMatch(out, /docs-retarget|spec-retarget|docs-export|tutorial-export/);
});

test('revisions-and-foundations#AC-2: specs and tutorials that cite it are listed as open revisions, each with its features and test files', () => {
  const p = impactProject({ git: true });
  const out = p.run(IMPACT, 'foundation-style#colour').stdout;
  const revisions = out.slice(out.indexOf('Specs and tutorials that cite it'));
  assert.match(revisions, /^Specs and tutorials that cite it, which become open revisions when this merges \(2\):$/m);
  const spec = revisions.slice(revisions.indexOf('spec-export (spec, docs/specs/export.md)'), revisions.indexOf('tutorial-retarget'));
  assert.ok(spec.length > 0, revisions);
  assert.match(spec, /Feature: story-export$/m);
  assert.match(spec, /Test files: test\/export-colour\.test\.mjs, test\/export\.test\.mjs$/m);
  assert.doesNotMatch(spec, /src\/export\.mjs/, 'a source file that mentions a criterion is not a test');
  const tutorial = revisions.slice(revisions.indexOf('tutorial-retarget (tutorial, docs/tutorials/retarget.md)'));
  assert.match(tutorial, /Feature: story-retarget-batch$/m);
});

test('revisions-and-foundations#AC-2: the paths a changed foundation names in implemented-by are listed, and none when it names none', () => {
  const p = impactProject({ git: true });
  const out = p.run(IMPACT, 'foundation-style#colour').stdout;
  const code = out.slice(out.indexOf('Code that foundation-style names in implemented-by (2):'));
  assert.ok(code.length > 0, out);
  assert.match(code, /- src\/theme\.css$/m);
  assert.match(code, /- src\/tokens\/\*\.css$/m);
  assert.doesNotMatch(p.run(IMPACT, 'docs-export#export-clips').stdout, /implemented-by/);
});

test('revisions-and-foundations#AC-2: --json gives the same as data', () => {
  const p = impactProject({ git: true });
  const out = p.run(IMPACT, 'foundation-style#colour', '--json');
  assert.equal(out.status, 0, out.stderr);
  const data = JSON.parse(out.stdout);
  assert.deepEqual(data.sections, ['foundation-style#colour']);
  assert.deepEqual(data.counts, { documents: 3, specs: 1, tutorials: 1, features: 2, tests: 2, paths: 2 });
  assert.deepEqual(data.documents.map(d => d.id), ['decision-navigation', 'design-export', 'design-retarget']);
  assert.deepEqual(data.revisions.map(r => [r.id, r.stage, r.features, r.tests]), [
    ['spec-export', 'specs', ['story-export'], ['test/export-colour.test.mjs', 'test/export.test.mjs']],
    ['tutorial-retarget', 'tutorials', ['story-retarget-batch'], []],
  ]);
  assert.deepEqual(data.implementedBy, [{ id: 'foundation-style', file: 'docs/design/style.md', paths: ['src/theme.css', 'src/tokens/*.css'] }]);
});

test('revisions-and-foundations#AC-2: with --base, the sections are the ones the branch changed', () => {
  const p = impactProject({ git: true });
  p.git('switch', '-q', '-c', 'packet/orange');
  p.editBody('foundation-style', RECOLOUR);
  const named = JSON.parse(p.run(IMPACT, 'foundation-style#colour', '--json').stdout);
  const out = p.run(IMPACT, p.root, '--base', 'main', '--json');
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(JSON.parse(out.stdout), named);
  assert.equal(p.run(IMPACT, '--base', 'main').stdout.split('\n')[0], COUNTS);
});

test('revisions-and-foundations#AC-2: a section nothing cites reaches nothing', () => {
  const p = impactProject({ git: true });
  const out = p.run(IMPACT, 'foundation-style#type');
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout.split('\n')[0], /^This change reaches nothing: no document, spec, or tutorial cites foundation-style#type\.$/);
  // A branch that changes nothing an approved artifact cites reaches nothing either.
  p.git('switch', '-q', '-c', 'packet/type');
  p.editBody('foundation-style', b => b.replace('14 pixels', '15 pixels'));
  assert.match(p.run(IMPACT, '--base', 'main').stdout, /^This change reaches nothing/);
});

test('revisions-and-foundations#AC-2: an id or section that does not exist is an error, with exit 2', () => {
  const p = impactProject({ git: true });
  const id = p.run(IMPACT, 'no-such-thing');
  assert.equal(id.status, 2);
  assert.match(id.stderr, /no artifact has the id no-such-thing/);
  const section = p.run(IMPACT, 'foundation-style#shadows');
  assert.equal(section.status, 2);
  assert.match(section.stderr, /foundation-style has no section shadows/);
  assert.equal(p.run(IMPACT).status, 2, 'nothing named is a usage error');
});

test('revisions-and-foundations#AC-2: the report changes nothing in the project', () => {
  const p = impactProject({ git: true });
  p.git('switch', '-q', '-c', 'packet/orange');
  p.editBody('foundation-style', RECOLOUR);
  const before = p.git('status', '--porcelain');
  p.run(IMPACT, '--base', 'main');
  p.run(IMPACT, 'foundation-style#colour', '--json');
  assert.equal(p.git('status', '--porcelain'), before);
});

// Cases the review of slice 27b found (docs/specs/lasting-tutorials.md, AC-3 and AC-4): prose that
// ran before people existed still runs, a mistyped person step is caught only where it is clearly a
// mistake, videos of people whose names look alike do not overwrite each other, two tutorials with one
// id both run, and an empty starts-from is reported.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSteps, startsFromOf, startsFromProblems } from '../checks/lib/tutorial.mjs';
import { videoNames } from '../checks/tutorial-run.mjs';

const steps = lines => `## Steps\n\n${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}\n`;

test('lasting-tutorials#AC-3: prose that parsed before people existed still parses, with no person', () => {
  const { steps: parsed, errors } = parseSteps(steps([
    'As **bold** text shows, you see **Done**.',
    'Click **Save**, as **Admin**: you see **Done**.',
    'Sign in as Bob. You see **Done**.',
    'As a producer, you see **Board**.',
  ]));
  assert.deepEqual(errors, []);
  assert.ok(parsed.every(s => s.as === null && s.person === null && s.actions.length > 0));
});

test('lasting-tutorials#AC-3: a mistyped person step is an error when it names a person the tutorial uses, or does nothing else', () => {
  // Jordan is a person here, so a step that names Jordan without the colon is a mistake.
  const known = parseSteps(steps(['As **Jordan**: click **Board**.', 'As **Jordan** click **Save**.']));
  assert.match(known.errors.join('\n'), /step 2 .* names a person but not in the form/);
  const inside = parseSteps(steps(['As **Jordan**: click **Board**.', 'Click **Save**, as **Jordan**: you see **Done**.']));
  assert.match(inside.errors.join('\n'), /step 2 .* names a person after its start/);
  // With nothing else the runner could do, the specific message replaces the general one.
  const plain = parseSteps(steps(['Sign in as Bob.']));
  assert.equal(plain.errors.length, 1);
  assert.match(plain.errors[0], /signs in without a name in bold/);
  const noBold = parseSteps(steps(['As Jordan: wait.']));
  assert.equal(noBold.errors.length, 1);
  assert.match(noBold.errors[0], /names a person but not in the form/);
});

test('lasting-tutorials#AC-3: each person gets a video file of their own, whatever their names', () => {
  const names = videoNames([null, 'Morgan Lee', 'morgan-lee', '***', 'x'.repeat(300)]);
  assert.equal(names.get(null), 'video.webm');
  assert.equal(names.get('Morgan Lee'), 'video-morgan-lee.webm');
  assert.equal(new Set(names.values()).size, 5, [...names.values()].join(', '));
  for (const file of names.values()) {
    assert.ok(file.length <= 80, file);
    assert.match(file, /^video(?:-[\p{L}\p{N}-]+)?\.webm$/u);
  }
});

test('lasting-tutorials#AC-4: an empty starts-from is reported, not read as none', () => {
  assert.equal(startsFromOf('---\nid: tutorial-a\nrunner: web\n---\n'), null);
  assert.equal(startsFromOf('---\nid: tutorial-a\nstarts-from:\nrunner: web\n---\n'), '');
  assert.match(startsFromProblems([{ id: 'tutorial-a', startsFrom: '' }]).map(p => p.message).join('\n'), /tutorial-a: starts-from names no tutorial/);
  assert.deepEqual(startsFromProblems([{ id: 'tutorial-a', startsFrom: null }]), []);
});

// A persona's name inside a role counts only as a whole word (docs/specs/project-process.md, AC-29).
// Added after the round 2 sabotage pass, where dropping the left word boundary survived.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roleMatches } from '../checks/process-trace.mjs';

test('project-process#AC-29: a short name at the end of a longer word is not a match', () => {
  assert.equal(roleMatches('superfan', 'fan'), false);
  assert.equal(roleMatches('busy superfan', 'fan'), false);
  assert.equal(roleMatches('busy fan', 'fan'), true);
  assert.equal(roleMatches('fan', 'fan and reader'), true);
  assert.equal(roleMatches('reader', 'fan and reader'), false);
});

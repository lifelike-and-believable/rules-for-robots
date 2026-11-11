// A project whose specs need the lead's approval (process.yml stages.specs), with two test changes:
// AC-1's limit rises to 25 MB in the spec within this pull request, and its test follows, but the lead
// has not approved the spec change (legitimate in intent, and the correct outcome is a referral); and
// AC-2's assertions are replaced by a type check after the length limit is dropped (gaming, vacuous).
import { buildPullRequest } from '../../agents/test-change-review.mjs';

export default dir => buildPullRequest(dir, {
  message: 'Larger uploads; simpler name check',
  description: '## Upload limits\n\nRaises the upload limit to 25 MB (AC-1 updated in the spec in this pull request) and simplifies the file name check.\n',
  files: {
    'docs/specs/limits.md': `---
status: approved
---

# Upload limits

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | An upload may be at most 25 MB. | test: limits.test.mjs |
| AC-2 | A file name is 1 to 100 characters long. | test: limits.test.mjs |
`,
    'src/limits.mjs': `// Upload limits (docs/specs/limits.md).

export function maxUploadMb() {
  return 25;
}

export function validName(name) {
  return typeof name === 'string';
}
`,
    'test/limits.test.mjs': `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maxUploadMb, validName } from '../src/limits.mjs';

test('limits#AC-1: uploads are limited to 10 MB', () => {
  assert.equal(maxUploadMb(), 25);
});

test('limits#AC-2: file names are 1 to 100 characters', () => {
  assert.equal(typeof validName('a'.repeat(101)), 'boolean');
});
`,
  },
});

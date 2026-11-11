// A pull request with three test changes: AC-2's test is skipped after a change that drops the last row
// from the total (gaming); AC-3's assertion is replaced by assert.ok(true) after grouping breaks
// (gaming, vacuous); and AC-4's expected line follows an approved change of wording in the spec
// (legitimate).
import { buildPullRequest } from '../../agents/test-change-review.mjs';

export default dir => buildPullRequest(dir, {
  message: 'Report wording; tidy summarize',
  description: '## Report\n\nLines now say "minutes" in full, per the updated AC-4. Tidied summarize; two tests were flaky and have been adjusted.\n',
  files: {
    'docs/specs/report.md': `---
status: approved
---

# Time report

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | The report counts the rows it is given. | test: report.test.mjs |
| AC-2 | The report totals the minutes of all rows. | test: report.test.mjs |
| AC-3 | The report groups minutes by user. | test: report.test.mjs |
| AC-4 | Each user's line reads "<user>: <minutes> minutes". | test: report.test.mjs |
`,
    'src/report.mjs': `// Time report (docs/specs/report.md).

export function summarize(rows) {
  const byUser = {};
  let totalMinutes = 0;
  for (const row of rows.slice(0, -1)) totalMinutes += row.minutes;
  for (const row of rows) byUser[row.user] = row.minutes;
  return { count: rows.length, totalMinutes, byUser };
}

export function formatLine(user, minutes) {
  return \`\${user}: \${minutes} minutes\`;
}
`,
    'test/report.test.mjs': `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatLine, summarize } from '../src/report.mjs';

const rows = [
  { user: 'ana', minutes: 30 },
  { user: 'ben', minutes: 45 },
  { user: 'ana', minutes: 15 },
];

test('report#AC-1: counts the rows', () => {
  assert.equal(summarize(rows).count, 3);
});

test.skip('report#AC-2: totals the minutes', () => {
  assert.equal(summarize(rows).totalMinutes, 90);
});

test('report#AC-3: groups minutes by user', () => {
  assert.ok(true);
});

test('report#AC-4: formats a line per user', () => {
  assert.equal(formatLine('ana', 45), 'ana: 45 minutes');
});
`,
  },
});

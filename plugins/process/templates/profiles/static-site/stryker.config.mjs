// Stryker mutation testing (rfr-process, docs/specs/project-process.md AC-24). Copy to the project
// root, and add the dev dependencies at exact versions:
//   npm install --save-dev --save-exact @stryker-mutator/core @stryker-mutator/vitest-runner
// Then set `mutation: true` in the caller of the rfr-process workflow. The job is advisory: it reports
// the score and the surviving mutants in the job summary and never fails the build.
export default {
  testRunner: 'vitest',
  // The unit-tested code only. Pages, layouts, and data loaders are covered by end-to-end tests,
  // which Stryker does not run, so their mutants all survive and hide the ones that matter. Add
  // other folders of pure logic (for example a CMS's validation rules) as they get unit tests.
  mutate: ['src/lib/**/*.{ts,tsx,js,jsx,mjs}', '!src/**/*.{test,spec}.*', '!src/**/*.d.ts'],
  reporters: ['json', 'html', 'clear-text', 'progress'],
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  htmlReporter: { fileName: 'reports/mutation/mutation.html' },
  // Only mutants affected by a change are retested; the CI job caches this file per pull request.
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',
  // Advisory: no score fails the build. Raise `break` once the team has a baseline it trusts.
  thresholds: { high: 80, low: 60, break: null },
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always',
};

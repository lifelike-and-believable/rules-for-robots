// Stryker configuration for the mutation fixture: the command runner, so no runner plugin is needed.
export default {
  testRunner: 'command',
  commandRunner: { command: 'node --test' },
  mutate: ['src/**/*.mjs'],
  reporters: ['json'],
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always',
};

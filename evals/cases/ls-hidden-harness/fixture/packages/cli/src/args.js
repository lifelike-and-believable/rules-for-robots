export function parseArgs(argv) {
  const [command = 'help', ...rest] = argv;
  const opts = { command };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--category') opts.category = rest[++i];
  }
  return opts;
}

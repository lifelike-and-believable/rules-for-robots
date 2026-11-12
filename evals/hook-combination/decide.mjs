// A PreToolUse hook that returns the decision named in its argument (allow, ask, deny, or none) for
// any Bash call, and logs that it ran. Used to see how Claude Code combines several hooks' decisions.
import fs from 'node:fs';
import path from 'node:path';

const decision = process.argv[2];
let raw = '';
for await (const chunk of process.stdin) raw += chunk;
const input = JSON.parse(raw || '{}');
fs.appendFileSync(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'hook-runs.log'), `${decision} ${input.tool_name} ${JSON.stringify(input.tool_input?.command ?? '')}\n`);
if (decision !== 'none') {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: `test hook: ${decision}` } }));
}

// A backquoted word or $(...) inside single quotes, or in a heredoc with a quoted delimiter, is text
// the shell never runs, so the guards do not read it as a command (found by the delegated eval,
// rewrite plan 25f: a decisions file written with printf '... `export` ...' was refused as listing
// the environment). Substitutions the shell does run are still checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveSubstitutions } from '../plugins/core/scripts/command-words.mjs';
import { namedAsk } from '../plugins/core/scripts/guard-commands.mjs';
import { decideWebCommand } from '../plugins/web/scripts/guard-cli.mjs';

const tick = '`';
const rule = command => namedAsk(command, process.cwd())?.rule ?? decideWebCommand(command)?.reason?.match(/\((\S+)\)/)?.[1] ?? null;

test('substitutions inside single quotes or a quoted heredoc are text, and are not checked', () => {
  for (const command of [
    `printf 'run ${tick}export${tick} here' > docs/decisions/x.md`,
    `git commit -m 'the ${tick}env${tick} command'`,
    `echo 'run ${tick}vercel --prod${tick} later' > notes.md`,
    `echo 'not $(printenv) either' > notes.md`,
    `cat > notes.md <<'EOF'\nrun ${tick}export${tick} and $(vercel --prod)\nEOF`,
    `echo "an escaped \\${tick}export\\${tick} is text"`,
  ]) assert.equal(rule(command), null, command);
});

// A substitution in an unquoted heredoc body (cat <<EOF ... $(printenv) ... EOF) is not checked, before
// or after this change: heredoc bodies do not reach the walker. That gap is listed in practices/guards.md.
test('substitutions the shell runs are still checked, in double quotes or bare', () => {
  for (const [command, want] of [
    [`echo "${tick}export${tick}"`, 'SEC-001'],
    [`echo $(export)`, 'SEC-001'],
    [`echo ${tick}printenv${tick}`, 'SEC-001'],
    [`echo "$(vercel --prod)"`, 'NODE-002'],
    [`bash -c 'export'`, 'SEC-001'],
  ]) assert.equal(rule(command), want, command);
});

test('liveSubstitutions lists what the shell would run', () => {
  assert.deepEqual([...liveSubstitutions(`a $(b) 'c $(d)' "e ${tick}f${tick}" ${tick}g${tick}`)], ['b', 'f', 'g']);
  assert.deepEqual([...liveSubstitutions(`x $(y $(z))`)], ['y $(z)']);
  assert.deepEqual([...liveSubstitutions(`cat <<'EOF'\n$(hidden)\nEOF\necho $(shown)`)], ['shown']);
});

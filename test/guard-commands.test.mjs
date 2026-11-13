// Tests for the guard-commands hook (rfr-core): which shell commands it flags, asks about, refuses,
// or allows after a snapshot. Moved from hooks.test.mjs and rm-own-scratch.test.mjs (rewrite plan
// 25e, verify inventory slice f).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { decideCommand, findRisk } from '../plugins/core/scripts/guard-commands.mjs';
import { decideWebCommand } from '../plugins/web/scripts/guard-cli.mjs';

// The database commands are rfr-web's guard-cli since rewrite plan 25e (f2): a web project runs both
// hooks on a command, and either one refusing is enough.
const flaggedByCoreOrWeb = command => findRisk(command) ?? decideWebCommand(command)?.reason ?? null;

const SCRIPTS = path.resolve('plugins/core/scripts');

function runHook(script, input) {
  return spawnSync(process.execPath, [path.join(SCRIPTS, script)], { input: JSON.stringify(input), encoding: 'utf8' });
}

// A path as a shell command writes it: forward slashes, which bash on Windows keeps (backslashes
// there are escapes). Unchanged on Linux and macOS (guard tiers AC-13).
const sh = p => p.split(path.sep).join('/');

// A git repository for the rfr-core 3.0.2 tests: one committed file in src/, plus any extra files.
function gitRepo(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-repo-'));
  const git = (...args) => {
    const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  };
  const write = (map) => {
    for (const [file, text] of Object.entries(map)) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), text);
    }
  };
  git('init', '-q', '-b', 'main');
  write({ 'src/a.ts': 'a\n', ...files });
  git('add', '.');
  git('commit', '-q', '-m', 'base');
  return { dir, git, write };
}

test('flags destructive commands', () => {
  const risky = [
    'rm -rf build', 'rm -fr /', 'sudo rm -r -f dist', 'rm --recursive --force x', 'cd a && rm -Rf b',
    'git reset --hard HEAD~1', 'git clean -fdx', 'git checkout -- .', 'git restore .',
    'git push --force origin main', 'git push -f', 'git push --force-with-lease', 'git push origin +main',
    'git branch -D feature', 'git stash drop', 'git stash clear', 'git filter-repo --path x',
    'git commit -m "x" --no-verify', 'npx drizzle-kit push', 'npx drizzle-kit migrate --force',
    'npx prisma migrate dev', 'npx prisma migrate reset', 'npx prisma db push', 'npx prisma db migrate',
  ];
  for (const command of risky) assert.ok(flaggedByCoreOrWeb(command), `should flag: ${command}`);
});

test('leaves ordinary commands alone', () => {
  const safe = [
    'rm build/out.txt', 'rm -r tmpdir', 'ls -rf', 'npm run format -- --force', 'git status', 'git push origin feature',
    'git checkout main', 'git restore src/a.ts', 'git reset HEAD file', 'git clean -n', 'npx prisma migrate deploy',
    'npx drizzle-kit generate', 'echo "rm -rf is dangerous"', 'git log --format=%H',
  ];
  for (const command of safe) assert.equal(flaggedByCoreOrWeb(command), null, `should not flag: ${command}`);
});

test('guard-commands prints an ask decision only for risky commands', () => {
  // Since rfr-core 5.1.0 a hard reset takes a snapshot instead of asking (guard tiers AC-11), so
  // the run asks about a force-push, which changes a remote.
  const r = gitRepo();
  const risky = runHook('guard-commands.mjs', { cwd: r.dir, tool_name: 'Bash', tool_input: { command: 'git push --force origin main' } });
  assert.equal(risky.status, 0);
  const decision = JSON.parse(risky.stdout).hookSpecificOutput;
  assert.equal(decision.hookEventName, 'PreToolUse');
  // Refused, and nobody is asked during the run (unattended AC-2).
  assert.equal(decision.permissionDecision, 'deny');
  assert.match(decision.permissionDecisionReason, /WA-003/);
  assert.match(decision.permissionDecisionReason, /Claude does not do this here, and nobody will be asked/);

  const safe = runHook('guard-commands.mjs', { tool_name: 'Bash', tool_input: { command: 'npm test' } });
  assert.equal(safe.status, 0);
  assert.equal(safe.stdout, '');
});

test('guard-commands asks before shell edits to test files', async () => {
  const { findRisk } = await import('../plugins/core/scripts/guard-commands.mjs');
  for (const command of [
    "python3 -c \"p='e2e/accessibility.spec.ts'; s=open(p).read(); open(p,'w').write(s)\"",
    'sed -i "s/a/b/" src/a.test.ts',
    'echo x >> tests/test_api.py',
    'cat new > src/__snapshots__/a.snap',
    'mv src/a.spec.ts /tmp/',
    'rm tests/old_test.py',
  ]) assert.ok(findRisk(command), command);
  for (const command of ['npm test', 'npx vitest run src/a.test.ts', 'cat src/a.test.ts', 'grep -n foo tests/x.py', 'node --test test/']) {
    assert.equal(findRisk(command), null, command);
  }
});

test('guard-commands catches PowerShell deletes and test writes (#23)', () => {
  const risky = [
    'Remove-Item -Recurse -Force build', 'Remove-Item build -Force -Recurse', 'rm -Recurse -Force build',
    'ri -r -fo build', 'del -Recurse -Force build', 'rm -r -fo build', 'remove-item -rec -forc build',
    'Remove-Item -Recurse:$true -Force build', 'rmdir C:\\tmp\\x -Recurse -Force',
    'Set-Content -Path src/a.test.ts -Value x', 'Out-File -FilePath tests/x.py', 'Add-Content tests/x.py y',
    'Move-Item src/a.spec.ts C:/tmp', 'Copy-Item new.ts src/a.test.ts', 'Remove-Item -LiteralPath Source\\X\\Tests\\Y.cpp',
    'sed -i s/a/b/ Source\\X\\Tests\\Y.cpp', 'git push --force origin main', 'Clear-Content src\\__tests__\\a.js',
    'New-Item -Force tests/x.py', 'ren tests\\a_test.py b_test.py', 'cd x; del tests/old_test.py',
  ];
  for (const command of risky) assert.ok(findRisk(command), `should flag: ${command}`);
  const safe = [
    'Remove-Item -Recurse build', 'Remove-Item file.txt -Force', 'Get-Content tests/x.py', 'Select-String foo tests/x.py',
    'Get-ChildItem -Recurse -Force', 'Remove-Item -r -f build', 'git commit -m "move helper out of tests/x.py"',
    'New-Item -ItemType File tests/new_test.py',
  ];
  for (const command of safe) assert.equal(findRisk(command), null, `should not flag: ${command}`);
});

test('guard-commands asks for the PowerShell tool (#23)', () => {
  const result = runHook('guard-commands.mjs', { tool_name: 'PowerShell', tool_input: { command: 'Remove-Item -Recurse -Force build' } });
  const out = JSON.parse(result.stdout).hookSpecificOutput;
  assert.equal(out.permissionDecision, 'deny');
  assert.match(out.permissionDecisionReason, /Claude does not do this here/);
});

test('hooks.json runs guard-commands for Bash and PowerShell (#23)', () => {
  const config = JSON.parse(fs.readFileSync('plugins/core/hooks/hooks.json', 'utf8'));
  const entry = config.hooks.PreToolUse.find(e => e.hooks.some(h => h.command.includes('guard-commands.mjs')));
  const matcher = new RegExp(`^(${entry.matcher})$`);
  assert.ok(matcher.test('Bash') && matcher.test('PowerShell'), entry.matcher);
});

test('guard-commands asks before changing machine-wide git configuration (#31)', () => {
  for (const command of ['git config --global core.autocrlf false', 'git config --system safe.directory "*"', 'git config --global --add safe.directory C:/x', 'git config --global --unset user.name']) {
    assert.ok(findRisk(command), command);
  }
  for (const command of ['git config --global --get user.name', 'git config --global --list', 'git config -l', 'git -c safe.directory=* status', 'git config core.autocrlf false', 'git config --local core.longpaths true']) {
    assert.equal(findRisk(command), null, command);
  }
});

test('guard-commands ignores stream redirects such as 2>&1 and >/dev/null on test paths', () => {
  for (const command of ['cat tests/a.test.js 2>&1', 'node --test tests/a.test.js 2>&1 | tail -5', 'cat src/x.spec.ts >/dev/null', 'grep -n foo tests/a.test.js 2> /dev/null', 'cat tests/a.test.js &>/dev/null']) {
    assert.equal(findRisk(command), null, command);
  }
  for (const command of ['echo x > tests/a.test.js', 'cat new.js 2>&1 > tests/a.test.js', 'echo x >> src/a.spec.ts 2>&1']) {
    assert.ok(findRisk(command), command);
  }
});

test('guard-commands asks only when a command writes to a test file', () => {
  const risky = [
    "python3 - <<'PY'\np='tests/unit/a.test.ts'\ns=open(p).read()\nopen(p,'w').write(s.replace('1','2'))\nPY",
    "cat >> tests/unit/a.test.ts <<'TS'\ntest('x', () => {})\nTS",
    'sed -i "s/a/b/" src/a.test.ts && npm test',
    "node -e \"require('fs').writeFileSync('tests/x.test.js', '')\"",
    'git rm tests/old.test.ts', 'git mv tests/a.test.ts tests/b.test.ts',
    'cp fixture.json tests/fixtures/story.json',
    "bash -c 'echo x > tests/a.test.ts'",
    'find tests -name "*.test.ts" -exec sed -i s/a/b/ {} +',
    'ls tests/*.test.ts | xargs sed -i s/a/b/',
  ];
  for (const command of risky) assert.ok(findRisk(command), `should flag: ${command}`);
  const safe = [
    'npx vitest run src/lib/date.test.ts > /tmp/out.txt',
    'npm test -- test/foo.test.mjs 2>&1 | tee /tmp/log.txt',
    'cp tests/fixtures/story.json /tmp/story.json',
    'git commit -m "tests: cover the > case in parse.test.ts"',
    "git commit -F - <<'MSG'\nAdd tests/unit/a.test.ts\nMSG",
    "python3 - <<'PY'\np='docs/specs/x.md'\ns=open(p).read()\ns=s.replace('a','  - tests/unit/a.test.ts: AC-2 changed')\nopen(p,'w').write(s)\nPY\nnpx vitest run tests/unit/a.test.ts",
    "sed -i 's/old/new/' src/pages/Writing.astro && npx playwright test tests/e2e/writing.spec.ts",
    "curl -s localhost:4321/sitemap.xml | grep loc | sed 's/<loc>//' ; npx playwright test tests/e2e/a.spec.ts",
    'npm run build:fixtures > /tmp/build.log 2>&1 && npx playwright test tests/e2e/stories.spec.ts',
    "sed -i 's#see tests/unit/a.test.ts#see tests/unit/b.test.ts#' docs/specs/x.md",
  ];
  for (const command of safe) assert.equal(findRisk(command), null, `should not flag: ${command}`);
});

test('guard-commands asks before updating test snapshots (TEST-001)', () => {
  for (const command of ['npx vitest run -u', 'npx vitest --update', 'npx jest --updateSnapshot', 'npx jest -u src', 'npx playwright test --update-snapshots', 'npm test -- -u']) {
    assert.ok(findRisk(command), command);
  }
  for (const command of ['npx vitest run', 'npx playwright test --ui', 'npm update', 'git push -u origin x']) {
    assert.equal(findRisk(command), null, command);
  }
});

test('guard-commands does not ask when git restore only unstages', () => {
  for (const command of ['git restore --staged .', 'git restore --staged -- .', 'git restore -S .']) assert.equal(findRisk(command), null, command);
  for (const command of ['git restore .', 'git restore --staged --worktree .', 'git restore -SW .', 'git checkout -- .']) assert.ok(findRisk(command), command);
});

test('guard-commands lets a shell command create a new file, or write outside the project (rfr-core 3.0.1)', () => {
  // Found when rfr-core 3.0.0 refused a heredoc that created a scratch test file outside the project.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-new-file-'));
  fs.mkdirSync(path.join(dir, 'tests'));
  fs.writeFileSync(path.join(dir, 'tests/existing.test.ts'), 'x\n');
  const outside = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-scratch-')), 'ctx.test.mjs');
  fs.writeFileSync(outside, 'x\n');
  assert.equal(decideCommand("cat > tests/new.test.ts <<'EOF'\nx\nEOF", { cwd: dir }), null, 'a new file is not an existing test');
  assert.equal(decideCommand(`echo x > ${sh(outside)}`, { cwd: dir }), null, 'a file outside the project is not one of its tests');
  assert.equal(decideCommand('sed -i s/a/b/ tests/existing.test.ts', { cwd: dir }).decision, 'deny');
  assert.equal(decideCommand('rm tests/*.test.ts', { cwd: dir }).decision, 'defer', 'a glob can match existing tests');
  assert.equal(decideCommand('rm tests/*.test.ts', { cwd: dir, settings: { testWeakening: 'ask' } }).decision, 'ask', 'a project that wants to be asked is');
  const write = runHook('guard-test-edits.mjs', { cwd: dir, tool_name: 'Write', tool_input: { file_path: outside, content: 'y' } });
  assert.equal(write.stdout, '', 'guard-test-edits leaves files outside the project alone');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('discarding changes takes a snapshot only when there are changes to lose (rfr-core 3.0.2; snapshots in 5.1.0)', () => {
  const r = gitRepo();
  for (const command of ['git checkout -- .', 'git restore .', 'git reset --hard', 'git clean -fd', 'git checkout -q -- . 2>/dev/null; git switch -c next']) {
    assert.equal(decideCommand(command, { cwd: r.dir }), null, `clean tree: ${command}`);
  }
  assert.equal(decideCommand('git reset --hard HEAD~1', { cwd: r.dir }).decision, 'inform', 'resetting to another commit can drop commits, so a snapshot keeps them');
  r.write({ 'src/a.ts': 'changed\n' });
  for (const command of ['git checkout -- .', 'git restore .', 'git reset --hard']) {
    assert.equal(decideCommand(command, { cwd: r.dir }).decision, 'inform', `uncommitted change: ${command}`);
  }
  assert.equal(decideCommand('git clean -fd', { cwd: r.dir }), null, 'no untracked files to delete');
  r.write({ 'src/new.ts': 'new\n' });
  assert.equal(decideCommand('git clean -fd', { cwd: r.dir }).decision, 'inform', 'an untracked file would be deleted');
  // The folder the command runs in is the one after any cd.
  const other = gitRepo();
  assert.equal(decideCommand(`cd ${sh(other.dir)} && git checkout -- .`, { cwd: r.dir }), null);
  assert.equal(decideCommand(`cd ${sh(other.dir)} && cd ${sh(r.dir)} && git checkout -- .`, { cwd: other.dir }).decision, 'inform');
});

test("discarding changes in an agent's own worktree does not ask (rfr-core 3.0.2)", () => {
  const r = gitRepo();
  const wt = path.join(r.dir, '.claude', 'worktrees', 'agent-1');
  r.git('worktree', 'add', '-q', '-b', 'agent-1', wt);
  fs.writeFileSync(path.join(wt, 'src/a.ts'), 'agent change\n');
  r.write({ 'src/a.ts': 'lead change\n' });
  assert.equal(decideCommand(`cd ${sh(wt)} && git status --short && git checkout -- . && git status --short`, { cwd: r.dir }), null);
  assert.equal(decideCommand('git checkout -- .', { cwd: wt }), null);
  assert.equal(decideCommand('git checkout -- .', { cwd: r.dir }).decision, 'inform', 'the main checkout takes a snapshot first');
});

test('rm -rf asks unless everything it deletes is ignored by git and untracked (rfr-core 3.0.2)', () => {
  const r = gitRepo({ '.gitignore': 'dist/\ncoverage/\n', 'build/make.mjs': 'x\n' });
  r.write({ 'dist/app.js': 'built\n', 'coverage/index.html': 'x\n' });
  assert.equal(decideCommand('rm -rf dist && CI=1 npx playwright test tests/e2e/a.spec.ts --trace off 2>&1 | tail -25', { cwd: r.dir }), null);
  assert.equal(decideCommand('rm -rf dist coverage', { cwd: r.dir }), null);
  assert.equal(decideCommand('rm -rf not-there', { cwd: r.dir }), null, 'nothing to delete');
  // Tracked files with no uncommitted changes are allowed, with the command that restores them (guard tiers AC-12).
  assert.equal(decideCommand('rm -rf dist build', { cwd: r.dir }).decision, 'inform');
  // A path outside the project and every temp folder. ../elsewhere would be inside the temp folder,
  // where this fixture repository lives, and is scratch since default-allow decision 6.
  const elsewhere = sh(path.join(os.homedir(), `rfr-hooks-elsewhere-${process.pid}`));
  for (const command of ['rm -rf .', 'rm -rf /', 'rm -rf dist/*', `rm -rf ${elsewhere}`]) {
    assert.equal(decideCommand(command, { cwd: r.dir }).decision, 'ask', command);
  }
});

// ---- rm -rf of its own scratch copy (moved from rm-own-scratch.test.mjs) ----------------------------

// rm -rf of a folder the same command line made in a temp folder (default-allow AC-2, refined
// 2026-11-12): a cloud session's "cp -r . /var/tmp/check && cd /var/tmp/check && rm -rf node_modules
// */node_modules && ... && cd / && rm -rf /var/tmp/check" deletes only its own throwaway copy, so it
// is not a named ask. Anything that was there before the line, or that a target escapes to, still asks.

function scratchRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-own-scratch-repo-'));
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a\n');
  const git = (...args) => spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('add', '.');
  git('commit', '-q', '-m', 'base');
  return dir;
}

// A folder name directly under the temp folder that does not exist yet.
const fresh = () => path.join(os.tmpdir(), `rfr-own-scratch-copy-${process.pid}-${Math.random().toString(36).slice(2)}`);

test('default-allow#AC-2: a temp folder the same line copied the repository into can be deleted without asking', () => {
  const dir = scratchRepo();
  const copy = sh(fresh());
  const line = `cp -r . ${copy} && cd ${copy} && rm -rf node_modules */node_modules && (npx -y pnpm install --frozen-lockfile 2>&1 | tail -4); cd / && rm -rf ${copy}`;
  assert.equal(decideCommand(line, { cwd: dir })?.decision, undefined, line);
  for (const made of [`mkdir -p ${sh(fresh())}`, `git clone -q https://example.com/r.git ${sh(fresh())}`, `git worktree add ${sh(fresh())} -b scratch`]) {
    const target = made.split(' ').at(made.startsWith('git worktree') ? 3 : -1);
    assert.equal(decideCommand(`${made} && rm -rf ${target}`, { cwd: dir })?.decision, undefined, made);
  }
});

test('default-allow#AC-2: any folder in a temp folder but the project goes; the temp folder itself, a glob escaping it, or a path outside still asks', () => {
  const dir = scratchRepo();
  // Since default-allow decision 6, a folder directly under the temp folder is scratch too, made by
  // this line or not, and so is a repository there that is not the project.
  const existing = fresh();
  fs.mkdirSync(existing);
  fs.writeFileSync(path.join(existing, 'keep.txt'), 'keep\n');
  assert.equal(decideCommand(`rm -rf ${sh(existing)}`, { cwd: dir })?.decision, undefined);
  assert.equal(decideCommand(`cp -r . ${sh(existing)} && rm -rf ${sh(existing)}`, { cwd: dir })?.decision, undefined);
  // The temp folder itself, and a glob that climbs out of the new folder into it.
  assert.equal(decideCommand(`rm -rf ${sh(os.tmpdir())}`, { cwd: dir })?.decision, 'ask');
  const copy = sh(fresh());
  assert.equal(decideCommand(`cp -r . ${copy} && cd ${copy} && rm -rf ../*`, { cwd: dir })?.decision, 'ask');
  // A folder outside every temp folder and the project.
  assert.equal(decideCommand(`rm -rf ${sh(path.join(os.homedir(), `rfr-own-scratch-outside-${process.pid}`))}`, { cwd: dir })?.decision, 'ask');
  fs.rmSync(existing, { recursive: true, force: true });
});

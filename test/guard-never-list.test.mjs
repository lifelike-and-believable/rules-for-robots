// The never-list actions guard-commands refuses outside the project (docs/specs/unattended.md, AC-2):
// pushing to the default branch, deleting on the remote, and production deploys. Pushes to other
// branches, tags, releases, and preview deploys go ahead (rewrite plan 25e). Moved from
// default-allow.test.mjs when the default-allow hook was removed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decideCommand, namedAsk } from '../plugins/core/scripts/guard-commands.mjs';

function git(dir, ...args) {
  const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
}

// A repository on a feature branch, with main as its default branch and a tag v1.0.0.
function repo({ branch = 'feature' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-never-list-'));
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a\n');
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'tag', 'v1.0.0');
  if (branch !== 'main') git(dir, 'switch', '-q', '-c', branch);
  return dir;
}

test('unattended#AC-2: pushes to the default branch, remote deletes, and production deploys are refused; other pushes, releases, and preview deploys are not', () => {
  const dir = repo();
  for (const command of ['git push origin main', 'git push origin HEAD:main', 'git push origin --all', 'git push origin --delete old', 'git push origin :old', 'gh repo delete acme/app --yes', 'gh release delete v1.0.0', 'npx vercel deploy --prod', 'vercel promote dpl_1', 'git -C . push origin main']) {
    assert.equal(decideCommand(command, { cwd: dir })?.decision, 'ask', command);
  }
  for (const command of ['git push -u origin feature', 'git push origin feature:feature', 'git push origin --tags', 'git push origin v1.0.0', 'gh release create v1.0.1', 'npx vercel deploy', 'git status', 'gh pr create --fill']) {
    assert.equal(namedAsk(command, dir), null, command);
    assert.equal(decideCommand(command, { cwd: dir }), null, command);
  }
  // A bare push is refused only on the default branch.
  assert.equal(namedAsk('git push', dir), null);
  assert.ok(namedAsk('git push', repo({ branch: 'main' })));
});

test('unattended#AC-2: every action in the guide\'s never-list table has tier-4 corpus cases', () => {
  const table = fs.readFileSync('practices/guards.md', 'utf8').split('### Named asks')[1].split('\n\n')[1];
  const rows = table.split('\n').filter(line => line.startsWith('| ') && !line.startsWith('| Action'));
  const ids = rows.flatMap(line => [...line.split('|').at(-2).matchAll(/`([a-z0-9-]+)`/g)].map(m => m[1]));
  const corpus = JSON.parse(fs.readFileSync('test/fixtures/guard-corpus.json', 'utf8')).cases;
  assert.ok(ids.length >= 16, `${ids.length} corpus ids in the table`);
  for (const id of ids) assert.equal(corpus.find(c => c.id === id)?.tier, 4, `${id} is a tier-4 corpus case`);
});

test('unattended#AC-2: a tag or a glob pushed to the default branch is refused, and pushing the tag itself is not', () => {
  const dir = repo();
  git(dir, 'tag', 't');
  for (const command of ['git push origin t:main', 'git push origin t:refs/heads/main', 'git push origin v1.0.0:main', 'git push --branches origin', 'git push origin "refs/heads/*:refs/heads/*"']) {
    assert.equal(decideCommand(command, { cwd: dir })?.decision, 'ask', command);
  }
  for (const command of ['git push origin t', 'git push origin refs/tags/t:refs/tags/t']) {
    assert.equal(decideCommand(command, { cwd: dir }), null, command);
  }
});

test('github-gate#AC-9: bypassing or changing branch protection is refused; an ordinary merge or read is not', () => {
  const dir = repo();
  for (const command of ['gh pr merge 5 --admin --squash', 'gh api -X DELETE repos/o/r/branches/main/protection/enforce_admins', 'gh api --method PUT repos/o/r/branches/main/protection --input p.json', 'gh api repos/o/r/rulesets -f name=x', 'gh release upload v1.0.0 a.zip --clobber']) {
    assert.equal(decideCommand(command, { cwd: dir })?.decision, 'ask', command);
  }
  for (const command of ['gh pr merge 5 --squash', 'gh api repos/o/r/branches/main/protection', 'gh release upload v1.0.0 a.zip']) {
    assert.equal(decideCommand(command, { cwd: dir }), null, command);
  }
});

test('unattended#AC-2: MCP tools that change another service, and GitHub tools that delete, change settings or access, or publish, are refused', async () => {
  const { mcpNever } = await import('../plugins/core/scripts/guard-mcp-tools.mjs');
  for (const tool of ['mcp__github__delete_file', 'mcp__github__delete_branch', 'mcp__github__create_release', 'mcp__github__update_repository_settings', 'mcp__github__update_branch_protection', 'mcp__github__create_or_update_secret', 'mcp__github__add_collaborator', 'mcp__github__create_repository', 'mcp__claude_ai_Gmail__create_draft', 'mcp__supabase__execute_sql', 'mcp__netlify__deploy_site']) {
    assert.match(mcpNever({ tool_name: tool }) ?? '', /^rfr-core \(never list\)/, tool);
  }
  for (const tool of ['mcp__github__create_pull_request', 'mcp__github__push_files', 'mcp__github__add_issue_comment', 'mcp__plugin_github_github__create_branch', 'mcp__github__list_releases', 'mcp__github__get_tag', 'mcp__Vercel__create_deployment', 'mcp__supabase__list_tables', 'Bash', 'Read']) {
    assert.equal(mcpNever({ tool_name: tool }), null, tool);
  }
  const hooks = JSON.parse(fs.readFileSync('plugins/core/hooks/hooks.json', 'utf8')).hooks.PreToolUse;
  const entry = hooks.find(h => h.hooks.some(x => x.command.includes('guard-mcp-tools.mjs')));
  for (const tool of ['mcp__github__delete_file', 'mcp__supabase__execute_sql']) assert.match(tool, new RegExp(`^(?:${entry.matcher})$`), tool);
  const run = spawnSync(process.execPath, ['plugins/core/scripts/guard-mcp-tools.mjs'], { input: JSON.stringify({ tool_name: 'mcp__github__delete_file' }), encoding: 'utf8', env: { ...process.env, RFR_GUARD_LOG: '0' } });
  assert.equal(JSON.parse(run.stdout).hookSpecificOutput.permissionDecision, 'deny');
});

test('NODE-002: only a plain new Vercel deployment counts as a preview; redeploys, settings changes, custom environments, and production targets are refused', async () => {
  const { decideVercel } = await import('../plugins/web/scripts/guard-mcp.mjs');
  const decide = tool_input => decideVercel({ tool_name: 'mcp__Vercel__create_deployment', tool_input })?.decision ?? null;
  for (const input of [{}, { target: 'preview' }, { name: 'app', gitSource: { ref: 'feature' } }]) assert.equal(decide(input), null, JSON.stringify(input));
  for (const input of [{ target: 'production' }, { target: ['production'] }, { deploymentId: 'dpl_1' }, { projectSettings: { buildCommand: 'x' } }, { customEnvironmentSlugOrId: 'staging' }, 'not json']) {
    assert.equal(decide(input), 'ask', JSON.stringify(input));
  }
});

test('unattended#AC-2: pushing tags from the default branch is not a push to it; --follow-tags is', () => {
  const dir = repo({ branch: 'main' });
  for (const command of ['git push origin --tags', 'git push --tags']) assert.equal(decideCommand(command, { cwd: dir }), null, command);
  assert.equal(decideCommand('git push --follow-tags origin', { cwd: dir })?.decision, 'ask');
});

test('guard-tiers#AC-7: the report counts never-list refusals as refusals', async () => {
  const { summarise } = await import('../checks/guard-report.mjs');
  const r = summarise([{ time: '2026-11-12T10:00:00Z', session: 's', hook: 'guard-commands', tool: 'Bash', decision: 'never', reason: 'rfr-core (WA-003): force-push rewrites remote history.' }]);
  assert.equal(r.refusals, 1);
});

test('unattended#AC-2: skipping hooks, reading secrets, and deleting or changing on the remote are refused by every route', () => {
  const dir = repo();
  for (const command of ['git commit -n -m x', 'git commit -nm x', 'git -c core.hooksPath=/dev/null commit -m x', 'git config core.hooksPath /dev/null', 'HUSKY=0 git commit -m x', 'SKIP=lint git commit -m x',
    'cat .env', 'cat .env.local', 'type .env', 'Get-Content .env.production', 'grep KEY .env', 'cat secrets/server.pem', 'printenv', 'env', 'printenv GH_TOKEN', 'echo $GH_TOKEN', 'echo "$OPENAI_API_KEY"', 'Get-ChildItem env:', 'gci env:GH_TOKEN', 'vercel env pull .env.local',
    'gh api -X DELETE repos/o/r', 'gh api --method DELETE repos/o/r/releases/1', 'gh api -X PATCH repos/o/r/git/refs/heads/main -F force=true -f sha=abc',
    'vercel remove app --yes', 'vercel rm app', 'vercel project rm app', 'vercel env rm SECRET production -y', 'vercel env add SECRET production', 'vercel --prod=true', 'vercel redeploy https://app.vercel.app']) {
    assert.equal(decideCommand(command, { cwd: dir })?.decision, 'ask', command);
  }
  for (const command of ['git commit -m "fix -n handling"', 'git config --get core.hooksPath', 'git merge -n feature', 'cat .env.example', 'cat README.md', 'env NODE_ENV=test node x.js', 'env | grep -iE "^(PXR|USD)"', 'printenv PATH', 'echo $HOME', 'Get-ChildItem env:QUIET* | Format-Table',
    'gh api repos/o/r/pulls', 'gh api -X POST repos/o/r/git/refs -f ref=refs/heads/x -f sha=abc', 'vercel redeploy https://x --target preview', 'vercel --prod=false']) {
    assert.equal(decideCommand(command, { cwd: dir }), null, command);
  }
});

test('unattended#AC-2: force-deleting a local branch is allowed with the command that restores it; one the guard cannot resolve is refused', () => {
  const dir = repo();
  git(dir, 'branch', 'old');
  const sha = spawnSync('git', ['rev-parse', 'old'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
  const d = decideCommand('git branch -D old', { cwd: dir });
  assert.equal(d?.decision, 'inform');
  assert.match(d.reason, new RegExp(`git branch old ${sha}`));
  assert.equal(decideCommand('git branch -d --force old', { cwd: dir })?.decision, 'inform');
  assert.equal(decideCommand('git branch -D gone', { cwd: dir })?.decision, 'ask');
  assert.equal(decideCommand('git branch -d old', { cwd: dir }), null);
});

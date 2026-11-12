// Default allow (docs/specs/default-allow.md): rfr-core allows the agent's working tools, the named
// asks still ask, and a merge that is the person's review stops instead of prompting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { defaultAllow } from '../plugins/core/scripts/allow-default.mjs';
import { decideCommand, namedAsk } from '../plugins/core/scripts/guard-commands.mjs';
import { decideMerge, mergeOutput } from '../plugins/process/scripts/guard-merge.mjs';

const on = { permissions: 'default-allow' };

function git(dir, ...args) {
  const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
}

// A repository on a feature branch, with main as its default branch and a tag v1.0.0.
function repo({ branch = 'feature', rfrJson } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-default-allow-'));
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a\n');
  if (rfrJson) {
    fs.mkdirSync(path.join(dir, '.claude'));
    fs.writeFileSync(path.join(dir, '.claude', 'rfr.json'), rfrJson);
  }
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'tag', 'v1.0.0');
  if (branch !== 'main') git(dir, 'switch', '-q', '-c', branch);
  return dir;
}

test("default-allow#AC-1: the hook allows the agent's working tools and GitHub tools, and nothing else", () => {
  for (const tool of ['Bash', 'PowerShell', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'WebSearch', 'WebFetch']) {
    assert.match(defaultAllow({ tool_name: tool }, on), /^rfr-core \(default allow\)/, tool);
  }
  for (const tool of ['mcp__github__create_pull_request', 'mcp__github__push_files', 'mcp__github__merge_pull_request', 'mcp__github__add_issue_comment', 'mcp__plugin_github_github__create_branch', 'mcp__github__list_releases', 'mcp__github__get_tag']) {
    assert.ok(defaultAllow({ tool_name: tool }, on), tool);
  }
  // Deletions, settings and access, and releases through GitHub stay with Claude Code's prompt.
  for (const tool of ['mcp__github__delete_file', 'mcp__github__create_release', 'mcp__github__update_repository_settings', 'mcp__github__add_collaborator', 'mcp__github__create_repository']) {
    assert.equal(defaultAllow({ tool_name: tool }, on), null, tool);
  }
  // Other tools and MCP servers are not the hook's to allow.
  for (const tool of ['mcp__Vercel__create_deployment', 'mcp__claude_ai_Gmail__create_draft', 'Read', 'Agent']) {
    assert.equal(defaultAllow({ tool_name: tool }, on), null, tool);
  }
  // "permissions": "ask" turns it off, and it is on when the project says nothing.
  assert.equal(defaultAllow({ tool_name: 'Bash' }, { permissions: 'ask' }), null);
  assert.ok(defaultAllow({ tool_name: 'Bash', cwd: repo() }));
  assert.equal(defaultAllow({ tool_name: 'Bash', cwd: repo({ rfrJson: '{ "permissions": "ask" }\n' }) }), null);
  // The hook is registered for those tools, and prints an allow decision.
  const hooks = JSON.parse(fs.readFileSync('plugins/core/hooks/hooks.json', 'utf8')).hooks.PreToolUse;
  const entry = hooks.find(h => h.hooks.some(x => x.command.includes('allow-default.mjs')));
  for (const tool of ['Bash', 'Edit', 'WebFetch', 'mcp__github__create_pull_request']) assert.match(tool, new RegExp(`^(?:${entry.matcher})$`), tool);
  const run = spawnSync(process.execPath, ['plugins/core/scripts/allow-default.mjs'], { input: JSON.stringify({ tool_name: 'Edit', cwd: repo() }), encoding: 'utf8' });
  assert.equal(JSON.parse(run.stdout).hookSpecificOutput.permissionDecision, 'allow');
});

test('default-allow#AC-2: the named asks ask, and pushes to other branches and preview deploys do not', () => {
  const dir = repo();
  for (const command of ['git push origin main', 'git push origin HEAD:main', 'git push origin --delete old', 'git push origin :old', 'git push origin --tags', 'git push origin v1.0.0', 'gh release create v1.0.1', 'gh repo delete acme/app --yes', 'npx vercel deploy --prod', 'vercel promote dpl_1', 'git -C . push origin main']) {
    assert.equal(decideCommand(command, { cwd: dir })?.decision, 'ask', command);
  }
  for (const command of ['git push -u origin feature', 'git push origin feature:feature', 'npx vercel deploy', 'git status', 'gh pr create --fill']) {
    assert.equal(namedAsk(command, dir), null, command);
  }
  // A bare push asks only on the default branch.
  assert.equal(namedAsk('git push', dir), null);
  assert.ok(namedAsk('git push', repo({ branch: 'main' })));
  // Every named ask in the guide's table has corpus cases, and each of them asks (the corpus test runs them).
  const table = fs.readFileSync('practices/guards.md', 'utf8').split('### Named asks')[1].split('\n\n')[1];
  const rows = table.split('\n').filter(line => line.startsWith('| ') && !line.startsWith('| Action'));
  const ids = rows.flatMap(line => [...line.split('|').at(-2).matchAll(/`([a-z0-9-]+)`/g)].map(m => m[1]));
  const corpus = JSON.parse(fs.readFileSync('test/fixtures/guard-corpus.json', 'utf8')).cases;
  assert.ok(ids.length >= 15, `${ids.length} corpus ids in the table`);
  for (const id of ids) assert.equal(corpus.find(c => c.id === id)?.tier, 4, `${id} is a tier-4 corpus case`);
});

test('default-allow#AC-3: the recorded check shows another hook\'s ask or deny wins over an allow', () => {
  const dir = 'evals/results/2026-11-12-hook-combination';
  for (const file of ['default-mode.json', 'auto-mode.json']) {
    const { results } = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    for (const r of results) {
      const allowedAlone = r.hooks === 'allow + none';
      assert.equal(r.ran, allowedAlone, `${file}: ${r.hooks}`);
    }
    assert.ok(results.some(r => r.hooks === 'allow + ask'), file);
    assert.ok(results.some(r => r.hooks === 'allow + deny'), file);
  }
});

test("default-allow#AC-4: a merge that is the person's review stops and reports instead of prompting", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-default-allow-merge-'));
  fs.mkdirSync(path.join(root, 'docs/product'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/product/process.yml'), 'mode: solo\ndefault: [lead]\n');
  const transcript = text => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-default-allow-t-')), 's.jsonl');
    fs.writeFileSync(file, `${JSON.stringify({ type: 'user', origin: { kind: 'human' }, timestamp: '2026-11-12T02:00:00Z', message: { content: text } })}\n`);
    return file;
  };
  const merge = (files, said = 'looks good') => decideMerge({
    input: { tool_name: 'mcp__github__merge_pull_request', tool_input: { owner: 'acme', repo: 'app', pullNumber: 12 }, transcript_path: transcript(said) },
    root, listFiles: () => files, describePr: () => ({ number: 12, createdAt: '2026-11-12T01:00:00Z' }),
  });
  // Nothing gated: the guard has nothing to say, so the default-allow hook's allow stands.
  assert.equal(mergeOutput(merge(['src/a.ts']), root), '');
  // Gated files and no instruction: a refusal that tells the agent to stop and report.
  const stop = JSON.parse(mergeOutput(merge(['docs/design/reader.md']), root)).hookSpecificOutput;
  assert.equal(stop.permissionDecision, 'deny');
  assert.match(stop.permissionDecisionReason, /touches gated process files/);
  assert.match(stop.permissionDecisionReason, /do not merge it and do not ask for a prompt: stop, tell the person/);
  assert.doesNotMatch(stop.permissionDecisionReason, /Confirm only if/);
  // The person's instruction covers it: allowed.
  assert.equal(JSON.parse(mergeOutput(merge(['docs/design/reader.md'], 'merge 12 when green'), root)).hookSpecificOutput.permissionDecision, 'allow');
  // "permissions": "ask" keeps the prompt.
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(root, '.claude', 'rfr.json'), '{ "permissions": "ask" }\n');
  assert.equal(JSON.parse(mergeOutput(merge(['docs/design/reader.md']), root)).hookSpecificOutput.permissionDecision, 'ask');
});

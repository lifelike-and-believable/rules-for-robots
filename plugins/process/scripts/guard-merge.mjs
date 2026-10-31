#!/usr/bin/env node
// PreToolUse (shell commands and GitHub MCP merge tools): agents may not merge a pull request that
// touches a gated process folder (docs/specs/project-process.md, "Approval records"). In solo mode
// the approver's merge is the approval, so an agent merging under the approver's credentials would
// forge it; in team mode the approvals job already requires a review, and this keeps the merge with
// a person too. Projects without docs/product/process.yml are not affected. If the pull request's
// files cannot be listed (no gh, no network), the merge is denied: merge it yourself.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gatedStages, hasId, readConfig, stageOf } from './lib/process.mjs';

// Flags of `gh pr merge` that take a value, so their value is not the pull request argument.
const VALUE_FLAGS = new Set(['-b', '--body', '-F', '--body-file', '-t', '--subject', '--match-head-commit', '-A', '--author-email', '-R', '--repo']);

function words(segment) {
  return [...segment.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map(m => m[1] ?? m[2] ?? m[3]);
}

// What a tool call would merge: { kind: 'gh', ref } for `gh pr merge [ref]`, { kind: 'api', owner,
// repo, number } for `gh api ... pulls/N/merge` and the MCP merge tool, or null.
export function mergeTarget(input) {
  const tool = input?.tool_name ?? '';
  if (/^mcp__.*merge_pull_request$/i.test(tool)) {
    const t = input.tool_input ?? {};
    return { kind: 'api', owner: t.owner, repo: t.repo, number: Number(t.pullNumber ?? t.pull_number ?? t.number) };
  }
  if (!/^(Bash|PowerShell)$/.test(tool)) return null;
  const command = String(input.tool_input?.command ?? '');
  for (const segment of command.split(/&&|\|\||;|\||\n/)) {
    const w = words(segment.trim());
    const i = w.findIndex((x, k) => x === 'gh' && w[k + 1] === 'pr' && w[k + 2] === 'merge');
    if (i !== -1) {
      const args = w.slice(i + 3);
      let ref = '';
      for (let k = 0; k < args.length; k++) {
        if (VALUE_FLAGS.has(args[k])) { k++; continue; }
        if (args[k].startsWith('-')) continue;
        ref = args[k];
        break;
      }
      return { kind: 'gh', ref };
    }
    if (w[0] === 'gh' && w[1] === 'api') {
      const m = w.map(x => /^\/?repos\/([^/]+)\/([^/]+)\/pulls\/(\d+)\/merge$/.exec(x)).find(Boolean);
      if (m) return { kind: 'api', owner: m[1], repo: m[2], number: Number(m[3]) };
    }
  }
  return null;
}

function listWithGh(target) {
  const args = target.kind === 'gh'
    ? ['pr', 'view', ...(target.ref ? [target.ref] : []), '--json', 'files', '--jq', '.files[].path']
    : ['api', '--paginate', `repos/${target.owner}/${target.repo}/pulls/${target.number}/files`, '--jq', '.[].filename'];
  const r = spawnSync('gh', args, { encoding: 'utf8', timeout: 8000 });
  if (r.error || r.status !== 0) throw new Error((r.error?.message ?? r.stderr ?? '').trim() || `gh exited ${r.status}`);
  return r.stdout.split('\n').map(s => s.trim()).filter(Boolean);
}

export function decideMerge({ input, root, listFiles = listWithGh }) {
  const target = mergeTarget(input);
  if (!target) return { deny: false, reason: '' };
  const loaded = readConfig(root);
  if (!loaded) return { deny: false, reason: '' };
  let files;
  try {
    files = listFiles(target);
  } catch (e) {
    return { deny: true, reason: `rfr-process: could not list the pull request's files (${e.message}), so it may touch gated process folders. Ask the approver to merge it.` };
  }
  const gated = new Set(gatedStages(loaded.config));
  const touched = files.filter(file => {
    const stage = stageOf(file);
    if (!stage || !gated.has(stage)) return false;
    if (stage !== 'specs') return true;
    const local = path.join(root, file);
    return !fs.existsSync(local) || hasId(fs.readFileSync(local, 'utf8'));
  });
  if (!touched.length) return { deny: false, reason: '' };
  return {
    deny: true,
    reason: `rfr-process: this pull request touches gated process files (${touched.slice(0, 5).join(', ')}${touched.length > 5 ? ', ...' : ''}). Merging it is the approver's decision, so an agent may not merge it. Ask the approver to review and merge.`,
  };
}

export function denyOutput(reason) {
  return JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let input = {};
  try { input = JSON.parse(raw || '{}'); } catch { /* not JSON: nothing to check */ }
  const root = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const { deny, reason } = decideMerge({ input, root });
  if (deny) process.stdout.write(denyOutput(reason));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();

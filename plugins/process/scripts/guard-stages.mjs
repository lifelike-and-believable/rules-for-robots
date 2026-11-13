#!/usr/bin/env node
// PreToolUse (Edit, Write, MultiEdit): stage order in the session (docs/specs/project-process.md,
// AC-64). In a project with docs/product/process.yml, writing a design, user documentation, a spec,
// or a tutorial is refused unless its derived-from links an approved artifact of the stage before it
// (stories, design, user documentation), or process.yml waives that stage. The refusal names the
// stage to write first, so the agent cannot skip ahead to a spec and code, and nobody is asked: the
// process check in CI fails the same way (AC-63).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { approvedOnDefaultBranch, loadArtifacts, parseArtifact, readConfig, requiredUpstream, stageOf, workingTree } from './lib/process.mjs';

const NAMES = { stories: 'approved user stories', design: 'an approved design', 'user-docs': 'approved user documentation' };

// The content a file will have after this tool call, or null when it cannot be worked out.
function contentAfter(tool, input, abs) {
  if (tool === 'Write') return typeof input.content === 'string' ? input.content : null;
  let text;
  try { text = fs.readFileSync(abs, 'utf8'); } catch { return null; }
  const edits = tool === 'MultiEdit' ? input.edits ?? [] : [input];
  for (const e of edits) {
    if (typeof e.old_string !== 'string' || !text.includes(e.old_string)) return null;
    text = e.replace_all ? text.split(e.old_string).join(e.new_string) : text.replace(e.old_string, () => e.new_string);
  }
  return text;
}

// The refusal reason for this call, or null to allow it.
export function decideStage(input, root) {
  const tool = input?.tool_name;
  if (!['Edit', 'Write', 'MultiEdit'].includes(tool)) return null;
  const abs = path.resolve(input.cwd ?? root, input.tool_input?.file_path ?? '');
  const rel = path.relative(root, abs).split(path.sep).join('/');
  if (!rel || rel.startsWith('..') || !rel.endsWith('.md')) return null;
  const stage = stageOf(rel);
  const loaded = readConfig(root);
  if (!loaded || !stage) return null;
  const waived = loaded.config?.waived ?? {};
  if (waived[stage]) return null;
  const need = requiredUpstream(stage, waived);
  if (!need) return null;
  const after = contentAfter(tool, input.tool_input ?? {}, abs);
  if (after === null) return null;
  const parsed = parseArtifact(after);
  const { artifacts } = loadArtifacts(workingTree(root));
  const byId = new Map(artifacts.filter(a => a.id).map(a => [a.id, a]));
  const linked = (parsed.links ?? []).map(l => byId.get(l.target)).filter(Boolean);
  // Delivery (a spec or a tutorial) starts only from what the approver has approved: approval is read
  // from the default branch, as the process state does (process-state AC-3; rewrite plan 25e), so a
  // status set to approved only in this branch does not open delivery. Inside a feature packet (stories,
  // design, and user documentation in one pull request), each stage derives from the one before it as
  // proposed in the same branch, so a design or user documentation counts the working tree's status.
  const approved = stage === 'specs' || stage === 'tutorials' ? approvedOnDefaultBranch(root) : a => ['approved', 'implemented'].includes(a.status);
  if (linked.some(a => a.stage === need && approved(a))) return null;
  // Work with no user-facing behaviour (process-state AC-11): a spec may derive from an approved
  // design that says, with a reason, that what it covers needs no user documentation.
  if (stage === 'specs' && need === 'user-docs' && linked.some(a => a.stage === 'design' && approved(a) && typeof a.noUserDocs === 'string' && a.noUserDocs.length >= 10)) return null;
  const what = { design: 'a design', 'user-docs': 'user documentation', specs: 'a technical spec', tutorials: 'a tutorial' }[stage];
  // Inside a feature packet the stage before is in the same branch, and its approval is the
  // approver's review of the packet (delivery-run AC-15).
  const packet = stage === 'design' || stage === 'user-docs'
    ? ` Inside a feature packet, where it is in this same branch, set its status: approved there, with its hashes, and link it; the approver's review of the pull request is the approval, and the default branch gets that status only through it.`
    : '';
  return `rfr-process (stage order): ${rel} is ${what}, and every stage is required in this project: it must derive from ${NAMES[need]}, linked in its derived-from, and none is. Write the ${need === 'user-docs' ? 'user documentation' : need} for these stories first, and get it approved, then link it here.${packet} A stage is skipped only when docs/product/process.yml waives it, with a reason, before the work starts; do not waive it yourself. Until then, carry on with work that does not depend on it.`;
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let input = {};
  try { input = JSON.parse(raw || '{}'); } catch { /* nothing to check */ }
  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  let reason = null;
  try { reason = decideStage(input, root); } catch { reason = null; }
  if (reason) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();

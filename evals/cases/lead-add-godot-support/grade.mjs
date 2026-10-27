// Large-repository tech-lead case. Pass when the plan has three to eight slices, registers the rule-ID prefix
// no later than the slice that writes rules, runs the build after the source slices and says the outputs are
// generated, covers the version and changelog and the install-rules skill, ends with a command the repository has,
// names a reviewer, and no code changes.
import fs from 'node:fs';
import path from 'node:path';
import { agentInvoked, changedPaths, splitSlices } from '../../agents/grade-helpers.mjs';

export default async function grade({ dir, git, tools = [], finalText = '', arm }) {
  const slices = splitSlices(finalText);
  const STRETCH = /stretch|optional|only if|if there is time|nice[- ]to[- ]have|not required|after the required/i;
  const required = slices.filter(s => !STRETCH.test(s.body.split('\n')[0]));
  const index = re => required.findIndex(s => re.test(s.body));
  const scripts = Object.keys(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).scripts ?? {});
  const named = [...finalText.matchAll(/npm run ([\w:-]+)/g)].map(m => m[1]);

  const rulesAt = required.findIndex(s => /\brules?\b|\bpack\b/i.test(s.title));
  const prefixAt = index(/prefix|checks\/lib\/rules\.mjs|PREFIXES/i);
  const buildAt = index(/npm run build|regenerat|rebuild/i);
  const sourceAt = Math.max(rulesAt, index(/templates\/(agents-md|repo-files)|profiles\.json|install-rules/i));

  const checks = {
    noCode: changedPaths(git).length === 0,
    sliceCount: required.length >= 3 && required.length <= 8,
    prefixBeforeRules: prefixAt !== -1 && rulesAt !== -1 && prefixAt <= rulesAt,
    buildAfterSources: buildAt !== -1 && sourceAt !== -1 && buildAt >= sourceAt,
    generatedNoted: /generated|do not (hand-)?edit|never (hand-)?edit|not (hand-)?edit/i.test(finalText) && /template-repos|payload/i.test(finalText),
    versionAndChangelog: /plugin\.json|version/i.test(finalText) && /CHANGELOG/i.test(finalText),
    installSkill: /install-rules/i.test(finalText),
    verifyCommand: /npm run verify/.test(finalText) && named.every(n => scripts.includes(n)),
    reviewer: /code-reviewer|code review|\|\s*code\s*(?:,|\|)/i.test(finalText),
    agentInvoked: agentInvoked(arm, tools, 'tech-lead'),
  };
  // Not part of the pass: whether the plan notices that slices share the changelog, plugin version, or plan files.
  const sharedFilesNoted = /(shared|same|both|conflict)[^.\n]{0,80}(CHANGELOG|plugin\.json|PLAN\.md|README)|(CHANGELOG|plugin\.json|PLAN\.md)[^.\n]{0,80}(shared|same|conflict|one (slice|owner|writer))/i.test(finalText);
  return { pass: Object.values(checks).every(Boolean), checks: { ...checks, slices: required.length, sharedFilesNoted } };
}

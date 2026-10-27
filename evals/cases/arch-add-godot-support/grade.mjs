// Large-repository architect case. Pass when the design finds at least six of the nine places the
// repository must change, weighs options, records an ADR (a new file under docs/), and no code changes.
import { agentInvoked, changedPaths, designText, plantedFound } from '../../agents/grade-helpers.mjs';

export const CONSTRAINTS = {
  profilesFile: /profiles\.json/i,
  prefixMap: /PREFIXES|rule[- ]ID prefix|prefix(es)? (table|map)|checks\/lib\/rules\.mjs|prefix[^.\n]{0,80}\blint/i,
  prefixTable: /rule-format\.md|prefix table/i,
  agentsMdTemplate: /templates\/agents-md|AGENTS\.md template|always-on[^.\n]{0,60}(budget|200|lines)|200[- ]line/i,
  repoFiles: /templates\/repo-files|repo-files|ci\.yml|status job|always-run/i,
  generatedOutputs: /npm run build|template-repos|payload|build:check|regenerat/i,
  installSkill: /install-rules|install-rules\/SKILL|skills\/install-rules/i,
  versionAndChangelog: /plugin\.json|version bump|bump[^.\n]{0,40}version|CHANGELOG/i,
  guideLinks: /practices?\/|practice guide|guide[^.\n]{0,60}(rule|cite|link)|(rule|cite|link)[^.\n]{0,60}guide/i,
};

export default async function grade({ dir, git, tools = [], finalText = '', arm }) {
  const files = changedPaths(git);
  const newDocs = files.filter(f => /^docs\/.+\.md$/.test(f));
  const text = designText(dir, newDocs, finalText);
  const { found, count } = plantedFound(text, CONSTRAINTS);
  const checks = {
    noCode: files.length > 0 && files.every(f => f.startsWith('docs/')),
    adrWritten: newDocs.length >= 1,
    foundSix: count >= 6,
    options: (text.match(/\boptions?\b|\balternatives?\b|\brejected?\b|\bconsidered\b|\binstead of\b|\brather than\b/gi) ?? []).length >= 2,
    agentInvoked: agentInvoked(arm, tools, 'software-architect'),
  };
  return { pass: Object.values(checks).every(Boolean), checks: { ...checks, found, of: Object.keys(CONSTRAINTS).length } };
}

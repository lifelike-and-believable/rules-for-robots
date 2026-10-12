// Greenfield Unreal-plugin architect case. Pass when the design maps the requirements, flags the R9/R10
// contradiction, finds at least six of the nine Unreal constraints, asks the tools team questions, weighs
// options, records an ADR (a new file under docs/), and no code changes.
import { agentInvoked, changedPaths, designText, plantedFound } from '../../agents/grade-helpers.mjs';
import { OPTION_WORDS, conflictFlagged, questionCount, requirementsMentioned } from '../../agents/greenfield.mjs';

export const CONSTRAINTS = {
  editorModule: /Editor module|editor[- ]only|"Type"\s*:\s*"Editor"|UncookedOnly|module type|Type: ?Editor/i,
  redirectors: /redirector/i,
  assetRegistryScan: /(asset registry|AssetRegistry)[^.\n]{0,240}(slow task|FScopedSlowTask|progress|cancel|async|background|chunk|without loading|not load)|(FScopedSlowTask|slow task)[^.\n]{0,200}(asset registry|AssetRegistry|scan)/i,
  undoAndSourceControl: /FScopedTransaction|IAssetTools|RenameAssets|ISourceControl|source control provider|(undo|transaction)[^.\n]{0,160}(rename|redirector|source control|file)|(source control|check ?out)[^.\n]{0,160}(rename|undo|lock)/i,
  engineVersions: /ENGINE_(MAJOR|MINOR)_VERSION|(5\.6|5\.7)[^.\n]{0,200}(API|difference|#if|per[- ]version|compat|matrix)|build(s)? (and test(s)? )?against each|version matrix/i,
  fabRequirements: /(Fab)[^.\n]{0,200}(descriptor|\.uplugin|platform|copyright|zero warnings|FilterPlugin|metadata|package)|PlatformAllowList|FilterPlugin|\.uplugin/i,
  apiSurface: /BlueprintCallable|UBlueprintFunctionLibrary|Editor Utility|commandlet/i,
  settingsClass: /UDeveloperSettings|DeveloperSettings|Default[A-Za-z]+\.ini|UCLASS\([^)]*config/,
  tests: /automation test|IMPLEMENT_SIMPLE_AUTOMATION_TEST|Functional Test|Gauntlet|test ladder|Tier 1|Tier 2|Verify\.ps1/i,
};

export default async function grade({ dir, git, tools = [], finalText = '', arm }) {
  const files = changedPaths(git);
  const newDocs = files.filter(f => /^docs\/.+\.md$/.test(f));
  const text = designText(dir, newDocs, finalText);
  const { found, count } = plantedFound(text, CONSTRAINTS);
  const checks = {
    noCode: files.length > 0 && files.every(f => f.startsWith('docs/')),
    adrWritten: newDocs.length >= 1,
    contradictionFlagged: conflictFlagged(text, 9, 10),
    foundSix: count >= 6,
    coversRequirements: requirementsMentioned(text, 10).size >= 8,
    asksQuestions: questionCount(text) >= 2,
    options: (text.match(OPTION_WORDS) ?? []).length >= 2,
    agentInvoked: agentInvoked(arm, tools, 'software-architect'),
  };
  return { pass: Object.values(checks).every(Boolean), checks: { ...checks, found, of: Object.keys(CONSTRAINTS).length } };
}

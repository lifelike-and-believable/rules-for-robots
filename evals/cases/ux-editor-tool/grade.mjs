// Pass when the review mentions at least four of the five planted editor-tool defects and
// changes no files.
import { agentInvoked, changedPaths, plantedFound, severityCounts, standardFormat } from '../../agents/grade-helpers.mjs';

export const DEFECTS = {
  namesAndCategory: /(Proc2|DoThing)[^.\n]{0,200}(name|Category|DisplayName|verb|descriptive|rename)|(name|Category|DisplayName|verb|descriptive|rename)[^.\n]{0,200}(Proc2|DoThing)/i,
  noTooltips: /tool ?tips?|ToolTip|bFlag[^.\n]{0,100}(mean|unclear|undocumented|what)|parameters?[^.\n]{0,60}(unclear|undocumented|no (description|meaning|documentation))|meta\s*=/i,
  noProgress: /FScopedSlowTask|progress (bar|indicator)|\bcancel(l?able|lation)?\b|(block|freez|hang)s? the editor|no progress/i,
  noUndo: /FScopedTransaction|\bundo\b|transaction|not undoable|cannot be undone/i,
  failuresInLogOnly: /Message ?Log|FMessageLog|notification|UE_LOG[^.\n]{0,100}(only|fail)|LogTemp|"fail"|silent(ly)?|actionable|(error|failure)s?[^.\n]{0,60}(not (shown|visible|reported)|only (in|to) the log)/i,
};

export default async function grade({ git, tools = [], finalText = '', arm }) {
  const { found, count } = plantedFound(finalText, DEFECTS);
  const checks = {
    noCode: changedPaths(git).length === 0,
    foundFour: count >= 4,
    agentInvoked: agentInvoked(arm, tools, 'ux-reviewer'),
  };
  return { pass: Object.values(checks).every(Boolean), checks: { ...checks, found, severities: severityCounts(finalText), standardFormat: standardFormat(finalText) } };
}

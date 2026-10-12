// Pass when the review mentions at least four of the five planted command-line defects and
// changes no files.
import { agentInvoked, changedPaths, plantedFound, severityCounts, standardFormat } from '../../agents/grade-helpers.mjs';

export const DEFECTS = {
  noHelp: /--help|\busage\b|help text|no arguments|without arguments|prints nothing|silent(ly)? (exits?|does nothing)|unknown command/i,
  exitCode: /exit code|exits? (with )?(0|zero|success)|status code of 0|process\.exit/i,
  cleanUnconfirmed: /clean[^.\n]{0,120}(confirm|dry[- ]run|destructive|irreversible|undo)|(confirm|dry[- ]run|destructive|irreversible|undo)[^.\n]{0,120}clean|backups?[^.\n]{0,80}(delet|remov)/i,
  noProgress: /progress|no output|silent for|silence|spinner|feedback during|30 seconds|status messages?|looks? (hung|frozen|stuck)/i,
  rawConfigError: /ENOENT|raw (error|stack)|stack trace|which file|config(uration)? (file )?(is )?(missing|not found)|shipit\.json[^.\n]{0,80}(missing|absent|error)|actionable/i,
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

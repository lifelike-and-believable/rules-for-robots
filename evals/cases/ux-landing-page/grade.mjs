// Pass when the review mentions at least four of the five planted design defects and
// changes no files.
import { agentInvoked, changedPaths, plantedFound, severityCounts, standardFormat } from '../../agents/grade-helpers.mjs';

export const DEFECTS = {
  weakCallToAction: /call[- ]to[- ]action|\bCTA\b|primary (action|button|link)|visual hierarchy|looks? like (body|a plain|other) (text|link)/i,
  unreadableText: /contrast|12 ?px|font[- ]size|#aaa|light gr[ae]y|small (text|type)|line length/i,
  notResponsive: /horizontal scroll|fixed[- ]width|1200 ?px|media quer|not responsive|no responsive|320 ?px|narrow (screen|viewport)|mobile/i,
  placeholderCopy: /lorem|placeholder (text|copy|content)|vague (headline|heading)|"?Welcome"? (is|as)|feature (one|two|three)/i,
  inconsistentLabels: /inconsistent|Join[^.\n]{0,80}(Register|Sign ?up|Get started)|(Register|Sign ?up|Get started)[^.\n]{0,80}Join|(three|3|different|multiple|mixed)[^.\n]{0,40}(labels|names|terms|wording)|one term/i,
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

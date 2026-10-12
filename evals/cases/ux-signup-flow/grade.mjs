// Pass when the review mentions at least four of the five planted usability defects and
// changes no files.
import { agentInvoked, changedPaths, plantedFound, severityCounts, standardFormat } from '../../agents/grade-helpers.mjs';

export const DEFECTS = {
  inputLost: /form\.reset|\breset(s|ting)?\b[^.\n]{0,60}(form|input|field)|(lose|loses|lost|wipe[sd]?|clear(s|ed)?)[^.\n]{0,60}(input|typed|entered|field|form)/i,
  bareError: /Error \$\{|Error 422|bare (status )?code|generic (error )?(message|text)|status code[^.\n]{0,40}(user|message)|what (went wrong|to do|to change)|actionable|unhelpful (error|message)/i,
  doubleSubmit: /double[- ]submit|duplicate (request|submission)|in-?flight|pending (state|request)|disable[sd]?[^.\n]{0,40}(button|submit)|(button|submit)[^.\n]{0,60}(disabled|pressed twice|clicked twice)|loading (state|indicator)/i,
  deleteUnconfirmed: /delete[^.\n]{0,100}(confirm|undo|destructive|accident)|(confirm|undo|destructive|accident)[^.\n]{0,100}delete/i,
  emptyState: /empty[- ](state|list|projects)|no projects|nothing (is )?(shown|displayed|renders?)|blank (list|area|section)|renders? nothing/i,
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

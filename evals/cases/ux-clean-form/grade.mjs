// Control. Pass when the review reports no blocker or major problem, says something
// (it lists what it checked or its minor notes), and changes no files.
import { agentInvoked, changedPaths, severityCounts } from '../../agents/grade-helpers.mjs';

export default async function grade({ git, tools = [], finalText = '', arm }) {
  const severities = severityCounts(finalText);
  const checks = {
    noCode: changedPaths(git).length === 0,
    noBlockerOrMajor: severities.blocker === 0 && severities.major === 0,
    answered: finalText.trim().length >= 50,
    agentInvoked: agentInvoked(arm, tools, 'ux-reviewer'),
  };
  return { pass: Object.values(checks).every(Boolean), checks: { ...checks, severities } };
}

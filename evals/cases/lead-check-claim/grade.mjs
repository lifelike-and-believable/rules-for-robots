// Pass when the check reports criterion 1 (429 after five failures) as unmet or unverified
// instead of accepting the worker's report, and no code changes.
import { agentInvoked, changedPaths } from '../../agents/grade-helpers.mjs';

const ABOUT_ONE = /criterion\s*1\b|criteria\s*1\b|\b1[.):]\s|\b429\b|rate[- ]limit/i;
const NOT_MET = /unmet|not met|isn'?t met|not (yet )?(been )?(implemented|wired|called|enforced|applied|used|hooked|connected)|never (calls?|uses?|invokes?|imports?)|missing|unverified|fails?\b|not satisfied|does not|doesn'?t|no 429/i;

export default async function grade({ git, tools = [], finalText = '', arm }) {
  const lines = finalText.split('\n');
  const checks = {
    noCode: changedPaths(git).length === 0,
    flagsCriterionOne: lines.some(l => ABOUT_ONE.test(l) && NOT_MET.test(l)),
    agentInvoked: agentInvoked(arm, tools, 'tech-lead'),
  };
  // Not part of the pass: whether the answer names the cause, the handler never calling the limiter.
  const namesCause = /(login\.js|login handler|handler|\blogin\b)[^.\n]{0,100}(never|not|doesn'?t|does not)[^.\n]{0,60}(call|use|import|invoke|wire|apply)|(never|not)[^.\n]{0,40}(called|wired|used|imported|applied)[^.\n]{0,60}(login|handler)/i.test(finalText);
  return { pass: Object.values(checks).every(Boolean), checks: { ...checks, namesCause } };
}

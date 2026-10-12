// Greenfield Unreal-plugin tech-lead case. Pass when the plan has four to ten slices, starts with a thin plugin that
// creates the descriptor and module and runs the verify script, covers the requirements, raises the R9/R10
// contradiction as a question, plans tests first with acceptance criteria, names the verify script, an owner and a
// reviewer, and no code changes.
import { agentInvoked, changedPaths, splitSlices } from '../../agents/grade-helpers.mjs';
import { conflictFlagged, requirementsMentioned } from '../../agents/greenfield.mjs';

export default async function grade({ git, tools = [], finalText = '', arm }) {
  const slices = splitSlices(finalText);
  const STRETCH = /stretch|optional|only if|if there is time|nice[- ]to[- ]have|not required|after the required/i;
  const required = slices.filter(s => !STRETCH.test(s.body.split('\n')[0]));
  const firstTwo = required.slice(0, 2).map(s => s.body).join('\n');
  const checks = {
    noCode: changedPaths(git).length === 0,
    sliceCount: required.length >= 4 && required.length <= 10,
    walkingSkeletonFirst: /skeleton|end[- ]to[- ]end|thin|vertical|scaffold|walking|first working|bootstrap|minimal plugin/i.test(firstTwo) && /verify|build|test|tier ?1/i.test(firstTwo),
    bootstrapsProject: /\.uplugin|Build\.cs|Source\/|module|plugin descriptor/i.test(firstTwo),
    coversRequirements: requirementsMentioned(required.map(s => s.body).join('\n'), 10).size >= 9,
    raisesConflict: conflictFlagged(finalText, 9, 10) && /\?|decision|confirm|ask the|before (we )?(build|start)|needs? (an )?answer/i.test(finalText),
    acceptanceCriteria: required.filter(s => /acceptance|done when|criteria|verified by|test/i.test(s.body)).length >= Math.ceil(required.length / 2),
    testsFirst: /test[- ]first|tests? first|failing tests?|red[,/ ]+green|write the tests/i.test(finalText),
    verifyCommand: /Verify\.ps1|tier1\.mjs/.test(finalText),
    reviewer: /code-reviewer|code review/i.test(finalText),
    owner: (finalText.match(/unreal-engineer|general-purpose/g) ?? []).length >= 2,
    agentInvoked: agentInvoked(arm, tools, 'tech-lead'),
  };
  return { pass: Object.values(checks).every(Boolean), checks: { ...checks, slices: required.length } };
}

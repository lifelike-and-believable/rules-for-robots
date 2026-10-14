// Greenfield web-app architect case. Pass when the design maps the requirements, flags the R9/R10
// contradiction, finds at least four of the six planted problems, asks the organizers questions, weighs
// options, records an ADR (a new file under docs/), and no code changes.
import { agentInvoked, changedPaths, designText, plantedFound } from '../../agents/grade-helpers.mjs';
import { OPTION_WORDS, conflictFlagged, questionCount, requirementsMentioned } from '../../agents/greenfield.mjs';

export const PROBLEMS = {
  anonymousCancel: /(cancel|R4)[^.\n]{0,200}(token|link|magic|signed|secret|no account|without (an )?account|identif|verify)|(token|magic link|signed link)[^.\n]{0,200}(cancel|R4)/i,
  realTimeAmbiguous: /real[- ]?time[^.\n]{0,240}(poll|refresh|websocket|server-sent|SSE|push|revalidat|eventual|define|mean|ambig|clarif|cost|budget)|(poll|websocket|server-sent|SSE)[^.\n]{0,200}real[- ]?time/i,
  capacityRace: /(capacity|R3|overbook)[^.\n]{0,200}(race|concurren|transaction|atomic|constraint|lock|isolation|simultaneous)|(race|concurren|atomic|transaction|simultaneous)[^.\n]{0,200}(capacity|R3|overbook|sign-?up)/i,
  reminderScheduler: /(remind|R6)[^.\n]{0,200}(cron|schedul|queue|job|background|time ?zone)|(cron|scheduled|queue)[^.\n]{0,200}(remind|R6)/i,
  organizerAuth: /organi[sz]ers?[^.\n]{0,200}(auth|log ?in|sign ?in|password|magic|admin|role|permission)|(auth|admin)[^.\n]{0,100}organi[sz]ers?|rate[- ]limit|spam|abuse|captcha/i,
};

export default async function grade({ dir, git, tools = [], finalText = '', arm }) {
  const files = changedPaths(git);
  const newDocs = files.filter(f => /^docs\/.+\.md$/.test(f));
  const text = designText(dir, newDocs, finalText);
  const { found, count } = plantedFound(text, PROBLEMS);
  const contradiction = conflictFlagged(text, 9, 10);
  const checks = {
    noCode: files.length > 0 && files.every(f => f.startsWith('docs/')),
    adrWritten: newDocs.length >= 1,
    contradictionFlagged: contradiction,
    foundFour: count + (contradiction ? 1 : 0) >= 4,
    coversRequirements: requirementsMentioned(text, 11).size >= 9,
    asksQuestions: questionCount(text) >= 2,
    options: (text.match(OPTION_WORDS) ?? []).length >= 2,
    agentInvoked: agentInvoked(arm, tools, 'software-architect'),
  };
  return { pass: Object.values(checks).every(Boolean), checks: { ...checks, found: contradiction ? ['contradiction', ...found] : found, of: Object.keys(PROBLEMS).length + 1 } };
}

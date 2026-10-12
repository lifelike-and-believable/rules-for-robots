// Pass when the plan has three to six slices owned by web-engineer, in dependency order
// (storage, endpoints, page), uses a verification command the project has, names a reviewer,
// keeps the two optional extras out of the slices, and no code changes.
import fs from 'node:fs';
import path from 'node:path';
import { agentInvoked, changedPaths, splitSlices } from '../../agents/grade-helpers.mjs';

export default async function grade({ dir, git, tools = [], finalText = '', arm }) {
  const slices = splitSlices(finalText);
  const titleIndex = re => slices.findIndex(s => re.test(s.title));
  const schema = titleIndex(/migration|table|schema|storage|store|tag data|data model/i);
  const endpoints = titleIndex(/POST|DELETE|endpoint|api|add(ing)? .*tag|remove/i);
  const page = titleIndex(/page|render|\bui\b|display|front/i);
  const scripts = Object.keys(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).scripts ?? {});
  const named = [...finalText.matchAll(/npm run ([\w:-]+)/g)].map(m => m[1]);
  const checks = {
    noCode: changedPaths(git).length === 0,
    sliceCount: slices.length >= 3 && slices.length <= 6,
    owner: (finalText.match(/web-engineer/g) ?? []).length >= 2,
    order: schema !== -1 && page !== -1 && schema < page && (endpoints === -1 || (schema < endpoints && endpoints < page)),
    verifyCommand: /npm run verify|npm test/.test(finalText) && named.every(n => scripts.includes(n)),
    reviewer: /code-reviewer/.test(finalText),
    noOptionalSlices: !slices.some(s => /csv|colou?r/i.test(s.title)),
    agentInvoked: agentInvoked(arm, tools, 'tech-lead'),
  };
  // Not part of the pass: whether the plan says which slices can run side by side.
  const parallelNoted = /in parallel|parallel|independent of|can run alongside|side by side/i.test(finalText);
  return { pass: Object.values(checks).every(Boolean), checks: { ...checks, slices: slices.length, parallelNoted } };
}

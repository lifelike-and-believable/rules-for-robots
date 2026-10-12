// Pass when the plan has three to six slices owned by web-engineer, in dependency order
// (storage, endpoints, page), uses a verification command the project has, names a reviewer,
// keeps the two optional extras out of the slices, and no code changes.
import fs from 'node:fs';
import path from 'node:path';
import { agentInvoked, changedPaths, splitSlices } from '../../agents/grade-helpers.mjs';

export default async function grade({ dir, git, tools = [], finalText = '', arm }) {
  const slices = splitSlices(finalText);
  // A slice's name is the first clause of its title ("Schema: add the migration..." is "Schema").
  const head = s => s.title.replace(/[*`#]/g, '').replace(/^\s*(?:\d+[.)]|t\d+\s*[—–:.-]|(?:slice|task|step|work package|package)\s*\d+\s*[—–:.-]?)\s*/i, '').split(/[:—–(]|\. /)[0].slice(0, 80);
  const titleIndex = re => slices.findIndex(s => re.test(head(s)));
  const schema = titleIndex(/migration|table|schema|storage|store|tag data|data model/i);
  const endpoints = titleIndex(/POST|DELETE|endpoint|\bapi\b|route|handler|http|server|GET \/notes/i);
  // A slice marked as a stretch or optional is not part of the required plan.
  const STRETCH = /stretch|optional|only if|if there is time|nice[- ]to[- ]have|not required|after the required/i;
  const required = slices.filter(s => !STRETCH.test(s.body.split('\n')[0]));
  // The notes page; not other work on the page, such as escaping note bodies.
  const page = slices.findIndex(s => /\bpage\b|\bui\b|render|display/i.test(head(s)) && !/\bbod(y|ies)\b/i.test(head(s)));
  const scripts = Object.keys(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).scripts ?? {});
  const named = [...finalText.matchAll(/npm run ([\w:-]+)/g)].map(m => m[1]);
  const checks = {
    noCode: changedPaths(git).length === 0,
    sliceCount: required.length >= 3 && required.length <= 6,
    // The roster agent, or general-purpose when the session says web-engineer is not available.
    owner: (finalText.match(/web-engineer|general-purpose/g) ?? []).length >= 2,
    order: schema !== -1 && page !== -1 && schema < page && (endpoints === -1 || (schema < endpoints && endpoints < page)),
    verifyCommand: /npm run verify|npm test/.test(finalText) && named.every(n => scripts.includes(n)),
    // The agent by name, or "code" in a reviewers column.
    reviewer: /code-reviewer|code review|\|\s*code\s*(?:,|\|)/i.test(finalText),
    // The two optional extras are fine as slices only when marked as a stretch.
    noOptionalSlices: !slices.some(s => /csv|colou?rs? (for|of|per) (each|every) tag|tag colou?rs?/i.test(s.title) && !STRETCH.test(s.body.split('\n')[0])),
    agentInvoked: agentInvoked(arm, tools, 'tech-lead'),
  };
  // Not part of the pass: whether the plan says which slices can run side by side.
  const parallelNoted = /in parallel|parallel|independent of|can run alongside|side by side/i.test(finalText);
  return { pass: Object.values(checks).every(Boolean), checks: { ...checks, slices: slices.length, parallelNoted } };
}

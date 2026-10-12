// Small rung of the architect's complexity ladder. Pass when the design finds at least three of the
// four constraints that sit in the repo (reports, nightly job, cache, invoice numbers), respects the
// seven-year retention, weighs options, records an ADR, and no code changes.
import { agentInvoked, changedPaths, designText, plantedFound } from '../../agents/grade-helpers.mjs';

export const CONSTRAINTS = {
  reports: /reports\.js|monthlyRevenue|openBalanceByUser|(finance|revenue) reports?/i,
  nightlyJob: /jobs\.js|nightlyReminders|nightly (job|reminder)|reminders?/i,
  cache: /cache(\.js)?[^.\n]{0,160}(stale|invalidat|evict|delet|still|serv)|(stale|invalidat|evict)[^.\n]{0,80}cache/i,
  invoiceNumbers: /\bnumbers?\b[^.\n]{0,120}(unique|gap|reus|MAX|sequen|renumber)|(unique|gap|reus|MAX|sequen|renumber)[^.\n]{0,120}invoice numbers?/i,
};

export default async function grade({ dir, git, tools = [], finalText = '', arm }) {
  const files = changedPaths(git);
  const newAdrs = files.filter(f => /^docs\/adr\/\d{4}-.+\.md$/.test(f));
  const text = designText(dir, newAdrs, finalText);
  const { found, count } = plantedFound(text, CONSTRAINTS);
  const checks = {
    noCode: files.length > 0 && files.every(f => f.startsWith('docs/adr/')),
    adrWritten: newAdrs.length >= 1,
    foundThree: count >= 3,
    retention: /seven years|7 years|7-year|retention|must be kept|keep every invoice/i.test(text),
    options: (text.match(/\boptions?\b|\balternatives?\b|\brejected?\b|\bconsidered\b|\binstead of\b|\brather than\b/gi) ?? []).length >= 2,
    agentInvoked: agentInvoked(arm, tools, 'software-architect'),
  };
  return { pass: Object.values(checks).every(Boolean), checks: { ...checks, found, of: Object.keys(CONSTRAINTS).length } };
}
